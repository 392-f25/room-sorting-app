import { useEffect, useState } from 'react'
import { getRoom, getLocalRoom, subscribe, computeAssignmentAndPrices, updateRoom, setRoomInfo } from '../lib/rooms'

type Props = { code: string, userId?: string, onShowResults?: () => void }

export default function AlreadySubmitted({ code, userId, onShowResults }: Props) {
  const [submissions, setSubmissions] = useState<any>({})
  const [usersCount, setUsersCount] = useState<number>(0)
  const [stickyComputing, setStickyComputing] = useState(false)
  const [navigatedToResults, setNavigatedToResults] = useState(false)
  const [hostId, setHostId] = useState<string | undefined>(undefined)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  async function refresh() {
    // show local data immediately for snappy UI
    try {
      const local = getLocalRoom(code)
      if (local) {
        setUsersCount(local.users.length)
        setSubmissions(local.info?.submissions || {})
  const localComputing = !!local.info?._computing
  const localResults = !!local.info?.results
  if (localResults) setStatusMessage('Results received')
        setHostId((local.info as any)?.hostId)
        // reflect computing state via stickyComputing and server flags; UI shows statusMessage instead
        if (localComputing || stickyComputing) setStatusMessage('Computing in progress...')
      }
    } catch {
      // ignore local read errors
    }

    // always try server copy so devices on other machines pick up updates
    try {
      const serverRoom = await getRoom(code)
      if (serverRoom) {
        setUsersCount(serverRoom.users.length)
        setSubmissions(serverRoom.info?.submissions || {})
  const serverComputing = !!serverRoom.info?._computing
  const serverResults = !!serverRoom.info?.results
  if (serverResults) setStatusMessage('Results received')
        setHostId((serverRoom.info as any)?.hostId)
        if (serverComputing || stickyComputing) setStatusMessage('Computing in progress...')
        if (serverResults) setStickyComputing(false)
        if (serverResults && onShowResults && !navigatedToResults) {
          setNavigatedToResults(true)
          onShowResults()
        }
      }
    } catch {
      // server fetch failed; we already used local state if available
    }
  }

  useEffect(() => {
    refresh()
    const unsub = subscribe(() => refresh())
    const iv = setInterval(() => refresh(), 1000) // poll for cross-device sync
    return () => { unsub(); clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const submittedCount = Object.keys(submissions).length

  // ====== NEW: helper to log results nicely ======
  function logResultsToConsole(results: any) {
    console.groupCollapsed('[client] Compute results')
    try {
      const arr = Array.isArray(results) ? results : (results?.results ?? [])
      if (Array.isArray(arr)) {
        const flat = arr.map((r: any) => ({
          roomName: r.roomName,
          user: r.user,
          userId: r.userId,
          price: r.price,
        }))
        console.table(flat)
      }
      console.log('Raw results:', results)
    } finally {
      console.groupEnd()
    }
  }

  // ====== NEW: extracted click handler with console logging ======
  async function handleComputeClick() {
  // host requested computing; set sticky flag and show a status message
  setStickyComputing(true)
  setStatusMessage('Sending compute payload to server...')

    // mark computing state so other clients show waiting modal
    updateRoom(code, { info: { _computing: true } })
    setRoomInfo(code, { _computing: true }).catch((e) => console.warn('setRoomInfo failed', e))

    // schedule compute in next tick so the UI updates first
  setTimeout(async () => {
      try {
        // send the exact info host sees (submissions/preferences/roomNames/totalRent/photos)
        const local = getLocalRoom(code)
        const infoToSend = local?.info || {}

  // inform and log what we are about to send
  setStatusMessage('Sending compute payload to server...')
        console.log('[client] compute payload to send:', {
          submissionsKeys: Object.keys((infoToSend.submissions || {})),
          preferencesPresent: !!infoToSend.preferences,
          roomNames: infoToSend.roomNames,
          totalRent: infoToSend.totalRent
        })

        console.time('[client] computeAssignmentAndPrices')
        const data = await computeAssignmentAndPrices(code, infoToSend)
        console.timeEnd('[client] computeAssignmentAndPrices')

  // ⭐ print algorithm result for host
  logResultsToConsole(data)
  setStatusMessage('Results received')

        const resultsArray = Array.isArray(data) ? data : (data?.results ?? null)
        if (resultsArray) {
          // persist results locally & server-side
          updateRoom(code, { info: { results: resultsArray, _computing: false } })
          try { await setRoomInfo(code, { results: resultsArray, _computing: false }) } catch (e) { console.warn('setRoomInfo failed', e) }
          setStickyComputing(false)
          setStatusMessage('Results received')
          // navigate to results
          onShowResults && onShowResults()
        } else {
          // no valid results; clear computing state
          updateRoom(code, { info: { _computing: false } })
          try { await setRoomInfo(code, { _computing: false }) } catch (e) { console.warn('setRoomInfo failed', e) }
          setStickyComputing(false)
          setStatusMessage('No results returned from server')
        }
      } catch (e) {
        console.warn('computeAssignmentAndPrices failed', e)
        updateRoom(code, { info: { _computing: false } })
        try { await setRoomInfo(code, { _computing: false }) } catch (err) { console.warn('setRoomInfo failed', err) }
        setStickyComputing(false)
        setStatusMessage('Compute failed')
      }
    }, 50)
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Already Submitted — Waiting for others</h2>
      <div className="text-sm text-gray-600 mb-3">
        You have submitted your bids and preference order. Below you can see who else has completed their submission in real time.
      </div>
      <div className="mb-4">
        <div className="text-sm">Submitted: {submittedCount} / {usersCount}</div>
      </div>

      {/* Host controls: calculate results when everyone has submitted */}
      {userId && Object.values(submissions).length === usersCount && userId === hostId ? (
        <div className="mb-4">
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded"
            onClick={handleComputeClick}
          >
            Calculating Result
          </button>
        </div>
      ) : null}

      {/* Modal removed — compute status is shown via `statusMessage` below */}

      <div className="grid grid-cols-1 gap-3">
        {Object.values(submissions).map((s: any, i: number) => (
          <div key={i} className="p-3 border rounded">
            <div className="font-semibold">{s.username || s.userId}</div>
            <div className="text-sm text-gray-600">
              Preference: {(s.preferenceOrder || []).map((pi: number) => `#${pi + 1}`).join(', ') || '—'}
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {(s.rooms || []).map((r: any, idx: number) => (
                <li key={idx}>{r.roomName}: ${r.price}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {statusMessage ? (
        <div className="mt-4 text-sm text-blue-600">{statusMessage}</div>
      ) : null}

      <div className="mt-6 text-sm text-gray-500">
        If everyone has submitted, the creator can compute assignments and show results.
      </div>
    </div>
  )
}
