
import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

// Mock firebase/database used by AuctionView
vi.mock('firebase/database', () => ({
  ref: vi.fn((_db, path) => ({ _path: path })),
  onValue: vi.fn((_refArg, cb: (snap: unknown) => void) => {
    const snapshot = { val: () => ({}) };
    cb(snapshot);
    return () => {};
  }),
  off: vi.fn(),
}));

// Mock firebase config (db)
vi.mock('../utilities/firebaseConfig.ts', () => ({ db: {} }));

import { AuctionView } from './AuctionView.tsx';
import type { Auction } from '../types/index.ts';

vi.mock('../utilities/auction-client.ts', () => ({
  placeBid: vi.fn(),
  submitSelection: vi.fn(),
}));

describe('AuctionView - Base Rent Display', () => {
  it('shows each room price as totalRent / numberOfRooms', () => {
    const totalRent = 1200;
    const roomNames = ['Room A', 'Room B', 'Room C'];
    const userNames = ['User 1', 'User 2', 'User 3'];
    const perRoom = totalRent / roomNames.length;

    const rooms = Object.fromEntries(
      roomNames.map((name, i) => [
        `room${i + 1}`,
        {
          id: `room${i + 1}`,
          name,
          price: perRoom,
          assignedUserId: null,
          status: 'available',
        },
      ])
    ) as Auction['rooms'];

    const users = Object.fromEntries(
      userNames.map((name, i) => [
        `user${i + 1}`,
        {
          id: `user${i + 1}`,
          name,
          assignedRoomId: null,
        },
      ])
    ) as Auction['users'];

    const mockAuction: Auction = {
      id: 'auction-test',
      totalRent,
      rooms,
      users,
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user-x" />
      </BrowserRouter>
    );

    roomNames.forEach((name) => {
      const nameEl = screen.getByText(name);
      const container = nameEl.parentElement;
      expect(container).toBeTruthy();
      expect(
        within(container!).getByText(`Price: $${perRoom.toFixed(2)}`)
      ).toBeInTheDocument();
    });
  });
});
