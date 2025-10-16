import { onValueWritten } from 'firebase-functions/v2/database';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize the Firebase Admin SDK
initializeApp();

// --- Type Definitions ---
// It's a good practice to share these types with your frontend application
type ID = string;

type User = {
  id: ID;
  name: string;
  assignedRoomId: ID | null;
};

type Room = {
  id: ID;
  name: string;
  price: number;
  assignedUserId: ID | null;
  status?: 'bidding';
};

type Auction = {
  id: ID;
  totalRent: number;
  users: User[];
  rooms: Room[];
  selections?: Record<string, ID>;
};
// --------------------

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
    const updates: Record<string, unknown> = {};

    // 7. Process the grouped selections
    for (const roomId in selectionsByRoom) {
      const userIds = selectionsByRoom[roomId];
      const roomIndex = auction.rooms.findIndex((r) => r.id === roomId);

      if (roomIndex === -1) {
        logger.error(`Could not find room with ID ${roomId}. Skipping.`);
        continue;
      }

      if (userIds.length === 1) {
        // --- NO CONFLICT ---
        const userId = userIds[0];
        logger.info(`No conflict for room ${roomId}. Assigning to user ${userId}.`);

        const userIndex = users.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
          updates[`/auctions/${auctionId}/users/${userIndex}/assignedRoomId`] = roomId;
          updates[`/auctions/${auctionId}/rooms/${roomIndex}/assignedUserId`] = userId;
        }
      } else {
        // --- CONFLICT ---
        logger.info(`Conflict detected for room ${roomId}. Starting a bidding war.`);
        updates[`/auctions/${auctionId}/rooms/${roomIndex}/status`] = 'bidding';
      }
    }

    // 8. Clean up the selections node for the next round
    updates[`/auctions/${auctionId}/selections`] = null;

    // 9. Atomically apply all updates to the database
    await getDatabase().ref().update(updates);

    logger.info('Successfully processed selections and updated database.');

    return null;
  }
);

