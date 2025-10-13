import { useEffect, useState } from 'react'
import { getRoom, updateRoom, subscribe } from '../lib/rooms'

type Props = {
  code: string
  onStartAuction: () => void
}

export default function RoomInfo({ code, onStartAuction }: Props) {
  const [totalRent, setTotalRent] = useState<number | ''>('')
  const [numRooms, setNumRooms] = useState<number | ''>('')
  const [roomNames, setRoomNames] = useState<string[]>([])
  // photos aligned with roomNames by index; empty string means no photo yet
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const room = await getRoom(code)
      if (!mounted) return
      if (room?.info) {
        setTotalRent(room.info.totalRent ?? '')
        setNumRooms(room.info.numRooms ?? '')
        setRoomNames(room.info.roomNames ?? [])
        setPhotos(room.info.photos ?? [])
      }
    })()
    const unsub = subscribe(async () => {
      const r = await getRoom(code)
      if (!r) return
      setRoomNames(r.info?.roomNames ?? [])
      setPhotos(r.info?.photos ?? [])
    })
    return () => { mounted = false; unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateNames = () => {
    const n = Number(numRooms) || 0
    const names = Array.from({ length: n }).map((_, i) => `Room ${i + 1}`)
    setRoomNames(names)
    // ensure photos array matches names length
    setPhotos(Array(n).fill(''))
  }

  const onPhoto = (index: number, file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result)
      setPhotos(prev => {
        const next = [...prev]
        // expand if necessary
        while (next.length <= index) next.push('')
        next[index] = data
        return next
      })
    }
    reader.readAsDataURL(file)
  }

  const confirm = () => {
    updateRoom(code, { info: { totalRent: Number(totalRent) || 0, numRooms: Number(numRooms) || 0, roomNames, photos }, started: true })
    onStartAuction()
  }

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Room Information — Code: {code}</h2>
      <div className="mb-4">
        <label className="block">Total rent</label>
        <input type="number" className="border p-2 w-full" value={totalRent as any} onChange={e => setTotalRent(e.target.value === '' ? '' : Number(e.target.value))} />
      </div>
      <div className="mb-4">
        <label className="block">Number of rooms</label>
        <input type="number" className="border p-2 w-full" value={numRooms as any} onChange={e => setNumRooms(e.target.value === '' ? '' : Number(e.target.value))} />
        <button className="mt-2 bg-gray-700 text-white px-3 py-1 rounded" onClick={generateNames}>Auto-generate names</button>
      </div>

      <div className="mb-4">
        <label className="block mb-2">Room names</label>
        <ul className="pl-0">
          {roomNames.map((r, i) => (
            <li key={i} className="flex items-center gap-4 mb-2">
              <span className="flex-1 list-decimal">{r}</span>
              <input id={`room-photo-${i}`} className="hidden" type="file" accept="image/*" onChange={e => onPhoto(i, e.target.files?.[0])} />
              <label htmlFor={`room-photo-${i}`} className="bg-gray-800 text-white px-3 py-1 rounded cursor-pointer">Upload</label>
              {photos[i] ? (
                <div className="w-20 h-14 border overflow-hidden">
                  <img src={photos[i]} alt={`room-${i}`} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-14 border flex items-center justify-center text-sm text-gray-500">No photo</div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={confirm}>Start</button>
      </div>
    </div>
  )
}
