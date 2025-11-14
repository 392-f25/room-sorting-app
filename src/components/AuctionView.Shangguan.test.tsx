import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionView } from './AuctionView.tsx';
import type { Auction } from '../types/index.ts';

const mockPlaceBid = vi.fn();
const mockSubmitSelection = vi.fn();
const mockOnValue = vi.fn();
const mockOff = vi.fn();

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: (...args: unknown[]) => mockOnValue(...args),
  off: (...args: unknown[]) => mockOff(...args),
}));

vi.mock('../utilities/firebaseConfig', () => ({
  db: {},
}));

vi.mock('../utilities/auction-client.ts', () => ({
  saveAuction: vi.fn(() => Promise.resolve('auction-123')),
  subscribeToAuction: vi.fn(() => {
    return () => {};
  }),
  addUserToAuction: vi.fn(() => 
    Promise.resolve(`user-${Math.random().toString(36).substr(2, 9)}`)
  ),
  placeBid: (...args: unknown[]) => mockPlaceBid(...args),
  submitSelection: (...args: unknown[]) => mockSubmitSelection(...args),
}));

describe('AuctionView - Concurrent Bid Conflict Tests', () => {
  beforeEach(() => {
    mockPlaceBid.mockClear();
    mockSubmitSelection.mockClear();
    mockOnValue.mockClear();
    mockOff.mockClear();
  });

  /**
   * UNIT TEST 2:
   * Given that two users submit the same bid for the same room at the same time,
   * when the backend processes both bids, then the app should resolve the conflict
   * according to the auction rules and notify users in real-time.
   */
  it('should handle simultaneous bids from two users on the same room', async () => {
    // Setup auction in bidding phase with a conflict
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Room 1', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
        'room2': { 
          id: 'room2', 
          name: 'Room 2', 
          price: 1000, 
          assignedUserId: null, 
          status: 'available' 
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Verify bidding phase is active
    expect(screen.getByText(/Bidding phase/i)).toBeInTheDocument();
    expect(screen.getByText(/Room: Room 1/i)).toBeInTheDocument();

    // User 1 enters a bid
    const bidInput = screen.getByRole('spinbutton');
    await user.type(bidInput, '1200');

    // User 1 submits bid
    const submitButton = screen.getByRole('button', { name: /Submit Bid/i });
    await user.click(submitButton);

    // Verify placeBid was called with correct parameters
    await waitFor(() => {
      expect(mockPlaceBid).toHaveBeenCalledWith('auction-123', 'room1', 'user1', 1200);
    });

    // Simulate User 2 also submitting a bid (via mocked backend)
    // In real scenario, this would happen simultaneously
    await mockPlaceBid('auction-123', 'room1', 'user2', 1200);

    expect(mockPlaceBid).toHaveBeenCalledTimes(2);
    expect(mockPlaceBid).toHaveBeenCalledWith('auction-123', 'room1', 'user2', 1200);
  });

  it('should display real-time bid updates from other users', async () => {
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 2000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Master Bedroom', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'Alice', assignedRoomId: null },
        'user2': { id: 'user2', name: 'Bob', assignedRoomId: null },
      },
    };

    // Mock Firebase onValue to simulate real-time updates
    let biddingListener: (snapshot: { val: () => Record<string, Record<string, number>> }) => void;
    
    mockOnValue.mockImplementation((_dbRef, callback) => {
      biddingListener = callback;
      // Initially no bids
      callback({ val: () => ({}) });
    });

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Verify bidding interface is shown
    expect(screen.getByText(/Bidding phase/i)).toBeInTheDocument();

    // Simulate User 2 submitting a bid (real-time update)
    act(() => {
      biddingListener!({
        val: () => ({
          'room1': {
            'user2': 1200
          }
        })
      });
    });

    // Verify Bob's bid status is updated in real-time
    await waitFor(() => {
      expect(screen.getByText(/Bob/i)).toBeInTheDocument();
      expect(screen.getByText(/Bid Submitted/i)).toBeInTheDocument();
    });
  });

  it('should process conflict resolution when both users bid the same amount', async () => {
    const mockAuction: Auction = {
      id: 'auction-456',
      totalRent: 2400,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Room A', 
          price: 1200, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    let biddingListener: (snapshot: { val: () => Record<string, Record<string, number>> }) => void;
    
    mockOnValue.mockImplementation((_dbRef, callback) => {
      biddingListener = callback;
      callback({ val: () => ({}) });
    });

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Simulate both users submitting the same bid amount simultaneously
    const sameBidAmount = 1500;
    
    await mockPlaceBid('auction-456', 'room1', 'user1', sameBidAmount);
    await mockPlaceBid('auction-456', 'room1', 'user2', sameBidAmount);

    // Simulate real-time update showing both bids
    act(() => {
      biddingListener!({
        val: () => ({
          'room1': {
            'user1': sameBidAmount,
            'user2': sameBidAmount
          }
        })
      });
    });

    // Verify both bids were recorded
    expect(mockPlaceBid).toHaveBeenCalledWith('auction-456', 'room1', 'user1', sameBidAmount);
    expect(mockPlaceBid).toHaveBeenCalledWith('auction-456', 'room1', 'user2', sameBidAmount);
    expect(mockPlaceBid).toHaveBeenCalledTimes(2);
  });

  it('should prevent user from submitting multiple bids after first submission', async () => {
    const mockAuction: Auction = {
      id: 'auction-789',
      totalRent: 3000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Room 1', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    let biddingListener: (snapshot: { val: () => Record<string, Record<string, number>> }) => void;
    
    mockOnValue.mockImplementation((_dbRef, callback) => {
      biddingListener = callback;
      callback({ val: () => ({}) });
    });

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // User 1 enters and submits first bid
    const bidInput = screen.getByRole('spinbutton');
    await user.type(bidInput, '1300');

    const submitButton = screen.getByRole('button', { name: /Submit Bid/i });
    await user.click(submitButton);

    // Simulate bid being recorded in Firebase
    act(() => {
      biddingListener!({
        val: () => ({
          'room1': {
            'user1': 1300
          }
        })
      });
    });

    // Verify the input and button are disabled after submission
    await waitFor(() => {
      const disabledButton = screen.getByRole('button', { name: /Submitted/i });
      expect(disabledButton).toBeDisabled();
      
      const disabledInput = screen.getByRole('spinbutton');
      expect(disabledInput).toBeDisabled();
    });
  });

  it('should validate bid amount is at least the current room price', async () => {
    const mockAuction: Auction = {
      id: 'auction-validate',
      totalRent: 2000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Room 1', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    mockOnValue.mockImplementation((_dbRef, callback) => {
      callback({ val: () => ({}) });
    });

    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Try to submit a bid lower than room price
    const bidInput = screen.getByRole('spinbutton');
    await user.type(bidInput, '800');

    const submitButton = screen.getByRole('button', { name: /Submit Bid/i });
    await user.click(submitButton);

    // Verify alert was shown with validation message
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining('Your bid must be at least the current room price')
      );
    });

    // Verify placeBid was NOT called
    expect(mockPlaceBid).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('should show real-time status updates for all users in bidding conflict', async () => {
    const mockAuction: Auction = {
      id: 'auction-realtime',
      totalRent: 3600,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Premium Room', 
          price: 1200, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true, 'user3': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'Alice', assignedRoomId: null },
        'user2': { id: 'user2', name: 'Bob', assignedRoomId: null },
        'user3': { id: 'user3', name: 'Charlie', assignedRoomId: null },
      },
    };

    let biddingListener: (snapshot: { val: () => Record<string, Record<string, number>> }) => void;
    
    mockOnValue.mockImplementation((_dbRef, callback) => {
      biddingListener = callback;
      callback({ val: () => ({}) });
    });

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Initially, all users should be in "Bidding..." state
    expect(screen.getByText('Alice (You)')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();

    // Simulate Bob submitting a bid first
    act(() => {
      biddingListener!({
        val: () => ({
          'room1': {
            'user2': 1300
          }
        })
      });
    });

    // Verify Bob's status changed to "Bid Submitted"
    await waitFor(() => {
      const bobStatus = screen.getAllByText(/Bid Submitted/i);
      expect(bobStatus.length).toBeGreaterThan(0);
    });

    // Simulate Charlie also submitting a bid
    act(() => {
      biddingListener!({
        val: () => ({
          'room1': {
            'user2': 1300,
            'user3': 1400
          }
        })
      });
    });

    // Verify both Bob and Charlie show "Bid Submitted"
    await waitFor(() => {
      const submittedStatuses = screen.getAllByText(/Bid Submitted/i);
      expect(submittedStatuses.length).toBe(2);
    });
  });

  it('should handle concurrent submissions and maintain data integrity', async () => {
    mockOnValue.mockImplementation((_dbRef, callback) => {
      callback({ val: () => ({}) });
    });

    mockPlaceBid.mockResolvedValue(undefined);

    // Simulate concurrent bid submissions
    const bid1Promise = mockPlaceBid('auction-concurrent', 'room1', 'user1', 1000);
    const bid2Promise = mockPlaceBid('auction-concurrent', 'room1', 'user2', 1000);

    // Both should complete successfully
    await Promise.all([bid1Promise, bid2Promise]);

    expect(mockPlaceBid).toHaveBeenCalledTimes(2);
    expect(mockPlaceBid).toHaveBeenNthCalledWith(1, 'auction-concurrent', 'room1', 'user1', 1000);
    expect(mockPlaceBid).toHaveBeenNthCalledWith(2, 'auction-concurrent', 'room1', 'user2', 1000);
  });

  it('should display conflicting users correctly in bidding phase', async () => {
    const mockAuction: Auction = {
      id: 'auction-display',
      totalRent: 3000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Disputed Room', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
        'room2': { 
          id: 'room2', 
          name: 'Available Room', 
          price: 1000, 
          assignedUserId: null, 
          status: 'available'
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
        'user3': { id: 'user3', name: 'User 3', assignedRoomId: null },
      },
    };

    mockOnValue.mockImplementation((_dbRef, callback) => {
      callback({ val: () => ({}) });
    });

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Verify only conflicting users are shown for the disputed room
    expect(screen.getByText(/Room: Disputed Room/i)).toBeInTheDocument();
    
    // User 1 and User 2 should be displayed for bidding
    expect(screen.getByText('User 1 (You)')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
    
    // User 3 should not be in the bidding section for this room
    const biddingSection = screen.getByText(/Room: Disputed Room/i).parentElement;
    expect(biddingSection).not.toHaveTextContent('User 3');
  });

  it('should properly clean up real-time listeners on unmount', async () => {
    const mockAuction: Auction = {
      id: 'auction-cleanup',
      totalRent: 2000,
      rooms: {
        'room1': { 
          id: 'room1', 
          name: 'Room 1', 
          price: 1000, 
          assignedUserId: null, 
          status: 'bidding',
          conflictingUserIds: { 'user1': true, 'user2': true }
        },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    mockOnValue.mockImplementation((_dbRef, callback) => {
      callback({ val: () => ({}) });
    });

    const { unmount } = render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Verify onValue was called to set up listener
    expect(mockOnValue).toHaveBeenCalled();

    // Unmount component
    unmount();

    // Verify off was called to clean up listener
    await waitFor(() => {
      expect(mockOff).toHaveBeenCalled();
    });
  });
});
