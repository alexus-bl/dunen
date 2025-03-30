import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Shuffle, Star } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const playerColors = {
  Janosch: '#3B82F6',
  Hubertus: '#10B981',
  Casjen: '#EF4444',
  Alex: '#F97316'
}

export default function Dashboard() {
  const [results, setResults] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [leaderMode, setLeaderMode] = useState('mostUsed')
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 })


  useEffect(() => {
    fetchData()
    fetchMatchStats()
  }, [])
  
  async function fetchMatchStats() {
    const { data, error } = await supabase
      .from('matches')
      .select('id, game_id, games (id, name)')
  
    if (error) {
      console.error('Fehler beim Laden der Matches:', error)
      return
    }
  
    const total = data.length
    const dune = data.filter(m => m.games?.name === 'Dune Imperium').length
    const uprising = data.filter(m => m.games?.name === 'Dune Imperium Uprising').length
  
    setMatchStats({ total, dune, uprising })
  }

  async function fetchData() {
    const { data, error } = await supabase
      .from('results')
      .select(`
        id,
        match_id,
        score,
        spice,
        solari,
        water,
        leader_id,
        players (id, name),
        leaders (id, name),
        matches (id, date, played_rounds)
      `)

    if (error) {
      console.error('Fehler beim Laden:', error)
      return
    }

    setResults(data)

   

    const uniquePlayers = [
      ...new Map(data.map(r => [r.players.id, r.players])).values()
    ]
    setPlayers(uniquePlayers)
    setLoading(false)
  }

  if (loading) return <div className="p-4">Lade Dashboard...</div>

  function getWinner(matchResults) {
    return [...matchResults].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.spice !== a.spice) return b.spice - a.spice
      if (b.solari !== a.solari) return b.solari - a.solari
      return b.water - a.water
    })[0]
  }

  const uniqueMatchIds = [...new Set(results.map(r => r.match_id))]

  const playerStats = players.map(player => {
    const playerResults = results.filter(r => r.players.id === player.id)
    const totalGames = playerResults.length

    const wins = uniqueMatchIds.reduce((acc, matchId) => {
      const matchResults = results.filter(r => r.match_id === matchId)
      const winner = getWinner(matchResults)
      return winner.players.id === player.id ? acc + 1 : acc
    }, 0)

    const avgScore = totalGames
      ? (playerResults.reduce((sum, r) => sum + r.score, 0) / totalGames).toFixed(1)
      : '0.0'

    const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0'

    return {
      id: player.id,
      player: player.name,
      totalGames,
      wins,
      winrate: parseFloat(winrate),
      avgScore: parseFloat(avgScore)
    }
  })

  const sortedDates = [...new Set(results.map(r => r.matches.date))].sort()
  const winrateOverTime = sortedDates.map(date => {
    const dateResults = results.filter(r => r.matches.date <= date)
    const matchIdsToDate = [...new Set(dateResults.map(r => r.match_id))]

    const dataPoint = { date: new Date(date).toLocaleDateString() }

    players.forEach(player => {
      const playerResults = dateResults.filter(r => r.players.id === player.id)
      const totalGames = playerResults.length

      const wins = matchIdsToDate.reduce((acc, matchId) => {
        const matchResults = dateResults.filter(r => r.match_id === matchId)
        const winner = getWinner(matchResults)
        return winner.players.id === player.id ? acc + 1 : acc
      }, 0)

      const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0'
      dataPoint[player.name] = parseFloat(winrate)
    })

    return dataPoint
  })

  const avgScoreOverTime = sortedDates.map(date => {
    const dateResults = results.filter(r => r.matches.date <= date)
    const dataPoint = { date: new Date(date).toLocaleDateString() }

    players.forEach(player => {
      const playerResults = dateResults.filter(r => r.players.id === player.id)
      const totalGames = playerResults.length
      const avg = totalGames
        ? (playerResults.reduce((sum, r) => sum + r.score, 0) / totalGames).toFixed(1)
        : 0
      dataPoint[player.name] = parseFloat(avg)
    })

    return dataPoint
  })

  const leaderStats = players.map(player => {
    const playerResults = results.filter(r => r.players.id === player.id && r.leaders?.name)
    const leaderMap = {}

    playerResults.forEach(r => {
      const name = r.leaders.name
      if (!leaderMap[name]) {
        leaderMap[name] = { count: 0, totalScore: 0 }
      }
      leaderMap[name].count += 1
      leaderMap[name].totalScore += r.score
    })

    const leadersArray = Object.entries(leaderMap).map(([name, data]) => ({
      name,
      count: data.count,
      avgScore: (data.totalScore / data.count).toFixed(1)
    }))

    const sorted = leaderMode === 'mostUsed'
      ? leadersArray.sort((a, b) => b.count - a.count)
      : leadersArray.sort((a, b) => b.avgScore - a.avgScore)

    return {
      player: player.name,
      topLeaders: sorted.slice(0, 5)
    }
  })

  const matchGroups = results.reduce((acc, r) => {
    if (!acc[r.match_id]) acc[r.match_id] = []
    acc[r.match_id].push(r)
    return acc
  }, {})

  const matchesWithRounds = Object.values(matchGroups).filter(m => m[0].matches.played_rounds !== null)
  const matches3 = matchesWithRounds.filter(m => m.length === 3)
  const matches4 = matchesWithRounds.filter(m => m.length === 4)

  const avgRounds3 = matches3.length
    ? (matches3.reduce((sum, match) => sum + (match[0].matches.played_rounds ?? 0), 0) / matches3.length).toFixed(1)
    : '–'

  const avgRounds4 = matches4.length
    ? (matches4.reduce((sum, match) => sum + (match[0].matches.played_rounds ?? 0), 0) / matches4.length).toFixed(1)
    : '–'

  const placementOverTime = []

  sortedDates.forEach(date => {
    const matchGroups = results.reduce((acc, r) => {
      if (r.matches.date !== date) return acc
      if (!acc[r.match_id]) acc[r.match_id] = []
      acc[r.match_id].push(r)
      return acc
    }, {})

    Object.entries(matchGroups).forEach(([matchId, matchResults]) => {
      const sorted = [...matchResults].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.spice !== a.spice) return b.spice - a.spice
        if (b.solari !== a.solari) return b.solari - a.solari
        return b.water - a.water
      })

      const dataPoint = { date: new Date(date).toLocaleDateString() }

      players.forEach(player => {
        const index = sorted.findIndex(r => r.players.id === player.id)
        dataPoint[player.name] = index >= 0 ? index + 1 : null
      })

      placementOverTime.push(dataPoint)
    })
  })

  return (
    <div className="container mx-auto px-4"><br />
     {/*<h1 className="text-3xl font-bold mb-6">🏆 Dashboard</h1>*/}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
  <div className="flex flex-col items-center justify-center p-4 border rounded-lg dark:bg-gray-800">
    <p className="text-sm text-gray-500">Gesamt Partien</p>
    <p className="text-3xl font-bold">{matchStats.total}</p>
  </div>
  <div className="flex flex-col items-center justify-center p-4 border rounded-lg dark:bg-gray-800">
    <p className="text-sm text-gray-500">Dune Imperium</p>
    <p className="text-3xl font-bold">{matchStats.dune}</p>
  </div>
  <div className="flex flex-col items-center justify-center p-4 border rounded-lg dark:bg-gray-800">
    <p className="text-sm text-gray-500">Dune Imperium Uprising</p>
    <p className="text-3xl font-bold">{matchStats.uprising}</p>
  </div>
</div>



      <div className="mb-4 border rounded-lg rounded p-4 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-2">⏱ Durchschnittliche Rundenanzahl</h2>
        <p><strong>Bei 3 Spielern:</strong> {avgRounds3}</p>
        <p><strong>Bei 4 Spielern:</strong> {avgRounds4}</p>
      </div>
{/*
      <h2 className="text-xl font-semibold mb-2">Spieler-Statistik</h2>
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full border border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="border p-2 text-left">Spieler</th>
              <th className="border p-2">Partien</th>
              <th className="border p-2">Siege</th>
              <th className="border p-2">Ø Punkte</th>
              <th className="border p-2">Winrate (%)</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(stat => (
              <tr key={stat.player}>
                <td className="border p-2 break-words whitespace-normal">{stat.player}</td>
                <td className="border p-2 text-center">{stat.totalGames}</td>
                <td className="border p-2 text-center">{stat.wins}</td>
                <td className="border p-2 text-center">{stat.avgScore}</td>
                <td className="border p-2 text-center">{stat.winrate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
*/}

<h2 className="text-xl font-semibold mb-2">Spieler-Statistik</h2>

{/* Desktop-Tabelle: nur auf md und größer sichtbar */}
<div className="overflow-x-auto mb-8 hidden md:block">
  <table className="min-w-full border border-collapse">
    <thead>
      <tr className="dark:bg-gray-800">
        <th className="border p-2 text-left">Spieler</th>
        <th className="border p-2">Partien</th>
        <th className="border p-2">Siege</th>
        <th className="border p-2">Ø Punkte</th>
        <th className="border p-2">Winrate (%)</th>
      </tr>
    </thead>
    <tbody>
      {playerStats.map(stat => (
        <tr key={stat.player}>
          <td className="border p-2 break-words whitespace-normal">{stat.player}</td>
          <td className="border p-2 text-center">{stat.totalGames}</td>
          <td className="border p-2 text-center">{stat.wins}</td>
          <td className="border p-2 text-center">{stat.avgScore}</td>
          <td className="border p-2 text-center">{stat.winrate}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Mobile-Version: als Cards */}
<div className="space-y-4 md:hidden">
  {playerStats.map(stat => (
    <div
      key={stat.player}
      className="mb-2 border rounded-lg p-4 shadow-sm dark:bg-gray-800"
    >
      <div className="font-semibold text-lg mb-2">{stat.player}</div>
      <div className="text-sm space-y-1">
        <div><strong>Partien:</strong> {stat.totalGames}</div>
        <div><strong>Siege:</strong> {stat.wins}</div>
        <div><strong>Ø Punkte:</strong> {stat.avgScore}</div>
        <div><strong>Winrate:</strong> {stat.winrate} %</div>
      </div>
    </div>
  ))}
</div>
<br />

      <h2 className="text-xl font-semibold mb-2">Winrate-Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={winrateOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />
          {players.map(player => (
            <Line
              key={player.id}
              type="monotone"
              dataKey={player.name}
              stroke={playerColors[player.name] || '#000'}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h2 className="text-xl font-semibold mt-10 mb-2">⏳ Punkteentwicklung im Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={avgScoreOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {players.map(player => (
            <Line
              key={player.id + '-score'}
              type="monotone"
              dataKey={player.name}
              stroke={playerColors[player.name] || '#000'}
              strokeWidth={3}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h2 className="text-xl font-semibold mt-10 mb-2">📉 Platzierungen im Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={placementOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis reversed={true} allowDecimals={true} domain={[1, 4]} />
          <Tooltip />
          <Legend />
          {players.map(player => (
            <Line
              key={player.id + '-placement'}
              type="monotone"
              dataKey={player.name}
              stroke={playerColors[player.name] || '#000'}
              strokeWidth={3}
              dot={true}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
{/*
      <div className="flex items-center justify-between mt-10 mb-2">
        <h2 className="text-xl font-semibold">Top 5 Leader pro Spieler</h2>
        <button
          onClick={() => setLeaderMode(leaderMode === 'mostUsed' ? 'bestScore' : 'mostUsed')}
          className="bg-gray-200 px-3 py-1 rounded"
        >
          {leaderMode === 'mostUsed' ? 'Zeige beste Leader nach Punkten' : 'Zeige meistgespielte Leader'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leaderStats.map(stat => (
          <div key={stat.player} className="border p-4 rounded shadow">
            <h3 className="font-semibold mb-2">{stat.player}</h3>
            <table className="w-full border border-collapse">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border p-2 text-left">Leader</th>
                  <th className="border p-2 text-center">
                    {leaderMode === 'mostUsed' ? 'Spiele' : 'Ø Punkte'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stat.topLeaders.map(leader => (
                  <tr key={leader.name}>
                    <td className="border p-2">{leader.name}</td>
                    <td className="border p-2 text-center">
                      {leaderMode === 'mostUsed' ? `${leader.count}` : `${leader.avgScore}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>*/}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-10 mb-2 gap-2">
        <h2 className="text-xl font-semibold">Top 5 Leader pro Spieler</h2>
        <button
          onClick={() => setLeaderMode(leaderMode === 'mostUsed' ? 'bestScore' : 'mostUsed')}
          className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded flex items-center gap-2 text-sm"
        >
          {leaderMode === 'mostUsed' ? (
            <>
              <Star className="w-4 h-4" />
              Zeige beste Leader nach Punkten
            </>
          ) : (
            <>
              <Shuffle className="w-4 h-4" />
              Zeige meistgespielte Leader
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leaderStats.map(stat => (
          <div
            key={stat.player}
            className="border p-4 rounded shadow max-h-80 overflow-y-auto dark:bg-gray-800"
          >
            <h3 className="font-semibold mb-2 text-base md:text-lg">{stat.player}</h3>
            <table className="w-full table-fixed border border-collapse text-sm md:text-base">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="border p-2 text-left w-2/3">Leader</th>
                  <th className="border p-2 text-center w-1/3">
                    {leaderMode === 'mostUsed' ? 'Spiele' : 'Ø Punkte'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stat.topLeaders.map(leader => (
                  <tr key={leader.name}>
                    <td className="border p-2 break-words whitespace-normal">{leader.name}</td>
                    <td className="border p-2 text-center">
                      {leaderMode === 'mostUsed' ? `${leader.count}` : `${leader.avgScore}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>


    </div>
    
  )
}
