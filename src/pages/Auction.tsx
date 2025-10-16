import { useEffect, useState } from 'react'
import { getRoom, submitBids, updateRoom } from '../lib/rooms'

type Props = { code: string, userId: string, onSubmitted: () => void }

export default function Auction({ code, userId, onSubmitted }: Props) {
  // room state not directly read; names/images kept separately
  const [names, setNames] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [prices, setPrices] = useState<number[]>([])
  const [preferenceOrder, setPreferenceOrder] = useState<number[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
  const r = await getRoom(code)
  if (!mounted || !r) return
      const ns = r.info?.roomNames || []
      const imgs = r.info?.photos || []
      setNames(ns)
      setImages(imgs)
      setPrices(Array.from({ length: ns.length }).map(() => 0))
    })()
    return () => { mounted = false }
  }, [code])

  const setPrice = (i: number, v: number) => {
    setPrices(p => { const next = [...p]; next[i] = v; return next })
  }

  const togglePreference = (index: number) => {
    setPreferenceOrder(prev => {
      const found = prev.indexOf(index)
      if (found !== -1) {
        // remove it
        return prev.filter(i => i !== index)
      }
      // add to end
      return [...prev, index]
    })
  }

  const clearPreferences = () => setPreferenceOrder([])

  const handleSubmit = async () => {
    // try server submit but never block local persistence/navigation on network errors
    try {
      await submitBids(code, userId, prices)
    } catch (e) {
      console.warn('submitBids failed, will persist locally and continue', e)
    }

    try {
      // build structured submission entries: username, per-room price, and preference order
      const room = await getRoom(code)
      const username = room?.users.find(u => u.id === userId)?.name || userId
      const roomNames = room?.info?.roomNames || []
      const submission = {
        userId,
        username,
        rooms: roomNames.map((rn: string, idx: number) => ({ roomName: rn, price: prices[idx] ?? 0 })),
        preferenceOrder
      }
      // merge into existing submissions object
      const existing = { ...(room?.info?.submissions || {}) }
      existing[userId] = submission
      updateRoom(code, { info: { submissions: existing } })
    } catch (e) {
      console.warn('failed to persist submission locally', e)
    }

    // parent controls navigation (App will route to AlreadySubmitted)
    try {
      onSubmitted()
    } catch (e) {
      console.warn('onSubmitted callback error', e)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Please enter the ideal price you are willing to pay for each room.</h1>
      <div className="grid grid-cols-1 gap-4">
        {names.map((n, i) => {
          const orderIndex = preferenceOrder.indexOf(i)
          return (
            <div key={i} onClick={() => togglePreference(i)} className={`p-4 border rounded flex items-center gap-4 cursor-pointer ${orderIndex !== -1 ? 'bg-indigo-50 border-indigo-400' : ''}`}>
              <div className="w-28 h-20 border overflow-hidden">
                {images[i] ? <img src={images[i]} className="w-full h-full object-cover" alt={n} /> : <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No photo</div>}
              </div>
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">
                  <span>{n}</span>
                  {orderIndex !== -1 ? (
                    <span className="text-sm bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center">{orderIndex + 1}</span>
                  ) : null}
                </div>
              </div>
              <div className="w-40">
                <input type="number" className="border p-2 w-full" value={prices[i] ?? 0} onChange={e => setPrice(i, Number(e.target.value))} onClick={e => e.stopPropagation()} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Your preference order</h3>
        {preferenceOrder.length === 0 ? (
          <div className="text-sm text-gray-500">Click rooms in the order you prefer; the sequence will appear here.</div>
        ) : (
          <ol className="list-decimal pl-6">
            {preferenceOrder.map((idx, pos) => (
              <li key={idx} className="mb-1 flex items-center gap-3">
                <div className="w-10 h-10 border overflow-hidden flex-shrink-0">
                  {images[idx] ? <img src={images[idx]} className="w-full h-full object-cover" alt={names[idx]} /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No photo</div>}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{names[idx] || `Room ${idx + 1}`}</div>
                </div>
                <div className="text-sm text-gray-600">#{pos + 1}</div>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2 flex gap-2">
          <button className="bg-yellow-500 text-white px-3 py-1 rounded" onClick={clearPreferences}>Clear order</button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  )
}
