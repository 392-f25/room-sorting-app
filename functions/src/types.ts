export type ID = string;

export type User = {
  id: ID;
  name: string;
  assignedRoomId: ID | null;
  isReady: boolean;
};

export type Room = {
  id: ID;
  name: string;
  price: number;
  assignedUserId: ID | null;
  status: 'available' | 'bidding' | 'assigned';
  conflictingUserIds?: ID[];
};

export type Auction = {
  id: ID;
  totalRent: number;
  users: {[key: ID]: User};
  rooms: {[key: ID]: Room};
  selections: {[key: ID]: ID};
  bidding: {
    [key: ID]: {
      [key: ID]: number;
    };
  };
};
