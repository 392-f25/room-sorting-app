import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
app.use(cors())
app.use(bodyParser.json({ limit: '10mb' }))

// In-memory store for rooms
const rooms = {}

function now() { return Date.now() }

app.post('/api/room/create', (req, res) => {
  const { code, user } = req.body
  rooms[code] = { code, createdAt: now(), users: [user], info: {}, started: false }
  res.json({ ok: true })
})

app.post('/api/room/join', (req, res) => {
  const { code, user } = req.body
  const r = rooms[code]
  if (!r) return res.status(404).json({ error: 'not found' })
  if (!r.users.find(u => u.id === user.id)) r.users.push(user)
  res.json({ ok: true })
})

app.post('/api/room/submit', (req, res) => {
  const { code, userId, bids } = req.body
  const r = rooms[code]
  if (!r) return res.status(404).json({ error: 'not found' })
  r.info.submissions = r.info.submissions || {}
  r.info.submissions[userId] = bids
  res.json({ ok: true })
})

app.post('/api/room/update', (req, res) => {
  const { code, info } = req.body
  const r = rooms[code]
  if (!r) return res.status(404).json({ error: 'not found' })
  r.info = { ...(r.info || {}), ...(info || {}) }
  res.json({ ok: true })
})

app.get('/api/room/status/:code', (req, res) => {
  const r = rooms[req.params.code]
  if (!r) return res.status(404).json({ error: 'not found' })
  res.json({ users: r.users, submissions: r.info.submissions || {}, results: r.info.results || null })
})

// simple hungarian algorithm and normalization (same logic as client)
function computeResults(r) {
  const names = r.info.roomNames || []
  const users = r.users || []
  const subs = r.info.submissions || {}
  const prefs = r.info.preferences || {}

  // Build preference lists for users. If user provided explicit preference order, use it.
  // Otherwise, infer preference order by descending bid for that user.
  const userIdToIndex = {}
  users.forEach((u, idx) => { userIdToIndex[u.id] = idx })

  const roomCount = names.length
  const userCount = users.length

  const prefLists = users.map(u => {
    const explicit = (prefs[u.id] || []).filter(i => i >= 0 && i < roomCount)
    if (explicit && explicit.length > 0) return explicit.slice()
    // infer by bids
    const bids = (subs[u.id] || []).map((b, idx) => ({ idx, b: typeof b === 'number' ? b : 0 }))
    bids.sort((a, b) => b.b - a.b || a.idx - b.idx)
    return bids.map(x => x.idx)
  })

  // Prepare state for stable-matching-like algorithm: users propose to rooms in order
  const nextProposal = Array(userCount).fill(0)
  const roomMatches = Array(roomCount).fill(null) // each entry: { userIdx, bid }

  const freeQueue = []
  for (let i = 0; i < userCount; i++) freeQueue.push(i)

  while (freeQueue.length > 0) {
    const uIdx = freeQueue.shift()
    const u = users[uIdx]
    const prefsForUser = prefLists[uIdx] || []
    let proposed = false
    while (nextProposal[uIdx] < prefsForUser.length) {
      const roomIdx = prefsForUser[nextProposal[uIdx]++]
      const bid = (subs[u.id] || [])[roomIdx] || 0
      const current = roomMatches[roomIdx]
      if (!current) {
        // room accepts
        roomMatches[roomIdx] = { userIdx: uIdx, bid }
        proposed = true
        break
      } else {
        // room prefers higher bid; tie-break with user index (lower wins)
        if (bid > current.bid || (bid === current.bid && uIdx < current.userIdx)) {
          // replace
          roomMatches[roomIdx] = { userIdx: uIdx, bid }
          // previous becomes free again if they have more rooms to propose
          const prev = current.userIdx
          if (nextProposal[prev] < (prefLists[prev] || []).length) freeQueue.push(prev)
          proposed = true
          break
        } else {
          // rejected, continue to next preference
          continue
        }
      }
    }
    // if user exhausted prefs and didn't get a room, they remain unmatched
    // no action needed
  }

  // Build results from matches
  const results = []
  let sumAssigned = 0
  for (let roomIdx = 0; roomIdx < roomCount; roomIdx++) {
    const match = roomMatches[roomIdx]
    if (match) {
      const user = users[match.userIdx]
      const price = match.bid || 0
      const image = (r.info.photos || [])[roomIdx]
      results.push({ roomName: names[roomIdx], image, user: user.name, userId: user.id, price })
      sumAssigned += price
    } else {
      // unassigned room
      results.push({ roomName: names[roomIdx], image: (r.info.photos || [])[roomIdx], user: null, userId: null, price: 0 })
    }
  }

  // Print intermediate allocation (before adjustment)
  const intermediate = results.filter(r => r.user).map(r => `${r.user} gets ${r.roomName || '\u2014'} at price ${r.price}`).join(', ')
  console.log('Intermediate allocation:', intermediate)

  const totalRent = Number(r.info.totalRent) || 0

  // Adjust prices proportionally so sum equals totalRent
  if (totalRent > 0) {
    const assigned = results.filter(r => r.user && r.price > 0)
    if (assigned.length === 0) {
      // No assigned bids or zero prices: split equally among assigned rooms that have users
      const assignedRooms = results.filter(r => r.user)
      const count = assignedRooms.length
      if (count > 0) {
        const equal = Math.floor(totalRent / count)
        let remainder = totalRent - equal * count
        for (const rr of assignedRooms) {
          let adj = equal
          if (remainder > 0) { adj += 1; remainder -= 1 }
          rr.price = adj
        }
      }
    } else {
      const sum = assigned.reduce((s, x) => s + x.price, 0)
      const diff = totalRent - sum
      // distribute proportionally, rounding to nearest integer and adjusting last to fix rounding error
      let running = 0
      for (let i = 0; i < assigned.length; i++) {
        const orig = assigned[i].price
        const raw = orig + diff * (orig / sum)
        const adj = Math.round(raw)
        assigned[i].price = adj
        running += adj
      }
      // fix rounding drift
      const drift = totalRent - running
      if (drift !== 0 && assigned.length > 0) {
        assigned[assigned.length - 1].price += drift
      }
      // copy adjusted prices back to results
      for (const a of assigned) {
        const idx = results.findIndex(rr => rr.userId === a.userId && rr.roomName === a.roomName)
        if (idx !== -1) results[idx].price = a.price
      }
    }
  }

  // Print final adjusted allocations
  const final = results.filter(r => r.user).map(r => `${r.user} gets ${r.roomName || '\u2014'} at final price ${r.price}`).join(', ')
  console.log('Final adjusted allocation:', final)

  // persist results
  r.info.results = results
  return results
}

app.post('/api/room/compute/:code', (req, res) => {
  const r = rooms[req.params.code]
  if (!r) return res.status(404).json({ error: 'not found' })
  const results = computeResults(r)
  res.json({ ok: true, results })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.get('/', (req, res) => {
  res.send('Room auction server')
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log('Server listening on', port))
