import React, { useState } from 'react'
import { createRoom, generateCode, joinRoom, makeUser } from '../lib/rooms'

type Props = { onEnter: (userName: string, userId: string, roomCode: string, isCreator: boolean) => void }

export default function Landing({ onEnter }: Props) {
  const [name, setName] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const handleCreate = async () => {
    if (!name) return alert('Please enter your name')
    const c = generateCode()
    const user = makeUser(name)
    const ok = await createRoom(c, user)
    if (!ok) return alert('Failed to create room')
    // navigate immediately to waiting room showing the invitation code
    onEnter(name, user.id, c, true)
  }

  const handleJoinConfirm = async () => {
    if (!name) return alert('Please enter your name')
    if (!joinCode) return alert('Enter 4-digit code')
    const user = makeUser(name)
    const ok = await joinRoom(joinCode, user)
    if (!ok) return alert('No room with that code (or it expired)')
    setShowJoinModal(false)
    onEnter(name, user.id, joinCode, false)
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create Auction Room</h1>
      <label className="block mb-2">Your username</label>
  <input className="border p-2 w-full mb-4" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />

      <div className="flex gap-2 mt-4">
        <button className="bg-yellow-500 text-black px-4 py-2 rounded" onClick={handleCreate}>Create Room</button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => setShowJoinModal(true)}>Join Room</button>
      </div>

      {showJoinModal ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Enter 4-digit code</h3>
            <input className="border p-2 w-full mb-4" value={joinCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value)} placeholder="e.g. 1234" />
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2" onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleJoinConfirm}>Join</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
