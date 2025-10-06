import { describe, it, expect } from 'vitest';
import { initAuction, assignHighestBidder, sumRoomPrices } from './auction';

describe('auction utilities', () => {
  it('assigns highest bidder to room and updates prices', () => {
    const auction = initAuction('a1', 3000, ['A', 'B', 'C'], ['Alice', 'Bob', 'Cathy']);
    // Two bids for room A
    const updated = assignHighestBidder(auction, 'r1', [
      { userId: 'u1', amount: 1200 },
      { userId: 'u2', amount: 1500 },
    ]);

    const roomA = updated.rooms.find(r => r.id === 'r1')!;
    expect(roomA.assignedUserId).toBe('u2');
    expect(roomA.price).toBeCloseTo(1500);

    // Remaining rooms should split remaining rent
    expect(sumRoomPrices(updated.rooms)).toBeCloseTo(3000);
  });

  it('sums room prices to total rent after multiple assignments', () => {
    const auction = initAuction('a1', 3000, ['A', 'B', 'C'], ['Alice', 'Bob', 'Cathy']);
    let updated = assignHighestBidder(auction, 'r1', [
      { userId: 'u1', amount: 2000 },
      { userId: 'u2', amount: 1800 },
    ]);

    updated = assignHighestBidder(updated, 'r2', [
      { userId: 'u2', amount: 600 },
    ]);

    expect(sumRoomPrices(updated.rooms)).toBeCloseTo(3000);
    // Ensure each room has a price assigned
    expect(updated.rooms.every(r => typeof r.price === 'number')).toBeTruthy();
  });

  it('allocates remaining rent correctly when one room is bid to $2000 (others should be $500 each)', () => {
    const auction = initAuction('a1', 3000, ['A', 'B', 'C'], ['Alice', 'Bob', 'Cathy']);
    const updated = assignHighestBidder(auction, 'r1', [
      { userId: 'u1', amount: 2000 },
    ]);

    const roomA = updated.rooms.find(r => r.id === 'r1')!;
    const roomB = updated.rooms.find(r => r.id === 'r2')!;
    const roomC = updated.rooms.find(r => r.id === 'r3')!;

    expect(roomA.price).toBeCloseTo(2000);
    expect(roomB.price).toBeCloseTo(500);
    expect(roomC.price).toBeCloseTo(500);
    expect(sumRoomPrices(updated.rooms)).toBeCloseTo(3000);
  });
});
