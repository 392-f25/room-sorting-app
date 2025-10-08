// Simple client-side room manager using localStorage and BroadcastChannel for sync across tabs
// Rooms are ephemeral: they expire 5 minutes after creation.

type User = { id: string; name: string }

type Room = {
  code: string
  createdAt: number
  users: User[]
  // info is flexible to allow internal flags (e.g. _stage) and data
  info?: Record<string, any>
  started?: boolean
}

const STORAGE_KEY = 'auction_rooms_v1'

function now() { return Date.now() }

function loadAll(): Room[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Room[]
    // filter expired
    const filtered = parsed.filter(r => now() - r.createdAt < 5 * 60 * 1000)
    if (filtered.length !== parsed.length) saveAll(filtered)
    return filtered
  } catch (e) {
    console.error('rooms: parse error', e)
    localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

function saveAll(rooms: Room[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  bc.postMessage({ type: 'rooms:update' })
}

const bc = new BroadcastChannel('auction_rooms_channel')

bc.onmessage = () => {
  // noop; consumers will listen to bc directly if needed
}

const API_PREFIX = (() => {
  const p = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
  return p
})()

export async function createRoom(code: string, creator: User): Promise<boolean> {
  try {
    const res = await fetch(`${API_PREFIX}/api/room/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, user: creator }) })
    if (res.ok) return true
  } catch (e) {
    // fallthrough to local
  }
  // fallback: create locally so app works without server
  try {
    const rooms = loadAll()
    const room: Room = { code, createdAt: now(), users: [creator] }
    rooms.push(room)
    saveAll(rooms)
    return true
  } catch (e) {
    return false
  }
}

export async function joinRoom(code: string, user: User): Promise<boolean> {
  try {
    const res = await fetch(`${API_PREFIX}/api/room/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, user }) })
    if (res.ok) return true
  } catch (e) {
    // fallthrough to local
  }
  // fallback to local join
  try {
    const rooms = loadAll()
    const room = rooms.find(r => r.code === code)
    if (!room) return false
    if (!room.users.find(u => u.id === user.id)) room.users.push(user)
    saveAll(rooms)
    return true
  } catch (e) {
    return false
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  try {
    const res = await fetch(`${API_PREFIX}/api/room/status/${code}`)
    if (res.ok) {
      const data = await res.json()
      return { code, createdAt: Date.now(), users: data.users || [], info: { ...(data.results ? { results: data.results } : {}), submissions: data.submissions || {}, ...(data.roomInfo || {}) }, started: false }
    }
  } catch (e) {
    // fallback to local
  }
  const rooms = loadAll()
  return rooms.find(r => r.code === code) || null
}

export function updateRoom(code: string, patch: Partial<Room>) {
  // client-side stub: UI updates should come from server status endpoint; keep local storage for offline
  const rooms = loadAll()
  const idx = rooms.findIndex(r => r.code === code)
  if (idx === -1) return
  const existing = rooms[idx]
  const merged: Room = { ...existing, ...patch }
  if (existing.info || patch.info) {
    merged.info = { ...(existing.info || {}), ...(patch.info || {}) }
  }
  rooms[idx] = merged
  saveAll(rooms)
}

// Bid submissions: store bids per user inside room.info.submissions: { [userId]: number[] }
export async function submitBids(code: string, userId: string, bids: number[]) {
  const res = await fetch(`${API_PREFIX}/api/room/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, userId, bids }) })
  return res.ok
}

export async function getSubmissions(code: string): Promise<Record<string, number[]>> {
  const res = await fetch(`${API_PREFIX}/api/room/status/${code}`)
  if (!res.ok) return {}
  const data = await res.json()
  return data.submissions || {}
}

// Simple Hungarian algorithm implementation for square cost matrix using O(n^3) approach.
// We'll treat bids as valuations; to maximize total valuation we minimize negative valuations.
export async function computeAssignmentAndPrices(code: string) {
  const res = await fetch(`${API_PREFIX}/api/room/compute/${code}`, { method: 'POST' })
  if (!res.ok) return null
  const data = await res.json()
  return data.results
}

export async function setRoomInfo(code: string, info: Record<string, any>) {
  const res = await fetch(`${API_PREFIX}/api/room/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, info }) })
  return res.ok
}

export function leaveRoom(code: string, userId: string) {
  const rooms = loadAll()
  const idx = rooms.findIndex(r => r.code === code)
  if (idx === -1) return
  rooms[idx].users = rooms[idx].users.filter(u => u.id !== userId)
  saveAll(rooms)
}

export function subscribe(cb: () => void) {
  const handler = () => cb()
  bc.addEventListener('message', handler)
  window.addEventListener('storage', cb)
  return () => {
    bc.removeEventListener('message', handler)
    window.removeEventListener('storage', cb)
  }
}

export function generateCode(): string {
  // 4-digit numeric code
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function makeUser(name: string) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, name }
}
