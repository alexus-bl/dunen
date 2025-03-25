import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddMatch from './pages/AddMatch'
import Matches from './pages/Matches'
import EditMatch from './pages/EditMatch'


function App() {
  const [count, setCount] = useState(0)
  return (
    <BrowserRouter>
      <nav className="p-4 bg-gray-100 flex gap-4">
        <Link to="/">Dashboard</Link>
        <Link to="/add-match">Neue Partie</Link>
        <Link to="/matches">Partien</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-match" element={<AddMatch />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/edit-match/:matchId" element={<EditMatch />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
