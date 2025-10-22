export type ID = string;

export type User = {
  id: ID;
  name: string;
  assignedRoomId: ID | null;
};

export type Room = {
  id: ID;
  name: string;
  price: number;
  assignedUserId: ID | null;
  status: 'available' | 'bidding' | 'assigned';
  conflictingUserIds?: {[key: ID]: true};
};

export type Auction = {
  id: ID;
  totalRent: number;
  users: {[key: ID]: User};
  rooms: {[key: ID]: Room};
};

// The object produced by AuctionCreator component upon form submission
export type CreateData = {
  totalRent: number;
  rooms: string[];
  users: string[];
};