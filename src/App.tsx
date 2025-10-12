import { useState } from 'react';
import { initAuction, saveAuction } from './utilities/auction';
import type { Auction, CreateData } from './types';
import { AuctionCreator } from './components/AuctionCreator';
import { AuctionView } from './components/AuctionView';

export default function App() {
  const [auction, setAuction] = useState<Auction | null>(null);

  const handleCreateAuction = async (data: CreateData) => {
    try {
      const {auctionId, joinCode} = await saveAuction(data);
      if (auctionId) {
        const localAuction = initAuction(
          auctionId,
          data.totalRent,
          data.rooms,
          data.users
        );
        setAuction(localAuction);
      }
    } catch (err) {
      console.error('Failed to create auction', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Homeslice</h1>
        {!auction ? (
          <AuctionCreator onCreate={handleCreateAuction} />
        ) : (
          <AuctionView auction={auction} />
        )}
      </div>
    </div>
  );
}
