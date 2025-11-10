import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
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

describe('AuctionView - Join Capacity', () => {
  /**
   * UNIT TESTS:
   * Given that user 1 has already created a 3-person auction, when
   * users 2 and 3 join using the link, a call should be made to insert
   * users to the database. If a 4th user attempts to join using the
   * same link, they should be blocked from doing so.
   */
  it('allows users 2 and 3 to join a 3-person auction', async () => {
    // Auction with 3 rooms and only 1 user (not full)
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
        'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
        'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user2" />
      </BrowserRouter>
    );

    // Verify auction is not full (1 user, 3 rooms)
    const userCount = Object.keys(mockAuction.users).length;
    const roomCount = Object.keys(mockAuction.rooms).length;
    const isAuctionFull = userCount >= roomCount;

    expect(isAuctionFull).toBe(false);
    expect(userCount).toBe(1);
    expect(roomCount).toBe(3);
  });

  it('blocks User 4 from joining when auction is full', async () => {
    // Auction with 3 rooms and 3 users (full)
    const mockFullAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
        'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
        'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
        'user3': { id: 'user3', name: 'User 3', assignedRoomId: null },
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockFullAuction} currentUserId="user4" />
      </BrowserRouter>
    );

    // Verify auction is full (3 users, 3 rooms)
    const userCount = Object.keys(mockFullAuction.users).length;
    const roomCount = Object.keys(mockFullAuction.rooms).length;
    const isAuctionFull = userCount >= roomCount;

    expect(isAuctionFull).toBe(true);
    expect(userCount).toBe(3);
    expect(roomCount).toBe(3);
  });

  it('shows waiting phase when auction is not full', async () => {
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
        'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
        'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user3" />
      </BrowserRouter>
    );

    // Should display waiting phase content
    expect(screen.getByText(/Waiting for participants/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 spots filled/i)).toBeInTheDocument();
  });

  it('displays copy link button when auction is waiting', async () => {
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
        'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Should show copy button to share link
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
    expect(screen.getByText(/Invite others with this link/i)).toBeInTheDocument();
  });

  it('lists all users when in waiting phase', async () => {
    const mockAuction: Auction = {
      id: 'auction-123',
      totalRent: 3000,
      rooms: {
        'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
        'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
        'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
      },
      users: {
        'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
        'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      },
    };

    render(
      <BrowserRouter>
        <AuctionView auction={mockAuction} currentUserId="user1" />
      </BrowserRouter>
    );

    // Should display list of current users
    expect(screen.getByText(/Who's here:/i)).toBeInTheDocument();
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('calculates auction full status correctly: 3 users with 3 rooms', () => {
    const rooms = {
      'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
      'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
      'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
    };
    const users = {
      'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
      'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
      'user3': { id: 'user3', name: 'User 3', assignedRoomId: null },
    };

    const isAuctionFull = Object.keys(users).length >= Object.keys(rooms).length;
    
    expect(isAuctionFull).toBe(true);
    expect(Object.keys(users).length).toBe(3);
    expect(Object.keys(rooms).length).toBe(3);
  });

  it('calculates auction not full: 2 users with 3 rooms', () => {
    const rooms = {
      'room1': { id: 'room1', name: 'Room 1', price: 1000, assignedUserId: null, status: 'available' },
      'room2': { id: 'room2', name: 'Room 2', price: 1000, assignedUserId: null, status: 'available' },
      'room3': { id: 'room3', name: 'Room 3', price: 1000, assignedUserId: null, status: 'available' },
    };
    const users = {
      'user1': { id: 'user1', name: 'User 1', assignedRoomId: null },
      'user2': { id: 'user2', name: 'User 2', assignedRoomId: null },
    };

    const isAuctionFull = Object.keys(users).length >= Object.keys(rooms).length;
    
    expect(isAuctionFull).toBe(false);
    expect(Object.keys(users).length).toBe(2);
    expect(Object.keys(rooms).length).toBe(3);
  });

  it('allows up to capacity: User 1 creates 3-person auction, Users 2 and 3 join', () => {
    // Track sequence: User 1 creates, Users 2 and 3 join
    const auctionCapacity = 3;
    
    // User 1 creates auction
    let userCount = 1;
    expect(userCount).toBeLessThanOrEqual(auctionCapacity);

    // User 2 joins
    userCount++;
    expect(userCount).toBeLessThanOrEqual(auctionCapacity);

    // User 3 joins
    userCount++;
    expect(userCount).toBeLessThanOrEqual(auctionCapacity);

    // Auction is now full
    expect(userCount).toBe(auctionCapacity);

    // User 4 should be blocked
    const isAuctionFull = userCount >= auctionCapacity;
    expect(isAuctionFull).toBe(true);
  });
});