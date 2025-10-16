import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { AuctionData, Bid } from "./types";
import { assignHighestBidder, detectConflicts, applySelections } from "./auctionLogic";

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.database();

/**
 * Creates a new auction with the provided data
 */
export const createAuction = functions.https.onCall(async (data: AuctionData) => {
  try {
    const { totalRent, rooms: roomNames, users: userNames } = data;

    // Generate a unique auction ID
    const auctionRef = db.ref("auctionDetails").push();
    const auctionId = auctionRef.key;
    
    if (!auctionId) {
      throw new functions.https.HttpsError("internal", "Failed to generate auction ID");
    }

    // Prepare the data for the multi-path update
    const updates: Record<string, unknown> = {};

    // The main auction details
    const rooms = roomNames.reduce((acc, name, i) => {
      const roomId = `room${i + 1}`;
      acc[roomId] = { name, basePrice: Number((totalRent / roomNames.length).toFixed(2)) };
      return acc;
    }, {} as Record<string, { name: string; basePrice: number }>);

    const users = userNames.reduce((acc, name, i) => {
      const userId = `user${i + 1}`;
      acc[userId] = { name };
      return acc;
    }, {} as Record<string, { name: string }>);

    updates[`/auctionDetails/${auctionId}`] = {
      totalRent,
      status: "active",
      rooms,
      users,
    };

    // The initial state of assignments for all rooms
    const initialAssignments = Object.keys(rooms).reduce((acc, roomId) => {
      acc[roomId] = { userId: null, price: rooms[roomId].basePrice };
      return acc;
    }, {} as Record<string, { userId: string | null; price: number }>);

    updates[`/auctionState/${auctionId}`] = {
      assignments: initialAssignments,
    };

    // Perform the atomic update
    await db.ref().update(updates);

    return { auctionId };
  } catch (error) {
    console.error("Error creating auction:", error);
    throw new functions.https.HttpsError("internal", "Failed to create auction");
  }
});

/**
 * Gets auction details by ID
 */
export const getAuction = functions.https.onCall(async (data: { auctionId: string }) => {
  try {
    const { auctionId } = data;
    
    const [detailsSnapshot, stateSnapshot] = await Promise.all([
      db.ref(`auctionDetails/${auctionId}`).once("value"),
      db.ref(`auctionState/${auctionId}`).once("value")
    ]);

    const details = detailsSnapshot.val();
    const state = stateSnapshot.val();

    if (!details) {
      throw new functions.https.HttpsError("not-found", "Auction not found");
    }

    return {
      details,
      state
    };
  } catch (error) {
    console.error("Error getting auction:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to get auction");
  }
});

/**
 * Submits bids for a room
 */
export const submitBids = functions.https.onCall(async (data: { 
  auctionId: string; 
  roomId: string; 
  bids: Bid[] 
}) => {
  try {
    const { auctionId, roomId, bids } = data;

    // Get current auction state
    const [detailsSnapshot, stateSnapshot] = await Promise.all([
      db.ref(`auctionDetails/${auctionId}`).once("value"),
      db.ref(`auctionState/${auctionId}`).once("value")
    ]);

    const details = detailsSnapshot.val();
    const state = stateSnapshot.val();

    if (!details || !state) {
      throw new functions.https.HttpsError("not-found", "Auction not found");
    }

    // Convert to Auction object for processing
    const auction = {
      id: auctionId,
      totalRent: details.totalRent,
      users: Object.entries(details.users).map(([id, user]: [string, any]) => ({
        id,
        name: user.name,
        assignedRoomId: state.assignments[roomId]?.userId === id ? roomId : undefined
      })),
      rooms: Object.entries(details.rooms).map(([id, room]: [string, any]) => ({
        id,
        name: room.name,
        price: state.assignments[id]?.price || room.basePrice,
        assignedUserId: state.assignments[id]?.userId
      }))
    };

    // Process the bids using the auction logic
    const updatedAuction = assignHighestBidder(auction, roomId, bids);

    // Update the database with new assignments
    const updates: Record<string, unknown> = {};
    
    for (const room of updatedAuction.rooms) {
      if (room.assignedUserId) {
        updates[`/auctionState/${auctionId}/assignments/${room.id}`] = {
          userId: room.assignedUserId,
          price: room.price
        };
      }
    }

    await db.ref().update(updates);

    return { success: true };
  } catch (error) {
    console.error("Error submitting bids:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to submit bids");
  }
});

/**
 * Detects conflicts in room selections
 */
export const detectRoomConflicts = functions.https.onCall(async (data: { 
  auctionId: string; 
  selections: Record<string, string | null> 
}) => {
  try {
    const { auctionId, selections } = data;

    // Get current auction state
    const [detailsSnapshot, stateSnapshot] = await Promise.all([
      db.ref(`auctionDetails/${auctionId}`).once("value"),
      db.ref(`auctionState/${auctionId}`).once("value")
    ]);

    const details = detailsSnapshot.val();
    const state = stateSnapshot.val();

    if (!details || !state) {
      throw new functions.https.HttpsError("not-found", "Auction not found");
    }

    // Convert to Auction object for processing
    const auction = {
      id: auctionId,
      totalRent: details.totalRent,
      users: Object.entries(details.users).map(([id, user]: [string, any]) => ({
        id,
        name: user.name,
        assignedRoomId: Object.entries(state.assignments).find(([, assignment]: [string, any]) => 
          assignment.userId === id)?.[0]
      })),
      rooms: Object.entries(details.rooms).map(([id, room]: [string, any]) => ({
        id,
        name: room.name,
        price: state.assignments[id]?.price || room.basePrice,
        assignedUserId: state.assignments[id]?.userId
      }))
    };

    // Detect conflicts
    const conflicts = detectConflicts(auction, selections);

    return conflicts;
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to detect conflicts");
  }
});

/**
 * Applies room selections
 */
export const applyRoomSelections = functions.https.onCall(async (data: { 
  auctionId: string; 
  selections: Record<string, string | null> 
}) => {
  try {
    const { auctionId, selections } = data;

    // Get current auction state
    const [detailsSnapshot, stateSnapshot] = await Promise.all([
      db.ref(`auctionDetails/${auctionId}`).once("value"),
      db.ref(`auctionState/${auctionId}`).once("value")
    ]);

    const details = detailsSnapshot.val();
    const state = stateSnapshot.val();

    if (!details || !state) {
      throw new functions.https.HttpsError("not-found", "Auction not found");
    }

    // Convert to Auction object for processing
    const auction = {
      id: auctionId,
      totalRent: details.totalRent,
      users: Object.entries(details.users).map(([id, user]: [string, any]) => ({
        id,
        name: user.name,
        assignedRoomId: Object.entries(state.assignments).find(([, assignment]: [string, any]) => 
          assignment.userId === id)?.[0]
      })),
      rooms: Object.entries(details.rooms).map(([id, room]: [string, any]) => ({
        id,
        name: room.name,
        price: state.assignments[id]?.price || room.basePrice,
        assignedUserId: state.assignments[id]?.userId
      }))
    };

    // Apply selections
    const updatedAuction = applySelections(auction, selections);

    // Update the database with new assignments
    const updates: Record<string, unknown> = {};
    
    for (const room of updatedAuction.rooms) {
      updates[`/auctionState/${auctionId}/assignments/${room.id}`] = {
        userId: room.assignedUserId || null,
        price: room.price
      };
    }

    await db.ref().update(updates);

    return { success: true };
  } catch (error) {
    console.error("Error applying selections:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to apply selections");
  }
});
