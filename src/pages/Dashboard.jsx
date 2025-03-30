import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Trophy, TrendingUp, Shuffle, Star } from 'lucide-react';
import {
  PieChart, Pie, Cell,LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'


const playerColors = {
  Janosch: '#3B82F6',
  Hubertus: '#10B981',
  Casjen: '#EF4444',
  Alex: '#FFBF00'
}

const playerLineStyles = {
  Janosch: { strokeDasharray: "5 5", dot: { strokeWidth: 2, r: 4, fill: "#3B82F6" } },
  Hubertus: { strokeDasharray: "3 3", dot: { strokeWidth: 2, r: 4, fill: "#10B981" }  },
  Casjen: { strokeDasharray: "", dot: { strokeWidth: 2, r: 4, fill: "#EF4444" } },
  Alex: { strokeDasharray: "2 2", dot: { strokeWidth: 2, r: 4, fill: "#FFBF00"} },
};

export default function Dashboard() {
  const [results, setResults] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [leaderMode, setLeaderMode] = useState('mostUsed')
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 })
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);



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

  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-600">Lade Dashboard...</div>;


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

  // Platzierungs-Übersicht pro Spieler berechnen
const placementsPerPlayer = players.map(player => {
  const placementCounts = {};
  let totalGames = 0;
  results.forEach(result => {
    if (result.players.id === player.id) {
      const matchResults = results.filter(r => r.match_id === result.match_id);
      const sorted = matchResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.spice !== a.spice) return b.spice - a.spice;
        if (b.solari !== a.solari) return b.solari - a.solari;
        return b.water - a.water;
      });
      const placement = sorted.findIndex(r => r.players.id === player.id) + 1;
      placementCounts[placement] = (placementCounts[placement] || 0) + 1;
      totalGames++;
    }
  });
  const placementPercentages = {};
  Object.entries(placementCounts).forEach(([place, count]) => {
    placementPercentages[place] = ((count / totalGames) * 100).toFixed(1);
  });
  return {
    player: player.name,
    placements: placementPercentages
  };
});

const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];

const placementPieData = placementsPerPlayer.length > 0
  ? placementsPerPlayer.map(playerData => {
      return Object.entries(playerData.placements).map(([place, percentage]) => ({
        name: `${place}. Platz`,
        value: parseFloat(percentage)
      }));
    })
  : [];



// Globale Leader-Statistik berechnen
const leaderOccurrences = {};
const leaderWins = {};

results.forEach(result => {
  const leaderName = result.leaders?.name;
  if (!leaderName) return;

  leaderOccurrences[leaderName] = (leaderOccurrences[leaderName] || 0) + 1;

  const matchResults = results.filter(r => r.match_id === result.match_id);
  const winner = getWinner(matchResults);

  const winnerLeaderName = winner?.leaders?.name;
  if (winnerLeaderName && winnerLeaderName === leaderName) {
    leaderWins[leaderName] = (leaderWins[leaderName] || 0) + 1;
  }
});

const leaderStatsGlobal = Object.entries(leaderOccurrences).map(([name, count]) => ({
  name,
  count,
  winrate: leaderWins[name] ? ((leaderWins[name] / count) * 100).toFixed(1) : '0.0'
}));

const top7Leaders = leaderModeGlobal === 'mostUsed'
  ? [...leaderStatsGlobal].sort((a, b) => b.count - a.count).slice(0, 7)
  : [...leaderStatsGlobal].sort((a, b) => parseFloat(b.winrate) - parseFloat(a.winrate)).slice(0, 7);



  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">

<h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
  <Trophy className="text-green-400" /> Dashboard
</h1>

     {/*<h1 className="text-3xl font-bold mb-6">🏆 Dashboard</h1>*/}
     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[{label: 'Gesamt Partien', value: matchStats.total}, {label: 'Dune Imperium', value: matchStats.dune}, {label: 'Dune Imperium Uprising', value: matchStats.uprising}].map((item) => (
          <div key={item.label} className="p-5 bg-white rounded-xl shadow-lg transform hover:scale-105 transition duration-300">
            <div className="text-4xl font-bold text-green-500 mb-2">{item.value}</div>
            <div className="text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>



      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <Star className="text-yellow-400" /> Globale Top 7 Leader
    </h2>
    <button
      onClick={() => setLeaderModeGlobal(leaderModeGlobal === 'mostUsed' ? 'bestWinrate' : 'mostUsed')}
      className="bg-gray-200 hover:bg-gray-300 px-3 py-1 dark:text-white rounded flex items-center gap-2 text-sm"
    >
      {leaderModeGlobal === 'mostUsed' ? (
        <><Shuffle className="w-4 h-4" /> Nach Siegquote anzeigen</>
      ) : (
        <><Star className="w-4 h-4" /> Meistgespielte anzeigen</>
      )}
    </button>
  </div>

  <table className="mt-4 w-full text-left">
    <thead>
      <tr className="bg-gray-800 text-white">
        <th className="p-2">Leader</th>
        <th className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? 'Spiele' : 'Siegquote (%)'}</th>
        <th className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? 'Siegquote (%)' : 'Spiele'}</th>
      </tr>
    </thead>
    <tbody>
      {top7Leaders.map(leader => (
        <tr key={leader.name} className="border-t">
          <td className="p-2 font-medium">{leader.name}</td>
          <td className="p-2 text-center">
            {leaderModeGlobal === 'mostUsed' ? leader.count : `${leader.winrate}%`}
          </td>
          <td className="p-2 text-center">
            {leaderModeGlobal === 'mostUsed' ? `${leader.winrate}%` : leader.count}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>


      <div className="bg-white rounded-xl shadow-lg flex-wrap p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><TrendingUp className="text-blue-500" /> Durchschnittliche Rundenanzahl</h2>
        <p><strong>3 Spieler:</strong> {avgRounds3}</p>
        <p><strong>4 Spieler:</strong> {avgRounds4}</p>
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



{/* Desktop-Tabelle: nur auf md und größer sichtbar 
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
</div>*/}




 <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Star className="text-yellow-400" /> Spieler-Statistik</h2>
      <div className="overflow-auto mb-8 bg-white rounded-xl shadow-lg flex-wrap hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              {['Spieler', 'Partien', 'Siege', 'Ø Punkte', 'Winrate (%)'].map((head) => (
                <th key={head} className="p-4 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerStats.map((stat) => (
              <tr key={stat.player} className="border-t">
                <td className="p-4 font-semibold">{stat.player}</td>
                <td className="p-4">{stat.totalGames}</td>
                <td className="p-4">{stat.wins}</td>
                <td className="p-4">{stat.avgScore}</td>
                <td className="p-4">{stat.winrate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

{/* Mobile-Version: als Cards */}
<div className="space-y-4 flex-wrap md:hidden">
        {playerStats.map(stat => (
          <div key={stat.player} className="p-5 bg-white rounded-xl shadow-lg transform hover:scale-105 transition duration-300">
            <div className="text-xl font-semibold text-gray-800 mb-2">{stat.player}</div>
            <div className="text-sm text-gray-600">
              <div><strong>Partien:</strong> {stat.totalGames}</div>
              <div><strong>Siege:</strong> {stat.wins}</div>
              <div><strong>Ø Punkte:</strong> {stat.avgScore}</div>
              <div><strong>Winrate:</strong> {stat.winrate}%</div>
            </div>
          </div>
        ))}
      </div>
      <br />

      <h2 className="text-xl font-semibold mb-4">📈 Winrate-Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={winrateOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend iconType="plainline" />
          {players.map(player => (
             <Line
             key={player.id}
             type="monotone"
             dataKey={player.name}
             stroke={playerColors[player.name] || '#000'}
             strokeWidth={3}
             strokeDasharray={playerLineStyles[player.name]?.strokeDasharray}
             dot={false}
           />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <h2 className="text-xl font-semibold mt-10 mb-4">⏳ Punkteentwicklung im Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={avgScoreOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend iconType="plainline" />
          {players.map(player => (
             <Line
             key={player.id}
             type="monotone"
             dataKey={player.name}
             stroke={playerColors[player.name] || '#000'}
             strokeWidth={3}
             strokeDasharray={playerLineStyles[player.name]?.strokeDasharray}
             dot={false}
           />
          ))}
        </LineChart>
      </ResponsiveContainer>

     {/* Übersicht Platzierungen pro Spieler 
     <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
    🥇 Übersicht der Platzierungen pro Spieler (in %)
  </h2>
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead className="bg-gray-800 text-white">
        <tr>
          <th className="p-2">Spieler</th>
          {Array.from({ length: players.length }, (_, i) => i + 1).map(place => (
            <th key={place} className="p-2 text-center">{place}. Platz</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {placementsPerPlayer.map(stat => (
          <tr key={stat.player} className="border-t">
            <td className="p-2 font-medium">{stat.player}</td>
            {Array.from({ length: players.length }, (_, i) => i + 1).map(place => (
              <td key={place} className="p-2 text-center">
                {stat.placements[place] ? `${stat.placements[place]}%` : '0.0%'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>*/}

<div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 mb-8">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
      🥧 Platzierungen
    </h2>
    <div className="flex flex-wrap gap-2 justify-start sm:justify-end max-w-full">
      {placementsPerPlayer.map((stat, index) => (
        <button
          key={stat.player}
          onClick={() => setSelectedPlayerIndex(index)}
          className={`px-3 py-1 rounded text-sm border whitespace-nowrap transition
            ${
              selectedPlayerIndex === index
                ? 'bg-blue-500 text-green-500 border-blue-500'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:border-gray-600'
            }`}
        >
          {stat.player}
        </button>
      ))}
    </div>
  </div>

  {placementPieData.length > 0 && (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={placementPieData[selectedPlayerIndex]}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
        >
          {placementPieData[selectedPlayerIndex].map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )}
</div>

 {/*  Platzierungen pro Spieler Flussdiagramm

      <h2 className="text-xl font-semibold mt-10 mb-2">📉 Platzierungen im Verlauf</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={placementOverTime}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis reversed={true} allowDecimals={true} domain={[1, 4]} />
          <Tooltip />
          <Legend iconType="plainline" />
          {players.map(player => (
             <Line
             key={player.id}
             type="monotone"
             dataKey={player.name}
             stroke={playerColors[player.name] || '#000'}
             strokeWidth={3}
             strokeDasharray={playerLineStyles[player.name]?.strokeDasharray}
             dot={playerLineStyles[player.name].dot}
           />
          ))}
        </LineChart>
      </ResponsiveContainer> */}

    
      
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap mt-10 mb-4 gap-2 overflow-x-auto">
        <h2 className="text-xl font-semibold">Top 5 Leader pro Spieler</h2>
        <button
          onClick={() => setLeaderMode(leaderMode === 'mostUsed' ? 'bestScore' : 'mostUsed')}
          className="bg-gray-200 hover:bg-gray-300 px-3 py-1 dark:text-white rounded flex items-center gap-2 text-sm"
        >
          {leaderMode === 'mostUsed' ? (
            <><Star className="w-4 h-4 dark:text-white" /> Zeige beste Leader nach Punkten</>
          ) : (
            <><Shuffle className="w-4 h-4 dark:text-white" /> Zeige meistgespielte Leader</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-x-auto">
        {leaderStats.map(stat => (
          <div key={stat.player} className="p-4 bg-white rounded-xl shadow-lg overflow-auto">
            <h3 className="font-semibold mb-2 text-base md:text-lg text-gray-800">{stat.player}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm md:text-base">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="p-2 text-left">Leader</th>
                    <th className="p-2 text-center whitespace-nowrap">
                      {leaderMode === 'mostUsed' ? 'Spiele' : 'Ø Punkte'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stat.topLeaders.map(leader => (
                    <tr key={leader.name} className="border-t">
                      <td className="p-2 break-words whitespace-normal">{leader.name}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {leaderMode === 'mostUsed' ? `${leader.count}` : `${leader.avgScore}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>


    </div>
    
  )
}
