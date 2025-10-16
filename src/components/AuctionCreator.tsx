import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { CreateData } from '../types';

// The `users` property is no longer needed at creation time.
export const AuctionCreator = ({ onCreate }: PropsWithChildren<{ onCreate: (data: Omit<CreateData, 'users'>) => void }>) => {
  const [totalRent, setTotalRent] = useState<string>('0');
  const [count, setCount] = useState<string>('2');
  const [roomNames, setRoomNames] = useState<string[]>(['Room 1', 'Room 2']);
  const [errors, setErrors] = useState<string | null>(null);

  // Keep roomNames array in sync with count
  useEffect(() => {
    const numCount = Number(count) || 0;
    setRoomNames(prev => {
      const next = prev.slice(0, numCount);
      while (next.length < numCount) next.push(`Room ${next.length + 1}`);
      return next;
    });
  }, [count]);

  const updateRoomName = (index: number, value: string) => {
    setRoomNames(prev => prev.map((v, i) => i === index ? value : v));
  };

  const handleCreate = () => {
    const numCount = Number(count) || 0;
    const rooms = roomNames.slice(0, numCount).map(s => s.trim()).filter(Boolean);
    if (rooms.length !== numCount) {
      setErrors('Please enter names for all rooms.');
      return;
    }
    const rentAsNumber = Number(totalRent);
    if (rentAsNumber <= 0) {
      setErrors('Please enter a valid total rent.');
      return;
    }
    setErrors(null);
    onCreate({ totalRent: rentAsNumber, rooms });
  };

  return (
    <div className='bg-white p-6 rounded shadow'>
      <label className='block mb-2'>Total Rent</label>
      <input className='w-full mb-4 p-2 border rounded' type='number' value={totalRent} onChange={(e) => setTotalRent(e.target.value)} />

      <label className='block mb-2'>Number of Rooms</label>
      <input className='w-24 mb-4 p-2 border rounded' type='number' min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} />

      <div>
        <div className='font-semibold mb-2'>Room Names</div>
        <div className='space-y-2'>
          {Array.from({ length: Number(count) || 0 }).map((_, i) => (
            <input key={i} className='w-full p-2 border rounded' value={roomNames[i] ?? ''} onChange={(e) => updateRoomName(i, e.target.value)} />
          ))}
        </div>
      </div>

      <button
        className='mt-4 bg-blue-600 text-white px-4 py-2 rounded'
        onClick={handleCreate}
      >
        Create Auction
      </button>
      {errors && <div className='mt-2 text-sm text-red-600'>{errors}</div>}
    </div>
  );
};
