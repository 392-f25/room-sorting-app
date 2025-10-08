import { useEffect, useState } from 'react'
import { getRoom } from '../lib/rooms'

type Props = { code: string }

export default function Results({ code }: Props) {
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const r = await getRoom(code)
      if (!mounted || !r) return
      setResults(r.info?.results || [])
    })()
    return () => { mounted = false }
  }, [code])

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Results</h1>
      <div className="grid grid-cols-1 gap-4">
        {results.map((r: any, i: number) => (
          <div key={i} className="p-4 border rounded flex items-center gap-4">
            <div className="w-28 h-20 border overflow-hidden">
              {r.image ? <img src={r.image} className="w-full h-full object-cover" alt={r.roomName} /> : <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No photo</div>}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{r.roomName || `Room ${i+1}`}</div>
              <div className="text-sm text-gray-600">Winner: {r.user || '—'}</div>
            </div>
            <div className="text-xl font-bold">${r.price || 0}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
