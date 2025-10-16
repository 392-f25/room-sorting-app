import { onValueWritten } from 'firebase-functions/v2/database';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { Auction, ID } from './types.js';

initializeApp();

/**
 * Assigns a room to a user and vice-versa within a given updates object.
 * This function does not perform the database write itself; it prepares
 * the data for an atomic update.
 *
 * @param updates The object accumulating database updates.
 * @param auctionId The ID of the auction.
 * @param userId The ID of the user.
 * @param roomId The ID of the room.
 */
function assignRoomToUser(
  updates: { [key: string]: unknown },
  auctionId: ID,
  userId: ID,
  roomId: ID,
) {
  updates[`/auctions/${auctionId}/users/${userId}/assignedRoomId`] = roomId;
  updates[`/auctions/${auctionId}/rooms/${roomId}/assignedUserId`] = userId;
}

// Type definitions are imported from './types'.

export const onselectionwrite = onValueWritten(
  '/auctions/{auctionId}/selections/{userId}',
  async (event) => {
    const { auctionId } = event.params;

    // 1. Get the full auction data from the database
    const auctionRef = getDatabase().ref(`/auctions/${auctionId}`);
    const auctionSnapshot = await auctionRef.once('value');
    const auction: Auction = auctionSnapshot.val();

    if (!auction) {
      logger.error(`Auction with ID ${auctionId} not found.`);
      return null;
    }

    // Firebase returns arrays as objects if they are sparse, so we ensure they are arrays
    const users = auction.users ? Object.values(auction.users) : [];
    const selections = auction.selections ?? {};

    // 2. Count how many users are unassigned
    const unassignedUserCount = users.filter(
      (user) => !user.assignedRoomId
    ).length;

    // 3. Count how many users have made a selection
    const selectionCount = Object.keys(selections).length;

    logger.info(
      `Checking selections for auction ${auctionId}: ${selectionCount} of ${unassignedUserCount} unassigned users have submitted.`
    );

    // 4. Compare the counts. If they don't match, exit the function.
    if (selectionCount < unassignedUserCount) {
      logger.info('Still waiting for more users to submit their selection.');
      return null;
    }

    // If we reach this point, it means all users have submitted.
    logger.info(
      `All ${unassignedUserCount} users have submitted. Processing results for auction ${auctionId}...`
    );

    // 5. Group selections by roomId to find conflicts
    const selectionsByRoom: Record<string, string[]> = {};
    for (const userId in selections) {
      const roomId = selections[userId];
      if (!selectionsByRoom[roomId]) {
        selectionsByRoom[roomId] = [];
      }
      selectionsByRoom[roomId].push(userId);
    }

    logger.info('Selections grouped by room:', selectionsByRoom);

    // 6. Prepare a multi-path update object for atomicity
    const updates: { [key: string]: unknown } = {};

    // 7. Process the grouped selections
    for (const roomId in selectionsByRoom) {
      const userIds = selectionsByRoom[roomId];

      if (userIds.length === 1) {
        // --- NO CONFLICT ---
        const userId = userIds[0];
        logger.info(`No conflict for room ${roomId}. Assigning to user ${userId}.`);

        // Assign the room to the user
        assignRoomToUser(updates, auctionId, userId, roomId);
      } else {
        // --- CONFLICT ---
        logger.info(`Conflict detected for room ${roomId}. Starting a bidding war.`);
        updates[`/auctions/${auctionId}/rooms/${roomId}/status`] = 'bidding';
        // Store which users are in the conflict for this room
        const conflictingUsers: Record<string, boolean> = {};
        userIds.forEach(id => {
          conflictingUsers[id] = true;
        });
        updates[`/auctions/${auctionId}/rooms/${roomId}/conflictingUserIds`] = conflictingUsers;
      }
    }

    // 8. Clean up the selections node for the next round
    updates[`/auctions/${auctionId}/selections`] = null;

    // 9. Atomically apply all updates to the database
    await getDatabase().ref().update(updates);
    logger.info(`Processed selections for auction: ${auctionId}`);

    return null;
  }
);

export const onbidwrite = onValueWritten(
  '/auctions/{auctionId}/bidding/{roomId}/{userId}',
  async (event) => {
    // Exit if the bid was deleted to prevent re-triggering
    if (!event.data.after.exists()) {
      logger.info('Bid was deleted, exiting function.');
      return null;
    }

    const { auctionId, roomId } = event.params;
    const db = getDatabase();

    // 1. Get the conflicting users for the room
    const roomRef = db.ref(`/auctions/${auctionId}/rooms/${roomId}`);
    const roomSnapshot = await roomRef.once('value');
    const room = roomSnapshot.val();

    if (!room || !room.conflictingUserIds) {
      logger.error(
        `Room ${roomId} or conflicting users not found for auction ${auctionId}.`
      );
      return null;
    }

    const expectedBidders = Object.keys(room.conflictingUserIds);
    const expectedBidderCount = expectedBidders.length;

    // 2. Get the current bids for the room
    const bidsRef = db.ref(`/auctions/${auctionId}/bidding/${roomId}`);
    const bidsSnapshot = await bidsRef.once('value');
    const bids = bidsSnapshot.val() || {};

    const actualBidderCount = Object.keys(bids).length;

    logger.info(
      `Checking bids for room ${roomId} in auction ${auctionId}: ${actualBidderCount} of ${expectedBidderCount} have bid.`
    );

    // 3. Compare counts and exit if not all bids are in
    if (actualBidderCount < expectedBidderCount) {
      logger.info('Still waiting for more bids.');
      return null;
    }

    // If we reach here, all bids are in.
    logger.info(`All bids are in for room ${roomId}. Processing results...`);

    // 4. Find the winning bid
    let winnerId = '';
    let highestBid = -1;
    for (const userId in bids) {
      if (bids[userId] > highestBid) {
        highestBid = bids[userId];
        winnerId = userId;
      }
    }

    logger.info(
      `Winner for room ${roomId} is ${winnerId} with a bid of ${highestBid}.`
    );

    // 5. Prepare atomic updates
    const updates: { [key: string]: unknown } = {};

    // Assign the room to the winner
    assignRoomToUser(updates, auctionId, winnerId, roomId);

    // Update the winning room's price and status
    updates[`/auctions/${auctionId}/rooms/${roomId}/price`] = highestBid;
    updates[`/auctions/${auctionId}/rooms/${roomId}/status`] = 'assigned';
    updates[`/auctions/${auctionId}/rooms/${roomId}/conflictingUserIds`] = null;

    // Clean up the bidding node for this room
    updates[`/auctions/${auctionId}/bidding/${roomId}`] = null;

    // 6. Recalculate prices for remaining rooms
    const auctionSnapshot = await db.ref(`/auctions/${auctionId}`).once('value');
    const auction: Auction = auctionSnapshot.val();

    const remainingRent = auction.totalRent - highestBid;
    const unassignedRooms = Object.values(auction.rooms).filter(
      (r) => r.status === 'available' && r.id !== roomId
    );

    if (unassignedRooms.length > 0) {
      const newPrice = remainingRent / unassignedRooms.length;
      logger.info(
        `Recalculating prices for ${unassignedRooms.length} remaining rooms. New price: ${newPrice}`
      );
      for (const r of unassignedRooms) {
        updates[`/auctions/${auctionId}/rooms/${r.id}/price`] = newPrice;
      }
    }

    // 7. Atomically apply all updates
    await db.ref().update(updates);
    logger.info(`Successfully resolved bid for room ${roomId}.`);

    return null;
  }
);

