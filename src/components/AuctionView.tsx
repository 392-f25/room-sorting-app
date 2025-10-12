import { useMemo, useState } from 'react';
import type { Auction } from '../types';
import { detectConflicts, applySelections, assignHighestBidder } from '../utilities/auction';

export const AuctionView = ({ auction: initialAuction }: { auction: Auction }) => {
  const [auction, setAuction] = useState(initialAuction);
  const [selections, setSelections] = useState<Record<string, string | null>>(() => Object.fromEntries(initialAuction.users.map(u => [u.id, null])));
  const [phase, setPhase] = useState<'select' | 'bid' | 'done'>('select');
  const [selectIndex, setSelectIndex] = useState(0); // stepper for privacy
  const [conflictingRoomIds, setConflictingRoomIds] = useState<string[]>([]);
  const [currentBids, setCurrentBids] = useState<Record<string, { userId: string; amount: number; submitted?: boolean }[]>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, number>>({});
  const [tieWarnings, setTieWarnings] = useState<Record<string, string | null>>({});

  const conflicts = useMemo(() => detectConflicts(auction, selections), [auction, selections]);
  const currentUser = auction.users[selectIndex];

  // Stepper for private selection
  const handleSelectRoom = () => {
    if (!selections[currentUser.id]) return;
    if (selectIndex < auction.users.length - 1) {
      setSelectIndex(selectIndex + 1);
    } else {
      startResolve();
    }
  };

  const startResolve = () => {
    const c = conflicts.conflicts;
    if (c.length === 0) {
      // apply unique selections and check if all assigned
      const applied = applySelections(auction, selections);
      setAuction(applied);
      const allAssigned = applied.users.every(u => u.assignedRoomId);
      if (allAssigned) setPhase('done');
      else {
        // reset selections for next round (only unassigned users choose)
        setSelectIndex(0);
        const nextSel: Record<string, string | null> = {};
        for (const u of applied.users) nextSel[u.id] = u.assignedRoomId ? null : null;
        setSelections(nextSel);
        setPhase('select');
      }
      return;
    }

    // Prepare bidding for each conflicting room
    setConflictingRoomIds(c);
    const bidsInit: Record<string, { userId: string; amount: number }[]> = {};
    for (const roomId of c) {
      bidsInit[roomId] = conflicts.roomToUsers[roomId].map((uid: string) => ({ userId: uid, amount: 0 }));
    }
    setCurrentBids(bidsInit);
    setBidInputs(prev => {
      const copy = { ...prev };
      for (const roomId of c) {
        const room = auction.rooms.find(r => r.id === roomId);
        for (const uid of conflicts.roomToUsers[roomId]) {
          const key = `${roomId}:${uid}`;
          if (room?.assignedUserId === uid) delete copy[key];
        }
      }
      return copy;
    });
    setTieWarnings({});
    setPhase('bid');
  };

  const submitBid = (roomId: string, userId: string) => {
    const amount = Number(bidInputs[`${roomId}:${userId}`] ?? 0);
    if (amount <= 0 || amount >= auction.totalRent) return;
    setCurrentBids(prev => {
      const list = (prev[roomId] ?? []).map(b => (b.userId === userId ? { ...b, amount, submitted: true } : b));
      const next = { ...prev, [roomId]: list };

      // If all bidders for this room have submitted, auto-resolve the bids
      const allSubmitted = list.length > 0 && list.every(x => x.submitted && x.amount > 0);
      if (allSubmitted) {
        // detect tie: multiple highest bids equal
        const amounts = list.map(b => b.amount);
        const max = Math.max(...amounts);
        const winners = list.filter(b => b.amount === max && max > 0);
        if (winners.length > 1) {
          // tie: inform users and require re-entry — do not finalize
          setTieWarnings(prev => ({ ...prev, [roomId]: 'Tie detected: equal highest bids. Please enter different amounts.' }));
          // reset submitted flags so users can re-submit; but clear input for previously assigned user
          const room = auction.rooms.find(r => r.id === roomId);
          setBidInputs(prevInputs => {
            const copy = { ...prevInputs };
            if (room?.assignedUserId) delete copy[`${roomId}:${room.assignedUserId}`];
            return copy;
          });
          const resetList = list.map(b => ({ ...b, submitted: false }));
          return { ...prev, [roomId]: resetList };
        }

        // perform assignment immediately
        const updated = assignHighestBidder(auction, roomId, list.map(({ userId, amount }) => ({ userId, amount })));
        // update auction state and clear bids for this room
        setAuction(updated);
        setConflictingRoomIds(prevConf => prevConf.filter(rid => rid !== roomId));
        const copy = { ...next };
        delete copy[roomId];
        // reset selections for next round for unassigned users
        const nextSel: Record<string, string | null> = {};
        for (const u of updated.users) nextSel[u.id] = u.assignedRoomId ? null : null;
        setSelections(nextSel);
        // clear tie warning for this room if present
        setTieWarnings(prev => { const c = { ...prev }; delete c[roomId]; return c; });
        // if there are no more conflicts remaining, move back to selection phase (or done if all assigned)
        setTimeout(() => {
          setCurrentBids(copy);
          if ((conflictingRoomIds.filter(rid => rid !== roomId)).length === 0) {
            const allAssigned = updated.users.every(u => u.assignedRoomId);
            if (allAssigned) setPhase('done');
            else setPhase('select');
          }
        }, 0);
        return copy;
      }

      return next;
    });
  };

  return (
    <div className='bg-white p-6 rounded shadow'>
      <h2 className='text-xl font-semibold mb-4'>Auction: {auction.id}</h2>

      <div className='mb-4'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {auction.rooms.map(r => (
            <div key={r.id} className='p-3 border rounded'>
              <div className='text-lg font-medium'>{r.name}</div>
              <div className='text-sm text-slate-600'>Price: ${r.price.toFixed(2)}</div>
              <div className='text-sm text-slate-600'>Assigned: {r.assignedUserId ? (auction.users.find(u => u.id === r.assignedUserId)?.name ?? r.assignedUserId) : 'None'}</div>
            </div>
          ))}
        </div>
      </div>

      {phase === 'select' && (
        <div>
          <h3 className='font-semibold mb-2'>Room Selection (Private)</h3>
          <div className='mb-4'>
            <div className='font-semibold mb-2'>User: {currentUser.name}</div>
            <select
              className='w-full p-2 border rounded'
              value={selections[currentUser.id] ?? ''}
              onChange={e => setSelections(prev => ({ ...prev, [currentUser.id]: e.target.value }))}
            >
              <option value=''>Select a room</option>
              {auction.rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            className='bg-blue-600 text-white px-4 py-2 rounded'
            disabled={!selections[currentUser.id]}
            onClick={handleSelectRoom}
          >
            {selectIndex < auction.users.length - 1 ? 'Next User' : 'Submit All Selections'}
          </button>
        </div>
      )}

      {phase === 'bid' && (
        <div>
          <h3 className='font-semibold mb-2'>Bidding phase</h3>
          {conflictingRoomIds.map(roomId => (
            <div key={roomId} className='mb-4 border p-3 rounded'>
              <div className='font-medium'>Room: {auction.rooms.find(r => r.id === roomId)?.name}</div>
              <div className='space-y-2 mt-2'>
                {(currentBids[roomId] ?? []).map(b => (
                  <div key={b.userId} className='flex items-center gap-2'>
                    <div className='w-28'>{auction.users.find(u => u.id === b.userId)?.name}</div>
                    <input className='p-2 border rounded' type='number' min='1' step='1' value={bidInputs[`${roomId}:${b.userId}`] ?? ''} onChange={(e) => setBidInputs(prev => ({ ...prev, [`${roomId}:${b.userId}`]: Number(e.target.value) }))} />
                    <button className='px-2 py-1 bg-blue-600 text-white rounded' onClick={() => submitBid(roomId, b.userId)}>Submit Bid</button>
                  </div>
                ))}
                {tieWarnings[roomId] && (
                  <div className='mt-2 text-sm text-red-600'>{tieWarnings[roomId]}</div>
                )}
                {/* Bids auto-finalize when all bidders have submitted */}
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div>
          <h3 className='font-semibold mb-2'>Auction Complete</h3>
          <ul>
            {auction.users.map(u => (
              <li key={u.id}>{u.name}: {auction.rooms.find(r => r.id === u.assignedRoomId)?.name ?? 'None'} - ${auction.rooms.find(r => r.id === u.assignedRoomId)?.price.toFixed(2) ?? '0.00'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
