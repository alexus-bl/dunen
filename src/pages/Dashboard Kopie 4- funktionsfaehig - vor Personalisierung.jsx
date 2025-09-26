// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Trophy, TrendingUp, Shuffle, Star, ChevronDown } from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useGroup } from '../context/GroupContext';

// Erlaubte Spielerfarben
const ALLOWED_COLORS = ['#3B82F6', '#10B981', '#EF4444', '#FFBF00'];

// Fallback-Farbe (deterministisch), falls kein favorite_color gesetzt ist
function colorFallbackFor(nameOrId) {
  let hash = 0;
  const s = String(nameOrId || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return ALLOWED_COLORS[hash % ALLOWED_COLORS.length];
}

// Optionale Linienmuster (zur Unterscheidung), unabhängig vom Namen
function lineStyleFor(player) {
  const key = String(player?.id ?? player?.username ?? '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const patterns = ['', '5 5', '3 3', '2 2']; // rotiert deterministisch
  return { strokeDasharray: patterns[hash % patterns.length] };
}

export default function Dashboard() {

  const { groupId, setGroupId } = useGroup();
  const [groupName, setGroupName] = useState('');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [results, setResults] = useState([]);
  const [players, setPlayers] = useState([]);

  const [leaderMode, setLeaderMode] = useState('mostUsed');
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);

  // Pro-Spieler Expand/Collapse
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const togglePlayerExpanded = (playerName) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerName)) next.delete(playerName);
      else next.add(playerName);
      return next;
    });
  };

  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 });

  useEffect(() => {
    if (!groupId) {
      try {
        const last = localStorage.getItem('lastGroupId');
        if (last) setGroupId(last);
      } catch {}
    }
  }, [groupId, setGroupId]);

  // Aktiven Gruppennamen laden
  useEffect(() => {
    let cancelled = false;
    const fetchGroupName = async () => {
      if (!groupId) { setGroupName(''); return; }
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      if (!cancelled) {
        if (error) {
          console.error('[Dashboard] groups error:', error.message);
          setGroupName('');
        } else {
          setGroupName(data?.name || '');
        }
      }
    };
    fetchGroupName();
    return () => { cancelled = true; };
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;

    const fetchMatchStats = async () => {
      if (!groupId) return;
      const { data, error, status } = await supabase
        .from('matches')
        .select('id, group_id, game_id, games ( id, name )')
        .eq('group_id', groupId);
      if (error) {
        console.error('[Dashboard] matches error:', status, error.message);
        return;
      }
      const rows = data || [];
      const total = rows.length;
      const dune = rows.filter(m => m.games?.name === 'Dune Imperium').length;
      const uprising = rows.filter(m => m.games?.name === 'Dune Imperium Uprising').length;
      setMatchStats({ total, dune, uprising });
    };

    const fetchData = async () => {
      setLoading(true);
      setErr(null);
      try {
        if (!groupId) {
          setLoading(false);
          navigate('/groups');
          return;
        }

        const { data, error, status } = await supabase
          .from('results')
          .select(`
            id,
            match_id,
            score,
            spice,
            solari,
            water,
            leader_id,
            players ( id, username, favorite_color ),
            leaders ( id, name ),
            matches ( id, date, played_rounds, group_id )
          `)
          .eq('matches.group_id', groupId);

        if (error) {
          console.error('[Dashboard] results error:', status, error.message);
          throw new Error(error.message);
        }

        const filtered = (data || []).filter(r =>
          r?.matches?.group_id === groupId &&
          r?.players?.id != null &&
          r?.matches?.id != null
        );

        setResults(filtered);

        const uniquePlayers = [
          ...new Map(
            filtered
              .filter(r => r.players && r.players.id != null)
              .map(r => [r.players.id, {
                id: r.players.id,
                username: r.players.username,
                favorite_color: r.players.favorite_color
              }])
          ).values()
        ];
        setPlayers(uniquePlayers);
      } catch (e) {
        console.error('[Dashboard] load error:', e);
        setErr(e.message || 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (groupId) {
      fetchData();
      fetchMatchStats();
    }

    return () => { cancelled = true; };
  }, [groupId, navigate]);

  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-600">Lade Dashboard...</div>;
  if (err)     return <div className="p-4 text-red-400">Fehler beim Laden des Dashboards: {err}</div>;

  // ---------- Helpers & abgeleitete Daten ----------
  const validResults = results.filter(r => r && r.players?.id != null);
  const uniqueMatchIds = [...new Set(validResults.map(r => r.match_id))];

  function safeNum(n) { return typeof n === 'number' ? n : 0; }

  function getWinner(matchResults) {
    const arr = (matchResults || []).filter(x => x && x.players?.id != null);
    if (!arr.length) return null;
    return [...arr].sort((a, b) => {
      if (safeNum(b.score) !== safeNum(a.score)) return safeNum(b.score) - safeNum(a.score);
      if (safeNum(b.spice) !== safeNum(a.spice)) return safeNum(b.spice) - safeNum(a.spice);
      if (safeNum(b.solari) !== safeNum(a.solari)) return safeNum(b.solari) - safeNum(a.solari);
      return safeNum(b.water) - safeNum(a.water);
    })[0] || null;
  }

  const playerStats = players.map(player => {
    const playerResults = validResults.filter(r => r.players.id === player.id);
    const totalGames = playerResults.length;

    const wins = uniqueMatchIds.reduce((acc, matchId) => {
      const matchResults = validResults.filter(r => r.match_id === matchId);
      const winner = getWinner(matchResults);
      return winner?.players?.id === player.id ? acc + 1 : acc;
    }, 0);

    const avgScore = totalGames
      ? (playerResults.reduce((sum, r) => sum + safeNum(r.score), 0) / totalGames).toFixed(1)
      : '0.0';

    const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0';

    return {
      id: player.id,
      player: player.username,
      totalGames,
      wins,
      winrate: parseFloat(winrate),
      avgScore: parseFloat(avgScore),
    };
  });

  const sortedDates = [...new Set(validResults.map(r => r.matches?.date).filter(Boolean))].sort();

  const winrateOverTime = sortedDates.map(date => {
    const dateResults = validResults.filter(r => r.matches?.date && r.matches.date <= date);
    const matchIdsToDate = [...new Set(dateResults.map(r => r.match_id))];
    const dataPoint = { date: new Date(date).toLocaleDateString() };

    players.forEach(player => {
      const playerResults = dateResults.filter(r => r.players.id === player.id);
      const totalGames = playerResults.length;
      const wins = matchIdsToDate.reduce((acc, matchId) => {
        const matchResults = dateResults.filter(r => r.match_id === matchId);
        const winner = getWinner(matchResults);
        return winner?.players?.id === player.id ? acc + 1 : acc;
      }, 0);
      const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
      dataPoint[player.username] = parseFloat(winrate);
    });

    return dataPoint;
  });

  const avgScoreOverTime = sortedDates.map(date => {
    const dateResults = validResults.filter(r => r.matches?.date && r.matches.date <= date);
    const dataPoint = { date: new Date(date).toLocaleDateString() };

    players.forEach(player => {
      const playerResults = dateResults.filter(r => r.players.id === player.id);
      const totalGames = playerResults.length;
      const avg = totalGames
        ? (playerResults.reduce((sum, r) => sum + safeNum(r.score), 0) / totalGames).toFixed(1)
        : 0;
      dataPoint[player.username] = parseFloat(avg);
    });

    return dataPoint;
  });

  // Leader pro Spieler – komplette Liste (Begrenzung erst im Render)
  const leaderStatsPerPlayer = players.map(player => {
    const playerResults = validResults.filter(r => r.players.id === player.id && r.leaders?.name);
    const leaderMap = {};
    playerResults.forEach(r => {
      const name = r.leaders.name;
      if (!name) return;
      if (!leaderMap[name]) leaderMap[name] = { count: 0, totalScore: 0 };
      leaderMap[name].count += 1;
      leaderMap[name].totalScore += safeNum(r.score);
    });

    const leadersArray = Object.entries(leaderMap).map(([name, data]) => ({
      name,
      count: data.count,
      avgScore: (data.totalScore / data.count).toFixed(1),
    }));

    const sorted = leaderMode === 'mostUsed'
      ? leadersArray.sort((a, b) => b.count - a.count)
      : leadersArray.sort((a, b) => b.avgScore - a.avgScore);

    return { player: player.username, leaders: sorted };
  });

  const matchGroups = validResults.reduce((acc, r) => {
    if (!acc[r.match_id]) acc[r.match_id] = [];
    acc[r.match_id].push(r);
    return acc;
  }, {});
  const matchesWithRounds = Object.values(matchGroups).filter(
    m => m[0]?.matches?.played_rounds != null
  );
  const matches3 = matchesWithRounds.filter(m => m.length === 3);
  const matches4 = matchesWithRounds.filter(m => m.length === 4);

  const avgRounds3 = matches3.length
    ? (matches3.reduce((sum, match) => sum + (match[0]?.matches?.played_rounds ?? 0), 0) / matches3.length).toFixed(1)
    : '–';
  const avgRounds4 = matches4.length
    ? (matches4.reduce((sum, match) => sum + (match[0]?.matches?.played_rounds ?? 0), 0) / matches4.length).toFixed(1)
    : '–';

  const placementsPerPlayer = players.map(player => {
    const placementCounts = {};
    let totalGames = 0;
    validResults.forEach(result => {
      if (result.players.id === player.id) {
        const matchResults = validResults.filter(r => r.match_id === result.match_id);
        const sorted = matchResults
          .filter(r => r.players?.id != null)
          .sort((a, b) => {
            if (safeNum(b.score) !== safeNum(a.score)) return safeNum(b.score) - safeNum(a.score);
            if (safeNum(b.spice) !== safeNum(a.spice)) return safeNum(b.spice) - safeNum(a.spice);
            if (safeNum(b.solari) !== safeNum(a.solari)) return safeNum(b.solari) - safeNum(a.solari);
            return safeNum(b.water) - safeNum(a.water);
          });
        const placement = sorted.findIndex(r => r.players.id === player.id) + 1;
        if (placement > 0) {
          placementCounts[placement] = (placementCounts[placement] || 0) + 1;
          totalGames++;
        }
      }
    });
    const placementPercentages = {};
    Object.entries(placementCounts).forEach(([place, count]) => {
      placementPercentages[place] = ((count / (totalGames || 1)) * 100).toFixed(1);
    });
    return { player: player.username, placements: placementPercentages };
  });

  const leaderOccurrences = {};
  const leaderWins = {};
  validResults.forEach(result => {
    const leaderName = result.leaders?.name;
    if (!leaderName) return;
    leaderOccurrences[leaderName] = (leaderOccurrences[leaderName] || 0) + 1;

    const matchResults = validResults.filter(r => r.match_id === result.match_id);
    const winner = getWinner(matchResults);
    const winnerLeaderName = winner?.leaders?.name;
    if (winnerLeaderName && winnerLeaderName === leaderName) {
      leaderWins[leaderName] = (leaderWins[leaderName] || 0) + 1;
    }
  });
  const leaderStatsGlobal = Object.entries(leaderOccurrences).map(([name, count]) => ({
    name,
    count,
    winrate: leaderWins[name] ? ((leaderWins[name] / count) * 100).toFixed(1) : '0.0',
  }));
  const top7Leaders = leaderModeGlobal === 'mostUsed'
    ? [...leaderStatsGlobal].sort((a, b) => b.count - a.count).slice(0, 7)
    : [...leaderStatsGlobal].sort((a, b) => parseFloat(b.winrate) - parseFloat(a.winrate)).slice(0, 7);

  // Farbzuordnung für Charts (aus favorite_color oder Fallback)
  const playerColorMap = players.reduce((acc, p) => {
    const c = ALLOWED_COLORS.includes(p.favorite_color)
      ? p.favorite_color
      : colorFallbackFor(p.id || p.username);
    acc[p.username] = c;
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <Trophy className="text-green-400 w-6 h-6" /> Dashboard
      </h1>

      {/* Aktive Gruppe */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
          <span className="font-semibold">Aktive Gruppe:</span>
          <span className="font-medium">{groupName || '–'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[{label:'Gesamt Partien',value:matchStats.total},{label:'Dune Imperium',value:matchStats.dune},{label:'Dune Imperium Uprising',value:matchStats.uprising}]
          .map(item=>(
          <div key={item.label} className="p-5 bg-white rounded-xl shadow-lg transform hover:scale-105 transition duration-300">
            <div className="text-4xl font-bold text-green-500 mb-2">{item.value}</div>
            <div className="text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white flex-wrap rounded-xl shadow-lg p-6 mb-8 sm:flex-row sm:items-center sm:justify-between mt-10 mb-4 gap-2 overflow-x-auto">
        <div className="flex flex-col sm:items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Star className="text-yellow-400" /> Top 7 Leader
          </h2>
          <button
            onClick={() => setLeaderModeGlobal(leaderModeGlobal === 'mostUsed' ? 'bestWinrate' : 'mostUsed')}
            className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded flex items-center gap-2 text-sm"
          >
            {leaderModeGlobal === 'mostUsed' ? (<><Shuffle className="w-4 h-4" /> Nach Winrate anzeigen</>) : (<><Star className="w-4 h-4" /> Meistgespielte anzeigen</>)}
          </button>
        </div>
        <table className="mt-4 w-full text-left">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="p-2">Leader</th>
              <th className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? 'Spiele' : 'Winrate'}</th>
              <th className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? 'Winrate' : 'Spiele'}</th>
            </tr>
          </thead>
          <tbody>
            {top7Leaders.map(leader => (
              <tr key={leader.name} className="border-t">
                <td className="p-2 font-medium">{leader.name}</td>
                <td className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? leader.count : `${leader.winrate}%`}</td>
                <td className="p-2 text-center">{leaderModeGlobal === 'mostUsed' ? `${leader.winrate}%` : leader.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><TrendingUp className="text-blue-500" /> Durchschnittliche Rundenanzahl</h2>
        <p><strong>3 Spieler:</strong> {avgRounds3}</p>
        <p><strong>4 Spieler:</strong> {avgRounds4}</p>
      </div>

      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Star className="text-yellow-400" /> Spieler-Statistik</h2>
      <div className="overflow-auto mb-8 bg-white rounded-xl shadow-lg flex-wrap hidden md:block">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              {['Spieler','Partien','Siege','Ø Punkte','Winrate (%)'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {playerStats.map(stat => (
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

      {/* Mobile Cards */}
      <div className="space-y-4 flex-wrap md:hidden">
        {playerStats.map(stat => (
          <div key={stat.player} className="p-5 bg-white rounded-xl shadow-lg">
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

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
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
                dataKey={player.username}
                stroke={playerColorMap[player.username] || '#000'}
                strokeWidth={3}
                strokeDasharray={lineStyleFor(player).strokeDasharray}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">⏳ Punkteentwicklung</h2>
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
                dataKey={player.username}
                stroke={playerColorMap[player.username] || '#000'}
                strokeWidth={3}
                strokeDasharray={lineStyleFor(player).strokeDasharray}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Placements */}
      <PlacementsSection
        placementsPerPlayer={players.map(player => {
          const placementCounts = {};
          let totalGames = 0;
          validResults.forEach(result => {
            if (result.players.id === player.id) {
              const matchResults = validResults.filter(r => r.match_id === result.match_id);
              const sorted = matchResults
                .filter(r => r.players?.id != null)
                .sort((a, b) => {
                  if (safeNum(b.score) !== safeNum(a.score)) return safeNum(b.score) - safeNum(a.score);
                  if (safeNum(b.spice) !== safeNum(a.spice)) return safeNum(b.spice) - safeNum(a.spice);
                  if (safeNum(b.solari) !== safeNum(a.solari)) return safeNum(b.solari) - safeNum(a.solari);
                  return safeNum(b.water) - safeNum(a.water);
                });
              const placement = sorted.findIndex(r => r.players.id === player.id) + 1;
              if (placement > 0) {
                placementCounts[placement] = (placementCounts[placement] || 0) + 1;
                totalGames++;
              }
            }
          });
          const placementPercentages = {};
          Object.entries(placementCounts).forEach(([place, count]) => {
            placementPercentages[place] = ((count / (totalGames || 1)) * 100).toFixed(1);
          });
          return { player: player.username, placements: placementPercentages };
        })}
        selectedPlayerIndex={selectedPlayerIndex}
        setSelectedPlayerIndex={setSelectedPlayerIndex}
      />

      {/* Leader pro Spieler – pro Karte expand/collapse */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap mt-10 mb-4 gap-2 overflow-x-auto">
        <h2 className="text-xl font-semibold">Leader pro Spieler</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setLeaderMode(leaderMode === 'mostUsed' ? 'bestScore' : 'mostUsed')}
            className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded flex items-center gap-2 text-sm"
          >
            {leaderMode === 'mostUsed'
              ? (<><Star className="w-4 h-4" /> Zeige beste Leader nach Punkten</>)
              : (<><Shuffle className="w-4 h-4" /> Zeige meistgespielte Leader</>)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-x-auto">
        {leaderStatsPerPlayer.map(stat => {
          const isExpanded = expandedPlayers.has(stat.player);
          const rows = isExpanded ? stat.leaders : stat.leaders.slice(0, 5);
          return (
            <div key={stat.player} className="p-4 bg-white rounded-xl shadow-lg overflow-auto">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-base md:text-lg text-gray-800">{stat.player}</h3>
                <button
                  onClick={() => togglePlayerExpanded(stat.player)}
                  className="inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition"
                  aria-expanded={isExpanded}
                  aria-controls={`leader-table-${stat.player}`}
                >
                  {isExpanded ? 'Top 5 anzeigen' : 'Alle Leader anzeigen'}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table
                  id={`leader-table-${stat.player}`}
                  className="w-full border-collapse text-sm md:text-base"
                >
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="p-2 text-left">Leader</th>
                      <th className="p-2 text-center whitespace-nowrap">
                        {leaderMode === 'mostUsed' ? 'Spiele' : 'Ø Punkte'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(leader => (
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
          );
        })}
      </div>
    </div>
  );
}

function PlacementsSection({ placementsPerPlayer, selectedPlayerIndex, setSelectedPlayerIndex }) {
  const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];
  const placementPieData = placementsPerPlayer.length > 0
    ? placementsPerPlayer.map(playerData =>
        Object.entries(playerData.placements).map(([place, percentage]) => ({
          name: `${place}. Platz`,
          value: parseFloat(percentage),
        }))
      )
    : [];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 ">
          🥧 Platzierungen
        </h2>
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end max-w-full">
          {placementsPerPlayer.map((stat, index) => (
            <button
              key={stat.player}
              onClick={() => setSelectedPlayerIndex(index)}
              className={`px-3 py-1 rounded text-sm border whitespace-nowrap transition
                ${selectedPlayerIndex === index
                    ? 'bg-green-500 text-white border-blue-500'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300'}`}
            >
              {stat.player}
            </button>
          ))}
        </div>
      </div>

      {placementPieData.length > 0 && (
        <div className="relative w-full h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={placementPieData[selectedPlayerIndex]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                paddingAngle={5}
                innerRadius={55}
                outerRadius={75}
                labelLine={false}
                labelRadius={50}
                label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              >
                {placementPieData[selectedPlayerIndex].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="text-sm font-xs text-gray-600">
              {placementsPerPlayer[selectedPlayerIndex]?.player}
            </div>
            <div className="text-sm font-xs text-gray-600">Ø Platzierung</div>
            <div className="text-xl font-bold text-gray-800">
              {(() => {
                const chart = placementsPerPlayer[selectedPlayerIndex];
                const avg = Object.entries(chart.placements).reduce((sum, [place, percent]) => {
                  return sum + parseInt(place) * (parseFloat(percent) / 100);
                }, 0);
                return avg.toFixed(2);
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
