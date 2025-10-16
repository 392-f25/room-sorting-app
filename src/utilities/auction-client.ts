import { ref, push, set, onValue, off } from 'firebase/database';
import { db } from './firebaseConfig';
import type { Auction, CreateData, Room, User } from '../types/index';

/**
 * Creates and saves a new auction to the Firebase Realtime Database.
 */
export const saveAuction = async (
  data: Omit<CreateData, 'users'>
): Promise<string> => {
  const newAuctionRef = push(ref(db, 'auctions'));
  const newAuctionId = newAuctionRef.key;

  if (!newAuctionId) {
    throw new Error('Failed to create a new auction ID.');
  }

  const { totalRent, rooms: roomNames } = data;
  const roomCount = roomNames.length;
  const basePrice = totalRent / roomCount;

  const newRooms: Room[] = roomNames.map((name) => {
    const roomId = push(ref(db, `auctions/${newAuctionId}/rooms`)).key!;
    return {
      id: roomId,
      name,
      price: basePrice,
      assignedUserId: null,
    };
  });

  const newAuction: Auction = {
    id: newAuctionId,
    totalRent,
    rooms: newRooms,
    users: [],
  };

  await set(newAuctionRef, newAuction);

  return newAuctionId;
};

/**
 * Subscribes to real-time updates for a specific auction.
 */
export const subscribeToAuction = (
  auctionId: string,
  onUpdate: (auction: Auction) => void
): (() => void) => {
  const auctionRef = ref(db, `/auctions/${auctionId}`);

  const listener = onValue(auctionRef, (snapshot) => {
    if (snapshot.exists()) {
      const auctionData = snapshot.val();

      // Firebase returns arrays as objects if they are sparse, so we convert them back
      const users = auctionData.users ? Object.values(auctionData.users) : [];
      const rooms = auctionData.rooms ? Object.values(auctionData.rooms) : [];

      onUpdate({ ...auctionData, users, rooms });
    }
  });

  return () => {
    off(auctionRef, 'value', listener);
  };
};

/**
 * Adds a new user to a specific auction.
 * @param auctionId The ID of the auction to join.
 * @param userName The name of the user joining.
 * @returns A promise that resolves with the new user's ID.
 */
export const addUserToAuction = async (auctionId: string, userName: string): Promise<string> => {
  const usersRef = ref(db, `auctions/${auctionId}/users`);
  const newUserRef = push(usersRef);
  const newUserId = newUserRef.key;

  if (!newUserId) {
    throw new Error('Failed to generate a new user ID.');
  }

  const newUser: User = {
    id: newUserId,
    name: userName,
    assignedRoomId: null,
  };

  await set(newUserRef, newUser);

  return newUserId;
};


/**
 * Places a bid for a user on a specific room.
 */
export const placeBid = async (auctionId: string, roomId: string, userId: string, amount: number): Promise<void> => {
  const bidRef = ref(db, `auctions/${auctionId}/bidding/${roomId}/${userId}`);
  return set(bidRef, amount);
};

/**
 * Submits a user's room selection.
 */
export const submitSelection = async (auctionId: string, userId: string, roomId: string): Promise<void> => {
  const selectionRef = ref(db, `auctions/${auctionId}/selections/${userId}`);
  return set(selectionRef, roomId);
};
