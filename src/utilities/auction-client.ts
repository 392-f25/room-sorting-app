import { ref, push, update, onValue, set, off } from 'firebase/database';
import { db } from './firebaseConfig';
import type { Auction, CreateData, Room, User } from '../types/index';

// Type definitions for the shape of data in Firebase
type FirebaseAuctionDetails = {
  totalRent: number;
  status: 'active' | 'closed';
  rooms: Record<string, { name: string; basePrice: number }>;
  users: Record<string, { name: string }>;
};

type FirebaseAuctionState = {
  assignments: Record<string, { userId: string | null; price: number }>;
};

/**
 * Combines the details and state from Firebase into a single client-side Auction object.
 */
const combineAuctionData = (id: string, details: FirebaseAuctionDetails, state: FirebaseAuctionState): Auction => {
  const rooms: Room[] = Object.entries(details.rooms).map(([roomId, roomData]) => ({
    id: roomId,
    name: roomData.name,
    price: state.assignments[roomId]?.price ?? roomData.basePrice,
    assignedUserId: state.assignments[roomId]?.userId ?? undefined,
  }));

  const users: User[] = details.users ? Object.entries(details.users).map(([userId, userData]) => {
    const assignedRoom = Object.entries(state.assignments).find(([, assignment]) => assignment.userId === userId);
    return {
      id: userId,
      name: userData.name,
      assignedRoomId: assignedRoom ? assignedRoom[0] : undefined,
    };
  }) : [];

  return {
    id,
    totalRent: details.totalRent,
    rooms,
    users,
  };
};


/**
 * Creates and saves a new auction to the Firebase Realtime Database.
 */
export const saveAuction = async (auctionData: Omit<CreateData, 'users'>): Promise<string> => {
  const { totalRent, rooms: roomNames } = auctionData;

  const auctionId = push(ref(db, 'auctionDetails')).key;
  if (!auctionId) {
    throw new Error("Failed to generate a new auction ID.");
  }

  const updates: Record<string, unknown> = {};

  const rooms = roomNames.reduce((acc, name, i) => {
    const roomId = `room${i + 1}`;
    acc[roomId] = { name, basePrice: Number((totalRent / roomNames.length).toFixed(2)) };
    return acc;
  }, {} as Record<string, { name: string; basePrice: number }>);

  updates[`/auctionDetails/${auctionId}`] = {
    totalRent,
    status: 'active',
    rooms,
    users: {}, // Users object is initially empty
  };

  const initialAssignments = Object.keys(rooms).reduce((acc, roomId) => {
    acc[roomId] = { userId: null, price: rooms[roomId].basePrice };
    return acc;
  }, {} as Record<string, { userId: string | null; price: number }>);

  updates[`/auctionState/${auctionId}`] = {
    assignments: initialAssignments,
  };

  await update(ref(db), updates);
  return auctionId;
};

/**
 * Adds a new user to a specific auction.
 * @param auctionId The ID of the auction to join.
 * @param userName The name of the user joining.
 * @returns A promise that resolves with the new user's ID.
 */
export const addUserToAuction = async (auctionId: string, userName: string): Promise<string> => {
  const userRef = ref(db, `/auctionDetails/${auctionId}/users`);
  const newUserId = push(userRef).key;
  if (!newUserId) {
    throw new Error('Failed to generate a new user ID.');
  }

  await update(userRef, {
    [newUserId]: { name: userName },
  });

  return newUserId;
};

/**
 * Subscribes to real-time updates for a specific auction.
 */
export const subscribeToAuction = (auctionId: string, onUpdate: (auction: Auction) => void): (() => void) => {
  const detailsRef = ref(db, `/auctionDetails/${auctionId}`);
  const stateRef = ref(db, `/auctionState/${auctionId}`);

  let details: FirebaseAuctionDetails | null = null;
  let state: FirebaseAuctionState | null = null;

  const checkAndUpdate = () => {
    if (details && state) {
      const combined = combineAuctionData(auctionId, details, state);
      onUpdate(combined);
    }
  };

  const detailsListener = onValue(detailsRef, (snapshot) => {
    if (snapshot.exists()) {
      details = snapshot.val();
      checkAndUpdate();
    }
  });

  const stateListener = onValue(stateRef, (snapshot) => {
    if (snapshot.exists()) {
      state = snapshot.val();
      checkAndUpdate();
    }
  });

  return () => {
    off(detailsRef, 'value', detailsListener);
    off(stateRef, 'value', stateListener);
  };
};

/**
 * Places a bid for a user on a specific room.
 */
export const placeBid = async (auctionId: string, roomId: string, userId: string, amount: number): Promise<void> => {
  const bidRef = ref(db, `/bids/${auctionId}/${roomId}/${userId}`);
  return set(bidRef, amount);
};

/**
 * Submits a user's room selection.
 */
export const submitSelection = async (auctionId: string, userId: string, roomId: string): Promise<void> => {
  const selectionRef = ref(db, `/selections/${auctionId}/${userId}`);
  return set(selectionRef, roomId);
};
