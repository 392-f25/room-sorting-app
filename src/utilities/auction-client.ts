import { ref, push, update, onValue, set, off } from 'firebase/database';
import { db } from './firebaseConfig';
import type { Auction, CreateData, Room, User } from '../types/index';

type FirebaseAuction = Omit<Auction, 'id' | 'rooms' | 'users'> & {
  rooms: Record<string, Omit<Room, 'id'>>;
  users: Record<string, Omit<User, 'id'>>;
};

const transformToClientAuction = (id: string, firebaseAuction: FirebaseAuction): Auction => {
  const rooms = Object.entries(firebaseAuction.rooms || {}).map(([roomId, roomData]) => ({
    ...roomData,
    id: roomId,
  }));

  const users = Object.entries(firebaseAuction.users || {}).map(([userId, userData]) => ({
    ...userData,
    id: userId,
  }));
  
  return {
    ...firebaseAuction,
    id,
    // a lil' bit of defensive coding never hurt anyone
    rooms: rooms.reduce((acc, room) => ({ ...acc, [room.id]: room }), {}),
    users: users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}),
  };
};


/**
 * Creates and saves a new auction to the Firebase Realtime Database.
 */
export const saveAuction = async (auctionData: CreateData): Promise<string> => {
  const { totalRent, rooms: roomNames } = auctionData;

  const auctionId = push(ref(db, 'auctions')).key;
  if (!auctionId) {
    throw new Error("Failed to generate a new auction ID.");
  }

  const rooms = roomNames.reduce((acc, name, i) => {
    const roomId = `room${i + 1}`;
    acc[roomId] = {
      name,
      cur_price: Number((totalRent / roomNames.length).toFixed(2)),
      cur_assignment: null,
      status: 'available',
    };
    return acc;
  }, {} as Record<string, Omit<Room, 'id'>>);

  const newAuction: Omit<Auction, 'id'> = {
    total_rent: totalRent,
    status: 'waiting',
    rooms,
    users: {},
    conflicts: {},
  };

  await set(ref(db, `/auctions/${auctionId}`), newAuction);
  return auctionId;
};

/**
 * Adds a new user to a specific auction.
 * @param auctionId The ID of the auction to join.
 * @param userName The name of the user joining.
 * @returns A promise that resolves with the new user's ID.
 */
export const addUserToAuction = async (auctionId: string, userName: string): Promise<string> => {
  const userRef = ref(db, `/auctions/${auctionId}/users`);
  const newUserId = push(userRef).key;
  if (!newUserId) {
    throw new Error('Failed to generate a new user ID.');
  }

  const newUser: Omit<User, 'id'> = {
    name: userName,
    cur_assignment: null,
    is_connected: true,
  };

  await update(userRef, {
    [newUserId]: newUser,
  });

  return newUserId;
};

/**
 * Subscribes to real-time updates for a specific auction.
 */
export const subscribeToAuction = (auctionId: string, onUpdate: (auction: Auction) => void): (() => void) => {
  const auctionRef = ref(db, `/auctions/${auctionId}`);

  const listener = onValue(auctionRef, (snapshot) => {
    if (snapshot.exists()) {
      const firebaseAuction = snapshot.val() as FirebaseAuction;
      const auction = transformToClientAuction(auctionId, firebaseAuction);
      onUpdate(auction);
    }
  });

  return () => {
    off(auctionRef, 'value', listener);
  };
};

/**
 * Places a bid for a user on a specific room.
 */
export const placeBid = async (auctionId: string, roomId: string, userId: string, amount: number): Promise<void> => {
  const bidRef = ref(db, `/auctions/${auctionId}/conflicts/${roomId}/bidders/${userId}/bid`);
  return set(bidRef, amount);
};

/**
 * Submits a user's room selection.
 */
export const submitSelection = async (auctionId: string, userId: string, roomId: string): Promise<void> => {
  const selectionRef = ref(db, `/selections/${auctionId}/${userId}`);
  return set(selectionRef, roomId);
};

/**
 * Starts the auction by updating its status to 'selecting'.
 */
export const startAuction = async (auctionId: string): Promise<void> => {
  const statusRef = ref(db, `/auctions/${auctionId}/status`);
  return set(statusRef, 'selecting');
};
