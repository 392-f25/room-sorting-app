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
  const users = r.users
  const subs = r.info.submissions || {}
  const n = Math.max(names.length, users.length)
  const vals = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    const user = users[i]
    const bid = (subs[user?.id] || [])[j]
    return typeof bid === 'number' ? bid : 0
  }))
  let maxVal = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (vals[i][j] > maxVal) maxVal = vals[i][j]
  const cost = vals.map(row => row.map(v => maxVal - v))

  function hungarian(matrix) {
    const N = matrix.length
    const u = Array(N + 1).fill(0)
    const v = Array(N + 1).fill(0)
    const p = Array(N + 1).fill(0)
    const way = Array(N + 1).fill(0)
    for (let i = 1; i <= N; i++) {
      p[0] = i
      let j0 = 0
      const minv = Array(N + 1).fill(Infinity)
      const used = Array(N + 1).fill(false)
      do {
        used[j0] = true
        const i0 = p[j0]
        let delta = Infinity
        let j1 = 0
        for (let j = 1; j <= N; j++) if (!used[j]) {
          const cur = (matrix[i0 - 1][j - 1] || 0) - u[i0] - v[j]
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
          if (minv[j] < delta) { delta = minv[j]; j1 = j }
        }
        for (let j = 0; j <= N; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta } else { minv[j] -= delta }
        }
        j0 = j1
      } while (p[j0] !== 0)
      do {
        const j1 = way[j0]
        p[j0] = p[j1]
        j0 = j1
      } while (j0)
    }
    const assignment = Array(N).fill(-1)
    for (let j = 1; j <= N; j++) if (p[j]) assignment[p[j] - 1] = j - 1
    return { assignment }
  }

  const { assignment } = hungarian(cost)
  const totalRent = Number(r.info.totalRent) || 0
  const results = []
  let sumAssigned = 0
  for (let i = 0; i < users.length; i++) {
    const j = assignment[i]
    const roomName = names[j]
    const image = (r.info.photos || [])[j]
    const price = (subs[users[i].id] || [])[j] || 0
    results.push({ roomName, image, user: users[i].name, price })
    sumAssigned += price
  }
  if (sumAssigned > 0 && totalRent > 0) {
    const factor = totalRent / sumAssigned
    for (const rr of results) rr.price = Math.round((rr.price || 0) * factor)
  }
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
