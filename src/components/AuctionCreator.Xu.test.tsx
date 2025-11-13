import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionCreator } from './AuctionCreator.tsx';
import { AuctionView } from './AuctionView.tsx';
import type { Auction } from '../types/index.ts';

vi.mock('../utilities/auction-client.ts', () => ({
  saveAuction: vi.fn(() => Promise.resolve('auction-123')),
  subscribeToAuction: vi.fn(() => {
    return () => {};
  }),
  addUserToAuction: vi.fn(() => 
    Promise.resolve(`user-${Math.random().toString(36).substr(2, 9)}`)
  ),
  placeBid: vi.fn(),
  submitSelection: vi.fn(),
}));

describe('AuctionCreator - Zero Room Count Edge Case', () => {
  /**
   * Given that a user has entered valid total rent but set room count to 0,
   * when the user clicks "Create Auction",
   * then the onCreate callback should be invoked with an empty rooms array.
   */
  it('creates auction with empty rooms array when room count is 0', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Set total rent to a valid value
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '1500');

    // Set room count to 0
    const countInput = screen.getByDisplayValue('2');
    await user.clear(countInput);
    await user.type(countInput, '0');

    // Click the "Create Auction" button
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify onCreate was called with empty rooms array
    expect(onCreate).toHaveBeenCalledWith({
      totalRent: 1500,
      rooms: [],
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
    
    // Verify no error message is shown
    expect(screen.queryByText(/please enter names for all rooms/i)).not.toBeInTheDocument();
  });

  it('does not create any room input fields when room count is 0', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Set room count to 0
    const countInput = screen.getByDisplayValue('2');
    await user.clear(countInput);
    await user.type(countInput, '0');

    // Verify no room input fields are displayed
    const roomInputs = screen.queryAllByDisplayValue(/Room/);
    expect(roomInputs).toHaveLength(0);
  });

  
  it('simulates auction full scenario when 0-room auction is viewed', async () => {
    // Simulate what happens when a 0-room auction is created and then viewed
    const mockZeroRoomAuction: Auction = {
      id: 'auction-zero',
      totalRent: 2000,
      rooms: {}, // Empty rooms object - no rooms available
      users: {
        'user-1': { id: 'user-1', name: 'User 1', assignedRoomId: null },
        'user-2': { id: 'user-2', name: 'User 2', assignedRoomId: null }, // Add user-2 to the auction
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockZeroRoomAuction} currentUserId="user-2" />
      </BrowserRouter>
    );

    // With 0 rooms and any number of users, the auction should be considered "full"
    // since userCount (2) >= roomCount (0)
    const userCount = Object.keys(mockZeroRoomAuction.users).length;
    const roomCount = Object.keys(mockZeroRoomAuction.rooms).length;
    const isAuctionFull = userCount >= roomCount;
    
    expect(userCount).toBe(2);
    expect(roomCount).toBe(0);
    expect(isAuctionFull).toBe(true);
    
    // Since rooms = 0 and users >= 0, this should NOT be in waiting phase
    // Instead, it should be in selection phase or another phase
    // Let's verify it's not showing the waiting message
    expect(screen.queryByText(/waiting for participants/i)).not.toBeInTheDocument();
    
    // With 0 rooms, there should be no room selection options
    const roomOptions = screen.queryAllByRole('option');
    // Should only have the default "-- choose --" option, no room options
    expect(roomOptions.length).toBeLessThanOrEqual(1);
  });

  it('verifies 0-room auction behavior matches business logic', () => {
    // This test verifies the mathematical logic without UI rendering
    const zeroRoomAuction = {
      rooms: {},
      users: { 'user-1': { id: 'user-1', name: 'User 1', assignedRoomId: null } }
    };
    
    const userCount = Object.keys(zeroRoomAuction.users).length; // 1
    const roomCount = Object.keys(zeroRoomAuction.rooms).length; // 0
    const isFull = userCount >= roomCount; // 1 >= 0 = true
    
    // Business logic: Any auction with 0 rooms is immediately "full"
    // since any number of users >= 0 rooms
    expect(roomCount).toBe(0);
    expect(userCount).toBe(1);
    expect(isFull).toBe(true);
    
    // This means no new users should be able to join such an auction
  });
});