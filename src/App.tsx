import { useState } from 'react'
import Landing from './pages/Landing'
import WaitingRoom from './pages/WaitingRoom'
import RoomInfo from './pages/RoomInfo'
import Auction from './pages/Auction'
import Results from './pages/Results'
import AlreadySubmitted from './pages/AlreadySubmitted'

type Page = 'landing' | 'waiting' | 'roominfo' | 'auction' | 'submitted' | 'results'

const App = () => {
  const [page, setPage] = useState<Page>('landing')
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const enterRoom = (_name: string, id: string, roomCode: string) => {
    setUserId(id)
    setCode(roomCode)
    setPage('waiting')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {page === 'landing' && <Landing onEnter={enterRoom} />}
      {page === 'waiting' && <WaitingRoom userId={userId} code={code} onNavigateToRoomInfo={() => setPage('roominfo')} onNavigateToAuction={() => setPage('auction')} onLeft={() => setPage('landing')} onViewResults={() => setPage('results')} />}
      {page === 'roominfo' && <RoomInfo code={code} onStartAuction={() => setPage('auction')} />}
  {page === 'auction' && <Auction code={code} userId={userId} onSubmitted={() => setPage('submitted')} />}
  {page === 'submitted' && <AlreadySubmitted code={code} userId={userId} onShowResults={() => setPage('results')} />}
      {page === 'results' && <Results code={code} />}
    </div>
  )
}

export default App
