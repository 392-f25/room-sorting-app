import { ref, push, set } from 'firebase/database';
import { db } from './firebaseConfig';
import type { Auction, CreateData, Room, User } from '../types/index';

/**
 * Creates and initializes a new Auction object from raw form data.
 * It sets up the initial users and rooms, distributing the total rent
 * evenly among the rooms as a starting price.
 * @param id The unique identifier for this auction.
 * @param totalRent The total rent amount for the property.
 * @param roomNames An array of strings representing the names of the rooms.
 * @param userNames An array of strings representing the names of the users.
 * @returns The fully initialized Auction object.
 */
export const initAuction = (id: string, totalRent: number, roomNames: string[], userNames: string[]) : Auction => {
  const rooms: Room[] = roomNames.map((name, i) => ({
    id: `r${i+1}`,
    name,
    price: Number((totalRent / roomNames.length).toFixed(2)),
  }));

  const users: User[] = userNames.map((name, i) => ({
    id: `u${i+1}`,
    name,
  }));

  return {
    id,
    totalRent,
    users,
    rooms,
  };
};

/**
 * Calculates the sum of all room prices in a given list of rooms.
 * @param rooms An array of Room objects.
 * @returns The total sum of the prices, fixed to 2 decimal places.
 */
export const sumRoomPrices = (rooms: Room[]) => {
  return Number(rooms.reduce((s, r) => s + r.price, 0).toFixed(2));
};

/**
 * Assigns the highest bidder to a specific room and recalculates the prices
 * for all remaining unassigned rooms.
 * @param auction The current auction object.
 * @param roomId The ID of the room being bid on.
 * @param bids An array of bid objects for the room.
 * @returns A new auction object with the updated room assignments and prices.
 */
export const assignHighestBidder = (
  auction: Auction,
  roomId: string,
  bids: { userId: string; amount: number }[],
): Auction => {
  // Find highest bid; if tie, return auction unchanged (caller should handle re-bid)
  if (bids.length === 0) return auction;
  let highest = bids[0];
  for (const b of bids) {
    if (b.amount > highest.amount) highest = b;
  }

  const rooms = auction.rooms.map(r => ({ ...r }));
  const users = auction.users.map(u => ({ ...u, assignedRoomId: u.assignedRoomId }));

  const room = rooms.find(r => r.id === roomId);
  if (!room) return auction;

  // Assign highest bidder
  room.assignedUserId = highest.userId;
  room.price = Number(highest.amount.toFixed(2));

  // Unassign any user who was previously assigned to this room (except highest)
  for (const u of users) {
    if (u.assignedRoomId === roomId && u.id !== highest.userId) {
      delete u.assignedRoomId;
    }
  }

  users.find(u => u.id === highest.userId)!.assignedRoomId = roomId;

  // Recalculate prices for unassigned rooms to split remaining rent evenly
  // Only count prices for rooms that have an assigned user (including the one we just assigned).
  const assignedSum = rooms.filter(r => r.assignedUserId).reduce((s, r) => s + (r.price || 0), 0);
  const remaining = Number((auction.totalRent - assignedSum).toFixed(2));
  const unassigned = rooms.filter(r => !r.assignedUserId);
  if (unassigned.length > 0) {
    const split = Number((remaining / unassigned.length).toFixed(2));
    for (const r of unassigned) r.price = split;
    // Fix rounding: adjust last room to make sum exact
    const diff = Number((auction.totalRent - rooms.reduce((s, r) => s + r.price, 0)).toFixed(2));
    if (diff !== 0) {
      unassigned[unassigned.length - 1].price = Number((unassigned[unassigned.length - 1].price + diff).toFixed(2));
    }
  }

  return { ...auction, rooms, users };
};

/**
 * Analyzes user room selections to detect conflicts, where multiple users
 * have selected the same room.
 * @param auction The current auction object.
 * @param selections A map of userId to their selected roomId.
 * @returns An object containing a list of roomIds with conflicts and a map of rooms to the users who selected them.
 */
export const detectConflicts = (auction: Auction, selections: Record<string, string | null>) => {
  // selections: userId -> roomId or null
  const roomToUsers: Record<string, string[]> = {};
  for (const user of auction.users) {
    // If a user has made a selection use it, otherwise if they're already assigned treat their assigned room as their current selection.
    const sel = selections[user.id] ?? user.assignedRoomId ?? null;
    if (!sel) continue;
    roomToUsers[sel] = roomToUsers[sel] ?? [];
    roomToUsers[sel].push(user.id);
  }
  const conflicts = Object.entries(roomToUsers).filter(([, users]) => users.length > 1).map(([roomId]) => roomId);
  return { conflicts, roomToUsers };
};

/**
 * Applies unique room selections made by users, assigning users to rooms
 * where there are no conflicts. It then recalculates prices for unassigned rooms.
 * @param auction The current auction object.
 * @param selections A map of userId to their selected roomId.
 * @returns A new auction object with the updated assignments and prices.
 */
export const applySelections = (auction: Auction, selections: Record<string, string | null>) => {
  // Assign users to rooms if unique selection, leave unassigned if conflict.
  // Preserve any existing assignments on rooms/users and only add new unique assignments.
  const rooms = auction.rooms.map(r => ({ ...r }));
  const users = auction.users.map(u => ({ ...u }));

  const chosen: Record<string, string[]> = {};
  for (const u of users) {
    // skip users already assigned
    if (u.assignedRoomId) continue;
    const sel = selections[u.id] ?? null;
    if (!sel) continue;
    chosen[sel] = chosen[sel] ?? [];
    chosen[sel].push(u.id);
  }

  // assign unique picks to rooms that are not already assigned
  for (const [roomId, userIds] of Object.entries(chosen)) {
    if (userIds.length === 1) {
      const uid = userIds[0];
      const room = rooms.find(r => r.id === roomId)!;
      if (!room.assignedUserId) {
        room.assignedUserId = uid;
        users.find(u => u.id === uid)!.assignedRoomId = roomId;
      }
    }
  }

  // Recalculate prices: assigned rooms keep their price, unassigned split remaining
  const assignedSum = rooms.filter(r => r.assignedUserId).reduce((s, r) => s + (r.price || 0), 0);
  const remaining = Number((auction.totalRent - assignedSum).toFixed(2));
  const unassigned = rooms.filter(r => !r.assignedUserId);
  if (unassigned.length > 0) {
    const split = Number((remaining / unassigned.length).toFixed(2));
    for (const r of unassigned) r.price = split;
    const diff = Number((auction.totalRent - rooms.reduce((s, r) => s + r.price, 0)).toFixed(2));
    if (diff !== 0) unassigned[unassigned.length - 1].price = Number((unassigned[unassigned.length - 1].price + diff).toFixed(2));
  }

  return { ...auction, rooms, users };
};

/**
 * Saves the initial auction data to the Firebase Realtime Database.
 * @param auctionData The raw data from the creation form.
 * @returns A promise that resolves with the unique key (ID) of the newly created auction, or null if an error occurred.
 */
export const saveAuction = async (auctionData: CreateData) => {
  try {
    // Create a reference to the 'auctions' list in database
    const auctionsRef = ref(db, 'auctions');
    
    // Create a new, unique entry in the 'auctions' list
    const newAuctionRef = push(auctionsRef);
    
    // Write the auction data to that new entry
    await set(newAuctionRef, auctionData);
    
    // Return the unique key (ID) of the newly created auction
    return newAuctionRef.key;
  } catch (error) {
    console.error("Error saving auction to Firebase:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};