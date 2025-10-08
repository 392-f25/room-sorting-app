import { useEffect, useState } from 'react'
import { getRoom, submitBids } from '../lib/rooms'

type Props = { code: string, userId: string, onSubmitted: () => void }

export default function Auction({ code, userId, onSubmitted }: Props) {
  // room state not directly read; names/images kept separately
  const [names, setNames] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [prices, setPrices] = useState<number[]>([])

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

  const handleSubmit = async () => {
    await submitBids(code, userId, prices)
    onSubmitted()
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Please enter the ideal price you are willing to pay for each room.</h1>
      <div className="grid grid-cols-1 gap-4">
        {names.map((n, i) => (
          <div key={i} className="p-4 border rounded flex items-center gap-4">
            <div className="w-28 h-20 border overflow-hidden">
              {images[i] ? <img src={images[i]} className="w-full h-full object-cover" alt={n} /> : <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No photo</div>}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{n}</div>
            </div>
            <div className="w-40">
              <input type="number" className="border p-2 w-full" value={prices[i] ?? 0} onChange={e => setPrice(i, Number(e.target.value))} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={handleSubmit}>Submit</button>
      </div>
    </div>
  )
}
