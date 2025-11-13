import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('firebase/database', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  const pushMock = vi.fn().mockImplementation(() => ({ key: 'mockedKey' }));

  return {
    ...actual,
    push: pushMock,
    ref: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    onValue: vi.fn(),
    off: vi.fn(),
  };
});

import { saveAuction } from './auction-client';
import * as firebaseDatabase from 'firebase/database';

describe('saveAuction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save and return a unique id', async () => {
    const pushMock = vi.mocked(firebaseDatabase.push);
    pushMock.mockReturnValueOnce({ key: 'auctionKey' } as never);
    pushMock.mockReturnValue({ key: 'roomKey' } as never);

    const result = await saveAuction({
      totalRent: 3000,
      rooms: ['a', 'b', 'c'],
    });

    expect(firebaseDatabase.push).toHaveBeenCalled();
    expect(result).toBe('auctionKey');
  });

  it('should set base rent of each room as total rent divided by number of rooms', async () => {
    const pushMock = vi.mocked(firebaseDatabase.push);
    pushMock.mockReturnValueOnce({ key: 'auctionKey' } as never);
    pushMock.mockReturnValue({ key: 'roomKey' } as never);

    await saveAuction({
      totalRent: 3000,
      rooms: ['a', 'b', 'c'],
    });

    const expectedBaseRent = 1000;

    expect(firebaseDatabase.set).toHaveBeenCalledWith(
      expect.any(Object), // the ref
      expect.objectContaining({
        rooms: expect.objectContaining({
          roomKey: expect.objectContaining({ price: expectedBaseRent }),
        }),
      })
    );
  });
});
