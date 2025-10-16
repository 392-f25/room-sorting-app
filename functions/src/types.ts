export interface AuctionData {
  totalRent: number;
  rooms: string[];
  users: string[];
}

export interface Room {
  id: string;
  name: string;
  price: number;
  assignedUserId?: string;
}

export interface User {
  id: string;
  name: string;
  assignedRoomId?: string;
}

export interface Auction {
  id: string;
  totalRent: number;
  users: User[];
  rooms: Room[];
}

export interface Bid {
  userId: string;
  amount: number;
}

export interface Conflict {
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
