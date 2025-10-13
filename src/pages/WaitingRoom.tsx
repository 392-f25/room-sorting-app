import { useEffect, useState } from 'react'
import { getRoom, leaveRoom, subscribe, getSubmissions, computeAssignmentAndPrices, setRoomInfo, updateRoom } from '../lib/rooms'

type Props = {
  userId: string
  code: string
  onNavigateToRoomInfo: () => void
  onNavigateToAuction: () => void
  onViewResults?: () => void
  onLeft?: () => void
}

export default function WaitingRoom({ userId, code, onNavigateToRoomInfo, onNavigateToAuction, onViewResults, onLeft }: Props) {
  const [users, setUsers] = useState<string[]>([])
  const [isCreator, setIsCreator] = useState(false)
  const [submittedUsers, setSubmittedUsers] = useState<string[]>([])
  const [isHostTyping, setIsHostTyping] = useState(false)

  async function refresh() {
    const room = await getRoom(code)
    if (!room) return
    setUsers(room.users.map(u => u.name))
    setIsCreator(room.users[0]?.id === userId)
    // if owner moved to room info, navigate
    const stage = (room.info as any)?._stage
    const hostId = (room.info as any)?.hostId
    if (stage === 'roominfo') {
      // if I am the host, navigate to RoomInfo; otherwise show waiting message
      if (hostId === userId) {
        onNavigateToRoomInfo()
      } else {
        setIsHostTyping(true)
      }
    } else {
      setIsHostTyping(false)
    }
    // when auction started, navigate everyone to auction
    if (room.started) {
      onNavigateToAuction()
    }
    // submissions
    const subs = await getSubmissions(code)
    setSubmittedUsers(Object.keys(subs).map(id => room.users.find(u => u.id === id)?.name || id))
  }

  useEffect(() => {
    refresh()
    const unsub = subscribe(() => refresh())
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async () => {
    // optimistic local update so other participants immediately see creator typing
    try {
      updateRoom(code, { info: { _stage: 'roominfo', hostId: userId } })
    } catch (e) {
      // non-fatal
    }
    // mark room as moving to room info on server; if network fails, still navigate locally
    try {
      await setRoomInfo(code, { _stage: 'roominfo', hostId: userId })
    } catch (e) {
      console.warn('setRoomInfo failed, continuing to navigate locally', e)
    }
    // navigate host immediately to RoomInfo so creator doesn't wait on broadcast
    onNavigateToRoomInfo()
  }

  const handleLeave = () => {
    leaveRoom(code, userId)
    onLeft && onLeft()
  }

  const handleViewResults = async () => {
    // ensure results are computed (host can compute if not available)
    const room = await getRoom(code)
    if (!room?.info?.results && isCreator) {
      await computeAssignmentAndPrices(code)
    }
    // navigate to results view
    onViewResults && onViewResults()
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Waiting Room — Code: {code}</h2>
      <div className="mb-4">
        <h3 className="font-semibold">Joined users</h3>
        <ul className="list-disc pl-6">
          {users.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        {isCreator ? (
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleStart}>Start auction</button>
        ) : (
          <div className="text-sm text-gray-600">Waiting for the creator to start...</div>
        )}
  {isHostTyping ? <div className="text-lg text-indigo-600 font-medium">Waiting for the creator to type in the room information.</div> : null}
        <div className="flex flex-col gap-2">
          <div className="text-sm">Submitted: {submittedUsers.length} / {users.length}</div>
          <div className="flex gap-2">
            {isCreator && submittedUsers.length === users.length ? (
              <button className="bg-indigo-600 text-white px-4 py-2 rounded" onClick={handleViewResults}>View Results</button>
            ) : null}
            <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={handleLeave}>Leave</button>
          </div>
        </div>
      </div>
    </div>
  )
}
