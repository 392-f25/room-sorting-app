import { useMemo, useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../utilities/firebaseConfig';
import type { Auction } from '../types';
import { placeBid, submitSelection } from '../utilities/auction-client';

// A helper type to include the status from our assumed backend logic
type RoomWithStatus = Auction['rooms'][0] & {
  status?: string;
  conflictingUserIds?: {[key: string]: true};
};

export const AuctionView = ({ auction, currentUserId }: { auction: Auction, currentUserId: string }) => {
  const [selections, setSelections] = useState<Record<string, string | null>>(() => Object.fromEntries(Object.keys(auction.users || {}).map(uid => [uid, null])));
  const [realtimeSelections, setRealtimeSelections] = useState<Record<string, string>>({});
  const [realtimeBids, setRealtimeBids] = useState<Record<string, Record<string, number>>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DERIVE UI STATE FROM PROPS ---
  const { phase, conflictingRooms, unassignedUsers } = useMemo(() => {
    const usersArray = Object.values(auction.users || {});
    const roomsArray = Object.values(auction.rooms || {});

    const isFull = usersArray.length >= roomsArray.length;
    if (!isFull) {
      return { phase: 'waiting', conflictingRooms: [], unassignedUsers: [] };
    }

    const isDone = usersArray.every(u => u.assignedRoomId);
    if (isDone) {
      return { phase: 'done', conflictingRooms: [], unassignedUsers: [] };
    }

    const biddingRooms = roomsArray.filter(r => (r as RoomWithStatus).status === 'bidding');
    if (biddingRooms.length > 0) {
      return { phase: 'bid', conflictingRooms: biddingRooms, unassignedUsers: [] };
    }

    const users = usersArray.filter(u => !u.assignedRoomId);
    return { phase: 'select', conflictingRooms: [], unassignedUsers: users };
  }, [auction]);

  // --- REALTIME SUBSCRIPTIONS ---

  // Listen to real-time selections from other users
  useEffect(() => {
    if (phase !== 'select') {
      setRealtimeSelections({}); // Clear selections when not in select phase
      return;
    }
    const selectionsRef = ref(db, `auctions/${auction.id}/selections`);
    const listener = onValue(selectionsRef, (snapshot) => {
      setRealtimeSelections(snapshot.val() ?? {});
    });

    return () => off(selectionsRef, 'value', listener);
  }, [auction.id, phase]);

  // Listen to real-time bids from other users
  useEffect(() => {
    if (phase !== 'bid') {
      setRealtimeBids({});
      return;
    }
    const biddingRef = ref(db, `auctions/${auction.id}/bidding`);
    const listener = onValue(biddingRef, (snapshot) => {
      setRealtimeBids(snapshot.val() ?? {});
    });

    return () => off(biddingRef, 'value', listener);
  }, [auction.id, phase]);


  // --- USER ACTIONS ---

  const handleSelections = async () => {
    const userSelection = selections[currentUserId];
    if (!userSelection || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitSelection(auction.id, currentUserId, userSelection);
    } catch (error) {
      console.error("Failed to submit selection:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBid = (roomId: string) => {
    const amount = Number(bidInputs[`${roomId}:${currentUserId}`] ?? 0);
    if (amount <= 0 || amount >= auction.totalRent) return;
    placeBid(auction.id, roomId, currentUserId, amount);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasSubmitted = realtimeSelections.hasOwnProperty(currentUserId);

  return (
    <div className='bg-white p-6 rounded shadow'>
      <h2 className='text-xl font-semibold mb-4'>Auction: {auction.id}</h2>

      {phase !== 'waiting' && (
        <div className='mb-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {Object.values(auction.rooms || {}).map(r => (
              <div key={r.id} className='p-3 border rounded'>
                <div className='text-lg font-medium'>{r.name}</div>
                <div className='text-sm text-slate-600'>Price: ${r.price.toFixed(2)}</div>
                <div className='text-sm text-slate-600'>Assigned: {r.assignedUserId ? (auction.users[r.assignedUserId]?.name ?? r.assignedUserId) : 'None'}</div>
                {(r as RoomWithStatus).status === 'bidding' && <div className='text-sm font-bold text-blue-600'>Bidding Now</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'waiting' && (
        <div className='text-center'>
          <h3 className='text-xl font-semibold mb-2'>Waiting for participants...</h3>
          <p className='text-slate-600 mb-4'>
            {Object.keys(auction.users || {}).length} of {Object.keys(auction.rooms || {}).length} spots filled.
          </p>
          <div className='mb-6'>
            <h4 className='font-semibold mb-2'>Who's here:</h4>
            <ul className='space-y-1'>
              {Object.values(auction.users || {}).map(u => <li key={u.id}>{u.name}</li>)}
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

      {phase === 'select' && (
        <div>
          <h3 className='font-semibold mb-2'>Select your preferred room</h3>
          <div className='space-y-4'>
            {unassignedUsers.map(user => {
              const otherUserSelectionId = realtimeSelections[user.id];
              const otherUserSelectionName = otherUserSelectionId ? auction.rooms[otherUserSelectionId]?.name : null;

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
                      {Object.values(auction.rooms || {}).filter(r => !r.assignedUserId).map(r => (
                        <option key={r.id} value={r.id}>{r.name} (${r.price.toFixed(2)})</option>
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

      {phase === 'bid' && (
        <div>
          <h3 className='font-semibold mb-2'>Bidding phase</h3>
          {conflictingRooms.map(room => {
            const usersInConflict = Object.values(auction.users || {}).filter(u => room.conflictingUserIds?.[u.id]);

            return (
              <div key={room.id} className='mb-4 border p-3 rounded'>
                <div className='font-medium'>Room: {room.name}</div>
                <div className='space-y-2 mt-2'>
                  {usersInConflict.map(user => {
                    const hasUserBid = realtimeBids[room.id]?.[user.id] !== undefined;

                    return (
                     <div key={user.id} className={`flex items-center gap-2 p-2 rounded ${user.id === currentUserId ? 'bg-blue-50' : ''}`}>
                       <div className='w-28'>{user.name} {user.id === currentUserId && '(You)'}</div>
                       {user.id === currentUserId ? (
                          <>
                            <input
                              className='p-2 border rounded'
                              type='number'
                              min='1'
                              step='1'
                              value={bidInputs[`${room.id}:${user.id}`] ?? ''}
                              onChange={(e) => setBidInputs(prev => ({ ...prev, [`${room.id}:${user.id}`]: Number(e.target.value) }))}
                              disabled={hasUserBid}
                            />
                            <button
                              className='px-2 py-1 bg-blue-600 text-white rounded disabled:bg-slate-400'
                              onClick={() => handleBid(room.id)}
                              disabled={hasUserBid}
                            >
                              {hasUserBid ? 'Submitted' : 'Submit Bid'}
                            </button>
                          </>
                       ) : (
                        <div className='text-slate-500'>
                          {hasUserBid ? <em>Bid Submitted</em> : <i>Bidding...</i>}
                        </div>
                       )}
                     </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {phase === 'done' && (
        <div>
          <h3 className='font-semibold mb-2'>Auction Complete</h3>
          <ul>
            {Object.values(auction.users || {}).map(u => (
              <li key={u.id}>{u.name}: {u.assignedRoomId ? auction.rooms[u.assignedRoomId]?.name : 'None'} - ${u.assignedRoomId ? auction.rooms[u.assignedRoomId]?.price.toFixed(2) : '0.00'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
