import { useEffect, useState } from 'react'
import { getRoom, getLocalRoom, subscribe, computeAssignmentAndPrices, updateRoom, setRoomInfo } from '../lib/rooms'

type Props = { code: string, userId?: string, onShowResults?: () => void }

export default function AlreadySubmitted({ code, userId, onShowResults }: Props) {
  const [submissions, setSubmissions] = useState<any>({})
  const [usersCount, setUsersCount] = useState<number>(0)
  const [isComputing, setIsComputing] = useState(false)
  const [resultsReady, setResultsReady] = useState(false)
  const [stickyComputing, setStickyComputing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [navigatedToResults, setNavigatedToResults] = useState(false)
  const [hostId, setHostId] = useState<string | undefined>(undefined)

  async function refresh() {
    // show local data immediately for snappy UI
    try {
      const local = getLocalRoom(code)
      if (local) {
        setUsersCount(local.users.length)
        setSubmissions(local.info?.submissions || {})
        const localComputing = !!local.info?._computing
        const localResults = !!local.info?.results
        setResultsReady(localResults)
        setHostId((local.info as any)?.hostId)
        setIsComputing(prev => prev || localComputing || stickyComputing)
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
        setResultsReady(serverResults)
        setHostId((serverRoom.info as any)?.hostId)
        setIsComputing(prev => prev || serverComputing || stickyComputing)
        if (serverResults) setStickyComputing(false)
        if (serverComputing || stickyComputing) setModalVisible(true)
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
    // host requested computing; keep modal visible until results arrive
    setStickyComputing(true)
    setIsComputing(true)
    setModalVisible(true)

    // mark computing state so other clients show waiting modal
    updateRoom(code, { info: { _computing: true } })
    setRoomInfo(code, { _computing: true }).catch((e) => console.warn('setRoomInfo failed', e))

    // schedule compute in next tick so the modal can render first
    setTimeout(async () => {
      try {
        // send the exact info host sees (submissions/preferences/roomNames/totalRent/photos)
        const local = getLocalRoom(code)
        const infoToSend = local?.info || {}

        console.time('[client] computeAssignmentAndPrices')
        const data = await computeAssignmentAndPrices(code, infoToSend)
        console.timeEnd('[client] computeAssignmentAndPrices')

        // ⭐ print algorithm result for host
        logResultsToConsole(data)

        const resultsArray = Array.isArray(data) ? data : (data?.results ?? null)
        if (resultsArray) {
          // persist results locally & server-side
          updateRoom(code, { info: { results: resultsArray, _computing: false } })
          try { await setRoomInfo(code, { results: resultsArray, _computing: false }) } catch (e) { console.warn('setRoomInfo failed', e) }
          setResultsReady(true)
          setStickyComputing(false)
          setIsComputing(false)
          // navigate to results
          onShowResults && onShowResults()
        } else {
          // no valid results; clear computing state
          updateRoom(code, { info: { _computing: false } })
          try { await setRoomInfo(code, { _computing: false }) } catch (e) { console.warn('setRoomInfo failed', e) }
          setStickyComputing(false)
          setIsComputing(false)
        }
      } catch (e) {
        console.warn('computeAssignmentAndPrices failed', e)
        updateRoom(code, { info: { _computing: false } })
        try { await setRoomInfo(code, { _computing: false }) } catch (err) { console.warn('setRoomInfo failed', err) }
        setStickyComputing(false)
        setIsComputing(false)
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

      {/* Modal shown while computing (host triggers) */}
      {isComputing && modalVisible ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded shadow max-w-sm w-full relative">
            <button
              aria-label="close"
              className="absolute left-2 top-2 text-gray-500 hover:text-gray-800"
              onClick={() => setModalVisible(false)}
            >
              ×
            </button>
            <div className="text-lg font-semibold mb-3">Waiting for result…</div>
            <div className="text-sm text-gray-600 mb-4">
              The host is computing the final assignment. Please wait.
            </div>
            <button
              className={`px-4 py-2 rounded ${resultsReady ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}
              disabled={!resultsReady}
              onClick={() => { if (resultsReady) onShowResults && onShowResults() }}
            >
              Show Result
            </button>
          </div>
        </div>
      ) : null}

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

      <div className="mt-6 text-sm text-gray-500">
        If everyone has submitted, the creator can compute assignments and show results.
      </div>
    </div>
  )
}
