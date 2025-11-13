import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionView } from './AuctionView.tsx';
import type { Auction } from '../types/index.ts';

vi.mock('../utilities/auction-client.ts', () => ({
  placeBid: vi.fn(() => Promise.resolve()),
  submitSelection: vi.fn(() => Promise.resolve()),
  subscribeToAuction: vi.fn(() => {
    return () => {};
  }),
  addUserToAuction: vi.fn(() => 
    Promise.resolve(`user-${Math.random().toString(36).substr(2, 9)}`)
  ),
  saveAuction: vi.fn(() => Promise.resolve('auction-123')),
}));

vi.mock('../utilities/firebaseConfig', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn((_ref, callback) => {
    // Simulate real-time bidding data
    setTimeout(() => {
      callback({
        val: () => ({ room1: { user1: 1200, user2: 1100 } }),
        exists: () => true,
      } as any);
    }, 100);
    return vi.fn();
  }),
  off: vi.fn(),
}));

describe('AuctionView - Complex Bidding Phase Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });
  /**
   * Given that multiple users are bidding on the same room,
   * when the component renders,
   * then it should display the bidding interface correctly.
   */
  it('displays bidding interface for multiple users', async () => {
    const mockBiddingAuction: Auction = {
      id: 'auction-bid',
      totalRent: 2400,
      rooms: {
        'room1': {
          id: 'room1',
          name: 'Master Bedroom',
          price: 1000,
          assignedUserId: null,
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true, 'user3': true }
        }
      },
      users: {
        'user1': { id: 'user1', name: 'Alice', assignedRoomId: null },
        'user2': { id: 'user2', name: 'Bob', assignedRoomId: null },
        'user3': { id: 'user3', name: 'Charlie', assignedRoomId: null }
      }
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockBiddingAuction} currentUserId="user3" />
      </BrowserRouter>
    );

    // Should show bidding phase
    expect(screen.getByText('Bidding phase')).toBeInTheDocument();
    expect(screen.getByText('Room: Master Bedroom')).toBeInTheDocument();

    // Should show all users in conflict
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie (You)')).toBeInTheDocument();

    // Current user should see input field and submit button
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(screen.getByText('Submit Bid')).toBeInTheDocument();
  });

  

  
  /**
   * Given that a user is viewing the bidding interface,
   * when the user submits a valid bid,
   * then the placeBid function should be called with correct parameters.
   */
  it('submits valid bids correctly', async () => {
    const { placeBid } = await import('../utilities/auction-client.ts');
    const mockBiddingAuction: Auction = {
      id: 'auction-submit',
      totalRent: 1800,
      rooms: {
        'room1': {
          id: 'room1',
          name: 'Test Room',
          price: 900,
          assignedUserId: null,
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        }
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null }
      }
    };

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionView auction={mockBiddingAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    const bidInput = screen.getByRole('spinbutton');
    const submitButton = screen.getByText('Submit Bid');

    // Submit valid bid
    await user.clear(bidInput);
    await user.type(bidInput, '1000');
    await user.click(submitButton);

    expect(placeBid).toHaveBeenCalledWith('auction-submit', 'room1', 'user1', 1000);
  });

  
  
});
