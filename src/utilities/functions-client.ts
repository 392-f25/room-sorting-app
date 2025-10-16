import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseConfig';

// Initialize Firebase Functions
const functions = getFunctions(app);

// Type definitions for function calls
export interface CreateAuctionData {
  totalRent: number;
  rooms: string[];
  users: string[];
}

export interface CreateAuctionResponse {
  auctionId: string;
}

export interface GetAuctionResponse {
  details: {
    totalRent: number;
    status: string;
    rooms: Record<string, { name: string; basePrice: number }>;
    users: Record<string, { name: string }>;
  };
  state: {
    assignments: Record<string, { userId: string | null; price: number }>;
  };
}

export interface Bid {
  userId: string;
  amount: number;
}

export interface SubmitBidsData {
  auctionId: string;
  roomId: string;
  bids: Bid[];
}

export interface DetectConflictsData {
  auctionId: string;
  selections: Record<string, string | null>;
}

export interface ConflictResponse {
  conflicts: string[];
  roomToUsers: Record<string, string[]>;
}

export interface ApplySelectionsData {
  auctionId: string;
  selections: Record<string, string | null>;
}

// Function call wrappers
export const createAuction = async (data: CreateAuctionData): Promise<CreateAuctionResponse> => {
  const createAuctionFunction = httpsCallable(functions, 'createAuction');
  const result = await createAuctionFunction(data);
  return result.data as CreateAuctionResponse;
};

export const getAuction = async (auctionId: string): Promise<GetAuctionResponse> => {
  const getAuctionFunction = httpsCallable(functions, 'getAuction');
  const result = await getAuctionFunction({ auctionId });
  return result.data as GetAuctionResponse;
};

export const submitBids = async (data: SubmitBidsData): Promise<{ success: boolean }> => {
  const submitBidsFunction = httpsCallable(functions, 'submitBids');
  const result = await submitBidsFunction(data);
  return result.data as { success: boolean };
};

export const detectRoomConflicts = async (data: DetectConflictsData): Promise<ConflictResponse> => {
  const detectConflictsFunction = httpsCallable(functions, 'detectRoomConflicts');
  const result = await detectConflictsFunction(data);
  return result.data as ConflictResponse;
};

export const applyRoomSelections = async (data: ApplySelectionsData): Promise<{ success: boolean }> => {
  const applySelectionsFunction = httpsCallable(functions, 'applyRoomSelections');
  const result = await applySelectionsFunction(data);
  return result.data as { success: boolean };
};
