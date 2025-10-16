export type ID = string;

export type User = {
  id: ID;
  name: string;
  cur_assignment: ID | null;
  is_connected: boolean;
};

export type Room = {
  id: ID;
  name: string;
  cur_price: number;
  cur_assignment: ID | null;
  status: 'available' | 'bidding' | 'assigned';
};

export type Bid = {
  bid: number;
  submitted: boolean;
};

export type Conflict = {
  bidders: Record<ID, Bid>;
};

export type Auction = {
  id: ID;
  total_rent: number;
  status: 'waiting' | 'selecting' | 'bidding' | 'completed';
  rooms: Record<ID, Omit<Room, 'id'>>;
  users: Record<ID, Omit<User, 'id'>>;
  conflicts?: Record<ID, Conflict>;
};

// The object produced by AuctionCreator component upon form submission
export type CreateData = {
  totalRent: number;
  rooms: string[];
};

// Server-side types for Firebase Functions
export interface AuctionData {
  totalRent: number;
  rooms: string[];
  users: string[];
}

export interface ServerRoom {
  id: string;
  name: string;
  price: number;
  assignedUserId?: string;
}

export interface ServerUser {
  id: string;
  name: string;
  assignedRoomId?: string;
}

export interface ServerAuction {
  id: string;
  totalRent: number;
  users: ServerUser[];
  rooms: ServerRoom[];
}

export interface ServerBid {
  userId: string;
  amount: number;
}

export interface ServerConflict {
  conflicts: string[];
  roomToUsers: Record<string, string[]>;
}

export interface AuctionState {
  assignments: Record<string, { userId: string | null; price: number }>;
}

export interface AuctionDetails {
  totalRent: number;
  status: string;
  rooms: Record<string, { name: string; basePrice: number }>;
  users: Record<string, { name: string }>;
}