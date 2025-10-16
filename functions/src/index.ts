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

