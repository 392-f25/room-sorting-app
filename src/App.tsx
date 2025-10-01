import { useState } from 'react';
import { initAuction } from './utilities/auction';
import type { Auction } from './types';
import { AuctionCreator } from './components/AuctionCreator';
import { AuctionView } from './components/AuctionView';

export default function App() {
  const [auction, setAuction] = useState<Auction | null>(null);

  return (
    <div className='min-h-screen bg-slate-50 p-6'>
      <div className='max-w-3xl mx-auto'>
        <h1 className='text-3xl font-bold mb-4'>Homeslice</h1>
        {!auction ? (
          <AuctionCreator
            onCreate={(data) => {
              const a = initAuction('auction1', data.totalRent, data.rooms, data.users);
              setAuction(a);
            }}
          />
        ) : (
          <AuctionView auction={auction} />
        )}
      </div>
    </div>
  );
}
