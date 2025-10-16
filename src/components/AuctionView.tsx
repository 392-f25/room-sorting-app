import { useMemo, useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../utilities/firebaseConfig';
import type { Auction, Room } from '../types';
import { placeBid, submitSelection, startAuction } from '../utilities/auction-client';

export const AuctionView = ({ auction, currentUserId }: { auction: Auction, currentUserId: string }) => {
  const users = useMemo(() => Object.values(auction.users || {}).map((u, i) => ({ ...u, id: Object.keys(auction.users)[i] })), [auction.users]);
  const rooms = useMemo(() => Object.values(auction.rooms || {}).map((r, i) => ({ ...r, id: Object.keys(auction.rooms)[i] })), [auction.rooms]);

  const [selections, setSelections] = useState<Record<string, string | null>>(() => Object.fromEntries(users.map(u => [u.id, null])));
  const [realtimeSelections, setRealtimeSelections] = useState<Record<string, string>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSelection, setSubmittedSelection] = useState<string | null>(null);

  // --- DERIVE UI STATE FROM PROPS ---
  const { phase, conflictingRooms, unassignedUsers } = useMemo(() => {
    const phase = auction.status;
    const conflictingRooms = phase === 'bidding'
      ? rooms.filter(r => r.status === 'bidding')
      : [];
    const unassignedUsers = users.filter(u => !u.cur_assignment);

    return { phase, conflictingRooms, unassignedUsers };
  }, [auction, users, rooms]);

  // --- REALTIME SUBSCRIPTIONS ---

  // Reset submitted status when a new round starts
  useEffect(() => {
    setSubmittedSelection(null);
  }, [phase]);

  // Listen to real-time selections from other users
  useEffect(() => {
    if (phase !== 'selecting') return;
    const selectionsRef = ref(db, `/selections/${auction.id}`);
    const listener = onValue(selectionsRef, (snapshot) => {
      setRealtimeSelections(snapshot.val() ?? {});
    });

    return () => off(selectionsRef, 'value', listener);
  }, [auction.id, phase]);


  // --- USER ACTIONS ---

  const handleSelections = async () => {
    const userSelection = selections[currentUserId];
    if (!userSelection || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitSelection(auction.id, currentUserId, userSelection);
      setSubmittedSelection(userSelection); // Lock the UI for this round
    } catch (error) {
      console.error("Failed to submit selection:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBid = (roomId: string) => {
    const amount = Number(bidInputs[`${roomId}:${currentUserId}`] ?? 0);
    if (amount <= 0 || amount >= auction.total_rent) return;
    placeBid(auction.id, roomId, currentUserId, amount);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasSubmitted = !!submittedSelection;

  return (
    <div className='bg-white p-6 rounded shadow'>
      <h2 className='text-xl font-semibold mb-4'>Auction: {auction.id}</h2>

      {phase !== 'waiting' && (
        <div className='mb-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {rooms.map(r => (
              <div key={r.id} className='p-3 border rounded'>
                <div className='text-lg font-medium'>{r.name}</div>
                <div className='text-sm text-slate-600'>Price: ${r.cur_price.toFixed(2)}</div>
                <div className='text-sm text-slate-600'>Assigned: {r.cur_assignment ? (users.find(u => u.id === r.cur_assignment)?.name ?? r.cur_assignment) : 'None'}</div>
                {r.status === 'bidding' && <div className='text-sm font-bold text-blue-600'>Bidding Now</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'waiting' && (
        <div className='text-center'>
          <h3 className='text-xl font-semibold mb-2'>Waiting for participants...</h3>
          <p className='text-slate-600 mb-4'>
            {users.length} of {rooms.length} spots filled.
          </p>
          {users.length === rooms.length && (
            <button
              className='bg-green-600 text-white px-4 py-2 rounded mb-4'
              onClick={() => startAuction(auction.id)}
            >
              Start Auction
            </button>
          )}
          <div className='mb-6'>
            <h4 className='font-semibold mb-2'>Who's here:</h4>
            <ul className='space-y-1'>
              {users.map(u => <li key={u.id}>{u.name}</li>)}
            </ul>
          </div>
          <div>
            <label className='block font-semibold mb-2'>Invite others with this link:</label>
            <div className='flex items-center gap-2'>
              <input readOnly className='w-full p-2 border rounded bg-slate-100' value={window.location.href} />
              <button onClick={handleCopyUrl} className='px-4 py-2 bg-blue-600 text-white rounded w-28'>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'selecting' && (
        <div>
          <h3 className='font-semibold mb-2'>Select your preferred room</h3>
          <div className='space-y-4'>
            {unassignedUsers.map(user => {
              const otherUserSelectionId = realtimeSelections[user.id];
              const otherUserSelectionName = otherUserSelectionId ? rooms.find(r => r.id === otherUserSelectionId)?.name : null;

              return (
                <div key={user.id} className={`flex items-center gap-3 p-2 rounded ${user.id === currentUserId ? 'bg-blue-50' : ''}`}>
                  <div className='w-28'>{user.name} {user.id === currentUserId && '(You)'}</div>
                  {user.id === currentUserId ? (
                    <select
                      className='p-2 border rounded'
                      value={selections[user.id] ?? ''}
                      onChange={(e) => setSelections(prev => ({ ...prev, [user.id]: e.target.value || null }))}
                      disabled={isSubmitting || hasSubmitted}
                    >
                      <option value=''>-- choose --</option>
                      {rooms.filter(r => !r.cur_assignment).map(r => (
                        <option key={r.id} value={r.id}>{r.name} (${r.cur_price.toFixed(2)})</option>
                      ))}
                    </select>
                  ) : (
                    <div className='text-slate-500'>
                      {otherUserSelectionName ? <em>{otherUserSelectionName}</em> : <i>Waiting for selection...</i>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className='mt-4'>
            <button
              className='bg-green-600 text-white px-4 py-2 rounded disabled:bg-slate-400'
              onClick={handleSelections}
              disabled={isSubmitting || hasSubmitted}
            >
              {isSubmitting ? 'Submitting...' : hasSubmitted ? 'Submitted' : 'Submit Selection'}
            </button>
          </div>
        </div>
      )}

      {phase === 'bidding' && (
        <div>
          <h3 className='font-semibold mb-2'>Bidding phase</h3>
          {conflictingRooms.map(room => (
            <div key={room.id} className='mb-4 border p-3 rounded'>
              <div className='font-medium'>Room: {room.name}</div>
              <div className='space-y-2 mt-2'>
                {unassignedUsers.map(user => (
                   <div key={user.id} className={`flex items-center gap-2 p-2 rounded ${user.id === currentUserId ? 'bg-blue-50' : ''}`}>
                     <div className='w-28'>{user.name} {user.id === currentUserId && '(You)'}</div>
                     {user.id === currentUserId ? (
                        <>
                          <input className='p-2 border rounded' type='number' min='1' step='1' value={bidInputs[`${room.id}:${user.id}`] ?? ''} onChange={(e) => setBidInputs(prev => ({ ...prev, [`${room.id}:${user.id}`]: Number(e.target.value) }))} />
                          <button className='px-2 py-1 bg-blue-600 text-white rounded' onClick={() => handleBid(room.id)}>Submit Bid</button>
                        </>
                     ) : (
                      <div className='text-slate-500'><i>Bidding...</i></div>
                     )}
                   </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'completed' && (
        <div>
          <h3 className='font-semibold mb-2'>Auction Complete</h3>
          <ul>
            {users.map(u => (
              <li key={u.id}>{u.name}: {rooms.find(r => r.id === u.cur_assignment)?.name ?? 'None'} - ${rooms.find(r => r.id === u.cur_assignment)?.cur_price.toFixed(2) ?? '0.00'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
