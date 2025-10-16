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
};

export type Auction = {
  id: ID;
  totalRent: number;
  users: User[];
  rooms: Room[];
};

// The object produced by AuctionCreator component upon form submission
export type CreateData = {
  totalRent: number;
  rooms: string[];
  users: string[];
};