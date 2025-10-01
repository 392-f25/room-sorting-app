import type { Auction, Room, User } from '../types/index';

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

export const sumRoomPrices = (rooms: Room[]) => {
  return Number(rooms.reduce((s, r) => s + r.price, 0).toFixed(2));
};

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
