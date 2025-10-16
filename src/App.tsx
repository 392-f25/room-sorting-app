import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuctionCreator } from './components/AuctionCreator';
import { AuctionView } from './components/AuctionView';
import { saveAuction, subscribeToAuction, addUserToAuction } from './utilities/auction-client';
import type { Auction, CreateData } from './types';

// 1. Home Page Component
const HomePage = () => {
  const navigate = useNavigate();

  const handleCreateAuction = async (data: Omit<CreateData, 'users'>) => {
    try {
      const newAuctionId = await saveAuction(data);
      navigate(`/auction/${newAuctionId}`);
    } catch (err) {
      console.error('Failed to create auction', err);
    } 
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Homeslice</h1>
      <AuctionCreator onCreate={handleCreateAuction} />
    </div>
  );
};

// 2. Auction Room Page Component (Full Implementation)
const AuctionRoomPage = () => {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!auctionId) return;

    // Check if user has already joined this auction
    const storedUserId = localStorage.getItem(`auction-user-${auctionId}`);
    if (storedUserId) {
      setUserId(storedUserId);
    }

    const unsubscribe = subscribeToAuction(auctionId, setAuction);
    return () => unsubscribe();
  }, [auctionId]);

  const handleJoin = async () => {
    if (!auctionId || !userName.trim()) return;
    try {
      const newUserId = await addUserToAuction(auctionId, userName.trim());
      localStorage.setItem(`auction-user-${auctionId}`, newUserId);
      setUserId(newUserId);
    } catch (error) {
      console.error("Failed to join auction:", error);
    }
  };

  if (!auction) {
    return <div>Loading Auction...</div>;
  }

  const isAuctionFull = auction.users.length >= auction.rooms.length;

  // If user is not yet registered for this auction, decide what to show
  if (!userId) {
    if (isAuctionFull) {
      return (
        <div className="max-w-sm mx-auto bg-white p-6 rounded shadow text-center">
          <h2 className="text-xl font-semibold mb-4">Auction Full</h2>
          <p>Sorry, this auction already has the maximum number of participants.</p>
        </div>
      );
    }

    return (
      <div className="max-w-sm mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Join Auction</h2>
        <p className="mb-4">Welcome! Please enter your name to join.</p>
        <input
          className="w-full p-2 border rounded mb-4"
          placeholder="Your Name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
        <button
          className="w-full bg-blue-600 text-white px-4 py-2 rounded"
          onClick={handleJoin}
        >
          Join
        </button>
      </div>
    );
  }

  // User is registered, show the auction view
  return <AuctionView auction={auction} currentUserId={userId} />;
};

// 3. Main App component with routes
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auction/:auctionId" element={<AuctionRoomPage />} />
      </Routes>
    </div>
  );
}
