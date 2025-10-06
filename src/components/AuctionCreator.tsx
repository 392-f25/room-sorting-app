import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

type CreateData = {
  totalRent: number;
  rooms: string[];
  users: string[];
};

export const AuctionCreator = ({ onCreate }: PropsWithChildren<{ onCreate: (data: CreateData) => void }>) => {
  const [totalRent, setTotalRent] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [roomNames, setRoomNames] = useState<string[]>(['Room 1', 'Room 2']);
  const [userNames, setUserNames] = useState<string[]>(['', '']);

  // Keep arrays in sync with count
  useEffect(() => {
    setRoomNames(prev => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(`Room ${next.length + 1}`);
      return next;
    });
    setUserNames(prev => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(`${next.length + 1}`);
      return next;
    });
  }, [count]);

  const updateRoomName = (index: number, value: string) => {
    setRoomNames(prev => prev.map((v, i) => i === index ? value : v));
  };

  const updateUserName = (index: number, value: string) => {
    setUserNames(prev => prev.map((v, i) => i === index ? value : v));
  };

  const handleCreate = () => {
    // ensure lengths match
    const rooms = roomNames.slice(0, count).map(s => s.trim()).filter(Boolean);
    const users = userNames.slice(0, count).map(s => s.trim()).filter(Boolean);
    if (rooms.length !== users.length || rooms.length !== count) {
      // basic validation: require all names
      setErrors('Please enter names for all rooms and users');
      return;
    }
    onCreate({ totalRent, rooms, users });
  };

  const [errors, setErrors] = useState<string | null>(null);

  return (
    <div className='bg-white p-6 rounded shadow'>
      <label className='block mb-2'>Total Rent</label>
      <input className='w-full mb-4 p-2 border rounded' value={totalRent} onChange={(e) => setTotalRent(Number(e.target.value))} />

      <label className='block mb-2'>Number of Rooms / Users</label>
      <input className='w-24 mb-4 p-2 border rounded' type='number' min={1} max={10} value={count} onChange={(e) => setCount(Math.max(0, Number(e.target.value) || 0))} />

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
        <div>
          <div className='font-semibold mb-2'>Room Names</div>
          <div className='space-y-2'>
            {Array.from({ length: count }).map((_, i) => (
              <input key={i} className='w-full p-2 border rounded' value={roomNames[i] ?? ''} onChange={(e) => updateRoomName(i, e.target.value)} />
            ))}
          </div>
        </div>
        <div>
          <div className='font-semibold mb-2'>User Names</div>
          <div className='space-y-2'>
            {Array.from({ length: count }).map((_, i) => (
              <input key={i} className='w-full p-2 border rounded' value={userNames[i] ?? ''} onChange={(e) => updateUserName(i, e.target.value)} />
            ))}
          </div>
        </div>
      </div>

      <button
        className='bg-blue-600 text-white px-4 py-2 rounded'
        onClick={handleCreate}
      >
        Create Auction
      </button>
      {errors && <div className='mt-2 text-sm text-red-600'>{errors}</div>}
    </div>
  );
};
