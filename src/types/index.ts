export type ID = string;

export type User = {
  id: ID;
  name: string;
  assignedRoomId?: ID;
};

export type Room = {
  id: ID;
  name: string;
  price: number;
  assignedUserId?: ID;
};

export type Auction = {
  id: ID;
  totalRent: number;
  users: User[];
  rooms: Room[];
};
