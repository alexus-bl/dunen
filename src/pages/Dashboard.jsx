// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Trophy, TrendingUp, Shuffle, Star, ChevronDown, 
  Settings2, User, Loader2 
} from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useGroup } from '../context/GroupContext';

// --- Helper & Konstanten ---
const ALLOWED_COLORS = ['#3B82F6', '#10B981', '#EF4444', '#FFBF00'];
const colorFallbackFor = (id) => ALLOWED_COLORS[id % ALLOWED_COLORS.length] || ALLOWED_COLORS[0];
const safeNum = (n) => (typeof n === 'number' ? n : 0);

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Daten aus dem neuen optimierten Context
  const { groupId, activeGroup, loading: groupLoading } = useGroup();

  // --- Lokale States für Spieldaten ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [results, setResults] = useState([]);
  const [playersWithData, setPlayersWithData] = useState([]);
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 });

  // UI-States
  const [userVisibleIds, setUserVisibleIds] = useState([]); // Eigene Wahl des Users
  const [showPrefs, setShowPrefs] = useState(false);
  const [leaderMode, setLeaderMode] = useState('mostUsed');
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [showAllLeadersGlobal, setShowAllLeadersGlobal] = useState(false);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // --- 1. Policy & Settings aus Context ableiten ---
  const layoutPolicy = activeGroup?.layout_policy || 'member_custom';
  const hideMemberWinrate = !!activeGroup?.hide_member_winrate;

  // --- 2. Basisdaten laden ---
  useEffect(() => {
    async function initDashboard() {
      if (!groupId) return;
      setLoading(true);
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return navigate('/');

        const [meRes, membersRes, prefRes] = await Promise.all([
          supabase.from('players').select('id, username, favorite_color').eq('user_id', authUser.id).maybeSingle(),
          supabase.from('group_members').select('players(id, username, favorite_color)').eq('group_id', groupId),
          supabase.rpc('load_dashboard_prefs', { p_group_id: groupId })
        ]);

        if (meRes.data) setMe(meRes.data);
        if (membersRes.data) setMembers(membersRes.data.map(m => m.players).filter(Boolean));
        if (prefRes.data) setUserVisibleIds(prefRes.data.map(Number));
      } catch (e) {
        setErr(e.message);
      }
    }
    initDashboard();
  }, [groupId, navigate]);

  // --- 3. Spieler-Ergebnisse laden ---
  useEffect(() => {
    async function fetchResults() {
      if (!groupId) return;
      try {
        const { data, error } = await supabase
          .from('results')
          .select(`
            id, score, spice, solari, water, match_id,
            players ( id, username, favorite_color ),
            leaders ( id, name ),
            matches ( id, date, played_rounds, group_id, games(name) )
          `)
          .eq('matches.group_id', groupId);

        if (error) throw error;

        const filtered = (data || []).filter(r => r.matches && r.players);
        setResults(filtered);

        const uniquePlayers = [...new Map(filtered.map(r => [r.players.id, r.players])).values()];
        setPlayersWithData(uniquePlayers);

        const matchIds = [...new Set(filtered.map(r => r.match_id))];
        const uniqueMatches = matchIds.map(id => filtered.find(r => r.match_id === id).matches);
        setMatchStats({
          total: matchIds.length,
          dune: uniqueMatches.filter(m => m.games?.name === 'Dune Imperium').length,
          uprising: uniqueMatches.filter(m => m.games?.name === 'Dune Imperium Uprising').length,
        });
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [groupId]);

  // --- 4. Logik: Welche Spieler anzeigen? (DER BUG-FIX) ---
  const displayPlayers = useMemo(() => {
    let ids = [];
    if (layoutPolicy === 'force_all') {
      ids = members.map(m => m.id);
    } else if (layoutPolicy === 'force_self') {
      ids = me ? [me.id] : [];
    } else {
      // member_custom: Eigene Wahl oder Fallback auf sich selbst
      ids = userVisibleIds.length > 0 ? userVisibleIds : (me ? [me.id] : []);
    }
    return playersWithData.filter(p => ids.includes(p.id));
  }, [layoutPolicy, members, me, userVisibleIds, playersWithData]);

  // Speichern der User-Präferenz (nur wenn Policy es erlaubt)
  useEffect(() => {
    if (layoutPolicy === 'member_custom' && userVisibleIds.length > 0 && me && groupId) {
      supabase.rpc('save_dashboard_prefs', {
        p_group_id: groupId,
        p_visible_player_ids: userVisibleIds
      }).catch(console.error);
    }
  }, [userVisibleIds, layoutPolicy, me, groupId]);

  // --- 5. Statistische Berechnungen ---
  const getWinner = (mResults) => {
    if (!mResults.length) return null;
    return [...mResults].sort((a, b) => 
      safeNum(b.score) - safeNum(a.score) || safeNum(b.spice) - safeNum(a.spice) || safeNum(b.solari) - safeNum(a.solari) || safeNum(b.water) - safeNum(a.water)
    )[0];
  };

  const playerStatsVisible = useMemo(() => {
    const matchIds = [...new Set(results.map(r => r.match_id))];
    return displayPlayers.map(player => {
      const pRes = results.filter(r => r.players.id === player.id);
      const wins = matchIds.reduce((acc, mId) => {
        const winner = getWinner(results.filter(r => r.match_id === mId));
        return winner?.players?.id === player.id ? acc + 1 : acc;
      }, 0);
      return {
        ...player,
        totalGames: pRes.length,
        wins,
        avgScore: pRes.length ? (pRes.reduce((s, r) => s + safeNum(r.score), 0) / pRes.length).toFixed(1) : 0,
        winrate: pRes.length ? ((wins / pRes.length) * 100).toFixed(1) : 0
      };
    });
  }, [displayPlayers, results]);

  const leadersGlobalSorted = useMemo(() => {
    const counts = {}; const wins = {};
    const matchGroups = results.reduce((acc, r) => { (acc[r.match_id] ||= []).push(r); return acc; }, {});
    Object.values(matchGroups).forEach(mRes => {
      const seen = new Set();
      mRes.forEach(r => {
        if (!r.leaders?.name) return;
        if (!seen.has(r.leaders.name)) {
          counts[r.leaders.name] = (counts[r.leaders.name] || 0) + 1;
          seen.add(r.leaders.name);
        }
      });
      const winner = getWinner(mRes);
      if (winner?.leaders?.name) wins[winner.leaders.name] = (wins[winner.leaders.name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name, count, winrate: wins[name] ? ((wins[name] / count) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => leaderModeGlobal === 'mostUsed' ? b.count - a.count : b.winrate - a.winrate);
  }, [results, leaderModeGlobal]);

  // Chart Daten
  const sortedDates = useMemo(() => [...new Set(results.map(r => r.matches?.date).filter(Boolean))].sort(), [results]);
  const winrateOverTime = useMemo(() => sortedDates.map(date => {
    const dateRes = results.filter(r => r.matches?.date && r.matches.date <= date);
    const mIds = [...new Set(dateRes.map(r => r.match_id))];
    const point = { date: new Date(date).toLocaleDateString() };
    displayPlayers.forEach(p => {
      const pRes = dateRes.filter(r => r.players.id === p.id);
      const wins = mIds.reduce((acc, mId) => getWinner(dateRes.filter(r => r.match_id === mId))?.players?.id === p.id ? acc + 1 : acc, 0);
      point[p.username] = pRes.length ? parseFloat(((wins / pRes.length) * 100).toFixed(1)) : 0;
    });
    return point;
  }), [sortedDates, results, displayPlayers]);

  if (groupLoading || (loading && results.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p>Lade Gruppendaten...</p>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="container mx-auto px-4 py-6 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400 text-gray-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Trophy className="text-yellow-500 w-8 h-8" /> {activeGroup?.name || 'Dashboard'}
          </h1>
          <p className="text-gray-500 ml-11">Statistiken & Ergebnisse</p>
        </div>
        {layoutPolicy === 'member_custom' && (
          <button 
            onClick={() => setShowPrefs(!showPrefs)}
            className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-blue-400 px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            <Settings2 size={18} /> Layout anpassen
          </button>
        )}
      </div>

      {/* Layout Auswahl (nur wenn erlaubt) */}
      {showPrefs && layoutPolicy === 'member_custom' && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-md animate-in slide-in-from-top-2">
          <h3 className="font-bold mb-4 flex items-center gap-2"><User size={18}/> Sichtbare Spieler</h3>
          <div className="flex flex-wrap gap-3">
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => setUserVisibleIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id || id === me?.id) : [...prev, m.id])}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${userVisibleIds.includes(m.id) ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
              >
                {m.username} {m.id === me?.id && '(Ich)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Partien Gesamt', value: matchStats.total, color: 'text-green-500' },
          { label: 'Dune Imperium', value: matchStats.dune, color: 'text-blue-500' },
          { label: 'Uprising', value: matchStats.uprising, color: 'text-orange-500' }
        ].map(kpi => (
          <div key={kpi.label} className="bg-white p-6 rounded-2xl shadow-lg transform hover:scale-105 transition-transform">
            <div className={`text-5xl font-black ${kpi.color} mb-1`}>{kpi.value}</div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Global Leaderboard */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Star className="text-yellow-400" /> Leader-Ranking (Gruppe)</h2>
          <div className="flex gap-2">
            <button onClick={() => setLeaderModeGlobal(v => v === 'mostUsed' ? 'winrate' : 'mostUsed')} className="text-xs bg-gray-100 px-3 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors">
              {leaderModeGlobal === 'mostUsed' ? 'Nach Winrate sortieren' : 'Nach Einsätzen sortieren'}
            </button>
            <button onClick={() => setShowAllLeadersGlobal(!showAllLeadersGlobal)} className="text-xs bg-gray-800 text-white px-3 py-2 rounded-lg font-bold">
              {showAllLeadersGlobal ? 'Top 8' : 'Alle'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {leadersGlobalSorted.slice(0, showAllLeadersGlobal ? undefined : 8).map(leader => (
            <div key={leader.name} className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex justify-between items-center">
              <div className="font-bold truncate mr-2">{leader.name}</div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-black text-blue-600">{leader.winrate}%</div>
                <div className="text-[10px] text-gray-400 uppercase">{leader.count} Spiele</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Table */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold">Spieler-Statistiken</h2>
          {layoutPolicy !== 'member_custom' && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold uppercase">Fixiert</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-5 font-bold">Spieler</th>
                <th className="p-5 text-center">Partien</th>
                <th className="p-5 text-center">Siege</th>
                {!hideMemberWinrate && <th className="p-5 text-right">Winrate</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {playerStatsVisible.map(stat => (
                <tr key={stat.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-5 font-bold flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: stat.favorite_color || '#ddd' }} />
                    {stat.username}
                  </td>
                  <td className="p-5 text-center font-medium">{stat.totalGames}</td>
                  <td className="p-5 text-center font-black text-green-600">{stat.wins}</td>
                  {!hideMemberWinrate && (
                    <td className="p-5 text-right">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                        {stat.winrate}%
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Winrate Chart */}
      {!hideMemberWinrate && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-blue-500" /> Winrate Verlauf (%)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={winrateOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
                {displayPlayers.map(p => (
                  <Line key={p.id} type="monotone" dataKey={p.username} stroke={p.favorite_color || '#3B82F6'} strokeWidth={4} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Placements Section (Original Pie Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
         <PlacementsSection 
           results={results} 
           displayPlayers={displayPlayers} 
           selectedIndex={selectedPlayerIndex} 
           setSelectedIndex={setSelectedPlayerIndex} 
         />
         
         {/* Leader per Player (Original Table) */}
         <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Top Leader pro Spieler</h2>
              <button onClick={() => setLeaderMode(v => v === 'mostUsed' ? 'bestScore' : 'mostUsed')} className="text-[10px] font-bold uppercase tracking-tighter bg-gray-100 px-2 py-1 rounded">
                Modus: {leaderMode === 'mostUsed' ? 'Einsätze' : 'Ø Punkte'}
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {displayPlayers.map(p => {
                const pRes = results.filter(r => r.players.id === p.id && r.leaders);
                const lMap = {};
                pRes.forEach(r => {
                  const n = r.leaders.name;
                  if (!lMap[n]) lMap[n] = { count: 0, score: 0 };
                  lMap[n].count++; lMap[n].score += r.score;
                });
                const sorted = Object.entries(lMap).map(([name, d]) => ({ name, count: d.count, avg: (d.score / d.count).toFixed(1) }))
                  .sort((a,b) => leaderMode === 'mostUsed' ? b.count - a.count : b.avg - a.avg);
                
                return (
                  <div key={p.id} className="border-b pb-4 last:border-0">
                    <div className="font-bold text-sm text-gray-400 mb-2 uppercase">{p.username}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {sorted.slice(0, 2).map(l => (
                        <div key={l.name} className="bg-gray-50 p-2 rounded-lg text-xs flex justify-between">
                          <span className="truncate font-medium">{l.name}</span>
                          <span className="font-bold text-blue-600">{leaderMode === 'mostUsed' ? l.count : l.avg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
         </div>
      </div>
    </div>
  );
}

// --- Hilfskomponente: Platzierungen ---
function PlacementsSection({ results, displayPlayers, selectedIndex, setSelectedIndex }) {
  const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];
  
  const selectedPlayer = displayPlayers[selectedIndex];
  
  const pieData = useMemo(() => {
    if (!selectedPlayer) return [];
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const pMatchIds = [...new Set(results.filter(r => r.players.id === selectedPlayer.id).map(r => r.match_id))];
    
    pMatchIds.forEach(mId => {
      const mRes = results.filter(r => r.match_id === mId).sort((a, b) => b.score - a.score || b.spice - a.spice);
      const pos = mRes.findIndex(r => r.players.id === selectedPlayer.id) + 1;
      if (pos >= 1 && pos <= 4) counts[pos]++;
    });
    
    return Object.entries(counts).map(([place, val]) => ({ name: `${place}. Platz`, value: val }));
  }, [selectedPlayer, results]);

  if (!selectedPlayer) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Platzierungen</h2>
        <select 
          value={selectedIndex} 
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="bg-gray-50 border-0 text-sm font-bold rounded-lg p-1"
        >
          {displayPlayers.map((p, i) => <option key={p.id} value={i}>{p.username}</option>)}
        </select>
      </div>
      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-gray-400 font-bold uppercase">Ø Platz</div>
          <div className="text-3xl font-black">
            {(pieData.reduce((acc, curr, i) => acc + curr.value * (i + 1), 0) / (pieData.reduce((a, b) => a + b.value, 0) || 1)).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}