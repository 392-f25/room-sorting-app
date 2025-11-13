import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionView } from './AuctionView.tsx';
import type { Auction } from '../types/index.ts';

describe('AuctionView - Waiting Phase', () => {
  /**
   * TEST CASE:
   * Given an auction is in the "waiting for participants" phase,
   * when the user clicks the "Copy" button, the button's text
   * should change to "Copied!" to provide feedback.
   */
  it('shows "Copied!" message when the invite link is copied', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    // 1. Arrange: Set up an auction in the waiting phase (1 user, 2 rooms)
    const mockAuctionState: Auction = {
      id: 'auction-wait',
      rent: 2000,
      status: 'selection',
      rooms: {
        'room-1': { id: 'room-1', name: 'Room A', price: 1000, assignedUserId: null, status: 'available' },
        'room-2': { id: 'room-2', name: 'Room B', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user-1': { id: 'user-1', name: 'User 1', assignedRoomId: null },
      },
    };

    // 2. Act: Render the component and click the copy button
    render(
      <BrowserRouter>
        <AuctionView auction={mockAuctionState} currentUserId="user-1" />
      </BrowserRouter>
    );

    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);

    // 3. Assert: Verify the behavior
    
    // Check that the clipboard function was called with the correct link
    expect(writeTextSpy).toHaveBeenCalledWith(window.location.href);

    // Check that the button text changes to "Copied!" immediately after click
    expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument();
  });
});
