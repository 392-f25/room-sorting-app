import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionView } from './AuctionView.tsx';
import * as auctionClient from '../utilities/auction-client.ts';
import type { Auction } from '../types';

// Mock the auction-client utilities to isolate the component
vi.mock('../utilities/auction-client.ts');

describe('AuctionView - Outbidding', () => {
  /**
   * TEST CASE:
   * A user wants to outbid another user who has already been assigned a
   * room, as their bid was uncontested. User 1 is the only one who
   * prefers room 1 at even price, User 2 (Rohan) sees the assignment
   * and wants to outbid User 1. Their preference dropdown menu includes
   * the option to outbid User 1 on room 1.
   */
  it('allows an unassigned user to challenge an assigned user', async () => {
    const user = userEvent.setup();

    // 1. Arrange: Create the specific auction state from the image
    const mockAuctionState: Auction = {
      id: 'auction-xyz',
      rent: 2000,
      status: 'selection',
      rooms: {
        'room-1': { id: 'room-1', name: 'Room 1', price: 1000, assignedUserId: 'user-1', status: 'assigned' },
        'room-2': { id: 'room-2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user-1': { id: 'user-1', name: 'User 1', assignedRoomId: 'room-1' },
        'rohan-id': { id: 'rohan-id', name: 'Rohan', assignedRoomId: null },
      },
    };

    // 2. Act: Render the component with the mock state
    // We render Rohan's view of the auction
    render(
      <BrowserRouter>
        <AuctionView auction={mockAuctionState} currentUserId="rohan-id" />
      </BrowserRouter>
    );

    // 3. Assert: Verify the UI allows Rohan to challenge
    
    // Rohan, who is unassigned, should see his selection dropdown
    const selectionDropdown = screen.getByRole('combobox');
    expect(selectionDropdown).toBeInTheDocument();

    // The dropdown should clearly show that "Room 1" is occupied by "User 1"
    const occupiedRoomOption = screen.getByRole('option', { name: /Room 1 .* Occupied by User 1/i });
    expect(occupiedRoomOption).toBeInTheDocument();

    // Simulate Rohan selecting the occupied room to challenge
    await user.selectOptions(selectionDropdown, 'room-1');

    // After selecting, the "Submit Selection" button should be available
    const submitButton = screen.getByRole('button', { name: /submit selection/i });
    await user.click(submitButton);

    // Verify that the challenge was submitted by calling the correct client function
    expect(auctionClient.submitSelection).toHaveBeenCalledWith('auction-xyz', 'rohan-id', 'room-1');
  });
});
