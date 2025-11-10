import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { AuctionCreator } from './AuctionCreator.tsx';

vi.mock('../utilities/auction-client.ts', () => ({
  saveAuction: vi.fn(() => Promise.resolve('auction-123')),
}));

describe('AuctionCreator - Test button functionality', () => {
  /**
   * UNIT TEST:
   * Given that a group of users wants to create an auction, when a user
   * clicks "Create Auction", a unique link should be generated and
   * displayed on the app.
   */
  it('allows user to create an auction', async () => {
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
    await user.type(rentInput, '1200');

    // Keep default room count (2) and names (Room 1, Room 2)

    // Click the "Create Auction" button
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify onCreate was called with correct data
    expect(onCreate).toHaveBeenCalledWith({
      totalRent: 1200,
      rooms: ['Room 1', 'Room 2'],
    });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows error when total rent is invalid', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Try to create auction without changing rent (remains 0, which is invalid)
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify error message appears
    expect(screen.getByText(/please enter a valid total rent/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows error when room names are empty', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Set valid rent
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '1200');

    // Clear room names
    const roomInputs = screen.getAllByDisplayValue(/Room/);
    for (const input of roomInputs) {
      await user.clear(input);
    }

    // Try to create auction
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify error message appears
    expect(screen.getByText(/please enter names for all rooms/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('updates room names when room count changes', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Change room count from 2 to 3
    const countInput = screen.getByDisplayValue('2');
    await user.clear(countInput);
    await user.type(countInput, '3');

    // Verify 3 room inputs are now visible
    const roomInputs = screen.getAllByDisplayValue(/Room/);
    expect(roomInputs).toHaveLength(3);
  });

  it('allows custom room names', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Set valid rent
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '3000');

    // Update room names
    const roomInputs = screen.getAllByDisplayValue(/Room/);
    await user.clear(roomInputs[0]);
    await user.type(roomInputs[0], 'Master Bedroom');
    await user.clear(roomInputs[1]);
    await user.type(roomInputs[1], 'Living Room');

    // Create auction
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify onCreate was called with custom names
    expect(onCreate).toHaveBeenCalledWith({
      totalRent: 3000,
      rooms: ['Master Bedroom', 'Living Room'],
    });
  });
});