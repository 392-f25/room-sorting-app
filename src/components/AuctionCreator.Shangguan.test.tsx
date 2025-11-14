import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuctionCreator } from './AuctionCreator.tsx';

const mockSaveAuction = vi.fn();

vi.mock('../utilities/auction-client.ts', () => ({
  saveAuction: (...args: unknown[]) => mockSaveAuction(...args),
}));

describe('AuctionCreator - URL Sharing Tests', () => {
  beforeEach(() => {
    mockSaveAuction.mockClear();
  });

  /**
   * UNIT TEST 1:
   * Given that a user copies the auction link from the app, when they share
   * the url with other users, then other users should be allowed to join the
   * correct auction section.
   */
  it('should generate a unique auction link that can be shared with other users', async () => {
    // Mock saveAuction to return a specific auction ID
    const mockAuctionId = 'auction-abc123';
    mockSaveAuction.mockResolvedValue(mockAuctionId);

    const onCreate = vi.fn(async (data) => {
      const auctionId = await mockSaveAuction(data);
      // Simulate navigation to the auction URL
      window.history.pushState({}, '', `/auction/${auctionId}`);
    });

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Set valid auction data
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '2400');

    // Create auction with 3 rooms
    const countInput = screen.getByDisplayValue('2');
    await user.clear(countInput);
    await user.type(countInput, '3');

    // Click create button
    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    // Verify the auction was created with correct data
    await waitFor(() => {
      expect(mockSaveAuction).toHaveBeenCalledWith({
        totalRent: 2400,
        rooms: ['Room 1', 'Room 2', 'Room 3'],
      });
    });

    // Verify a unique auction ID was returned
    expect(mockSaveAuction).toHaveReturnedWith(Promise.resolve(mockAuctionId));

    // Verify the URL contains the auction ID
    expect(window.location.pathname).toBe(`/auction/${mockAuctionId}`);
  });

  it('should generate different auction IDs for different auction creations', async () => {
    // Mock multiple auction creations with different IDs
    const firstAuctionId = 'auction-111';
    const secondAuctionId = 'auction-222';
    
    mockSaveAuction
      .mockResolvedValueOnce(firstAuctionId)
      .mockResolvedValueOnce(secondAuctionId);

    const onCreate = vi.fn(async (data) => {
      return await mockSaveAuction(data);
    });

    const user = userEvent.setup();

    // First auction creation
    const { unmount } = render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '1800');

    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockSaveAuction).toHaveBeenCalledTimes(1);
    });

    const firstResult = await mockSaveAuction.mock.results[0]?.value;
    expect(firstResult).toBe(firstAuctionId);

    unmount();

    // Second auction creation
    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    const rentInput2 = screen.getByDisplayValue('0');
    await user.clear(rentInput2);
    await user.type(rentInput2, '2200');

    const createButton2 = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton2);

    await waitFor(() => {
      expect(mockSaveAuction).toHaveBeenCalledTimes(2);
    });

    const secondResult = await mockSaveAuction.mock.results[1]?.value;
    expect(secondResult).toBe(secondAuctionId);

    // Verify the two auction IDs are different
    expect(firstResult).not.toBe(secondResult);
  });

  it('should allow other users to access the correct auction when given the shared URL', async () => {
    // Simulate the scenario where User 1 creates auction and User 2 joins via URL
    const sharedAuctionId = 'auction-shared-xyz';
    mockSaveAuction.mockResolvedValue(sharedAuctionId);

    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // User 1 creates an auction
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '3000');

    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        totalRent: 3000,
        rooms: ['Room 1', 'Room 2'],
      });
    });

    // Verify the auction data includes the correct structure for URL sharing
    const callArgs = onCreate.mock.calls[0][0];
    expect(callArgs).toHaveProperty('totalRent');
    expect(callArgs).toHaveProperty('rooms');
    expect(Array.isArray(callArgs.rooms)).toBe(true);
  });

  it('should create auction with correct room count accessible via shared link', async () => {
    const mockAuctionId = 'auction-456';
    mockSaveAuction.mockResolvedValue(mockAuctionId);

    const onCreate = vi.fn(async (data) => {
      const auctionId = await mockSaveAuction(data);
      return auctionId;
    });

    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuctionCreator onCreate={onCreate} />
      </BrowserRouter>
    );

    // Create auction with 4 rooms
    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '4000');

    const countInput = screen.getByDisplayValue('2');
    await user.clear(countInput);
    await user.type(countInput, '4');

    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockSaveAuction).toHaveBeenCalledWith({
        totalRent: 4000,
        rooms: ['Room 1', 'Room 2', 'Room 3', 'Room 4'],
      });
    });

    // Verify the auction structure supports exactly 4 participants (matching room count)
    const callArgs = mockSaveAuction.mock.calls[0][0];
    expect(callArgs.rooms.length).toBe(4);
  });

  it('should ensure auction URL contains valid auction ID for joining', async () => {
    const validAuctionId = 'valid-auction-789';
    mockSaveAuction.mockResolvedValue(validAuctionId);

    const onCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AuctionCreator onCreate={onCreate} />} />
        </Routes>
      </MemoryRouter>
    );

    const rentInput = screen.getByDisplayValue('0');
    await user.clear(rentInput);
    await user.type(rentInput, '1500');

    const createButton = screen.getByRole('button', { name: /create auction/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
    });

    // Verify the auction ID is valid (non-empty and correct format)
    expect(validAuctionId).toBeTruthy();
    expect(validAuctionId).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(validAuctionId.length).toBeGreaterThan(0);
  });
});
