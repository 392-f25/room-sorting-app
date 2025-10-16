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