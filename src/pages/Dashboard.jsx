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
const colorFallbackFor = (nameOrId) => {
  let hash = 0; const s = String(nameOrId || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return ALLOWED_COLORS[hash % ALLOWED_COLORS.length];
};
const lineStyleFor = (player) => {
  const key = String(player?.id ?? player?.username ?? '');
  let hash = 0; for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const patterns = ['', '5 5', '3 3', '2 2'];
  return { strokeDasharray: patterns[hash % patterns.length] };
};
const safeNum = (n) => (typeof n === 'number' ? n : 0);

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Daten aus dem neuen stabilen Context
  const { groupId, activeGroup, loading: groupLoading } = useGroup();

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [results, setResults] = useState([]);
  const [playersWithData, setPlayersWithData] = useState([]);
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 });

  // UI-States
  const [userVisibleIds, setUserVisibleIds] = useState([]); 
  const [showPrefs, setShowPrefs] = useState(false);
  const [leaderMode, setLeaderMode] = useState('mostUsed');
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [showAllLeadersGlobal, setShowAllLeadersGlobal] = useState(false);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // Policy direkt aus Context (Der Bug-Fix!)
  const layoutPolicy = activeGroup?.layout_policy || 'member_custom';
  const hideMemberWinrate = !!activeGroup?.hide_member_winrate;

  // --- 1. Basisdaten & Prefs laden ---
  useEffect(() => {
    async function initDashboard() {
      if (!groupId) return;
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
        if (prefRes.data) setUserVisibleIds(Array.isArray(prefRes.data) ? prefRes.data.map(Number) : []);
      } catch (e) {
        setErr(e.message);
      }
    }
    initDashboard();
  }, [groupId, navigate]);

  // --- 2. Spieldaten laden ---
  useEffect(() => {
    async function fetchResults() {
      if (!groupId) return;
      try {
        setLoading(true);
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

  // --- 3. Logik: Welche Spieler anzeigen? ---
  const displayPlayers = useMemo(() => {
    let ids = [];
    if (layoutPolicy === 'force_all') ids = members.map(m => m.id);
    else if (layoutPolicy === 'force_self') ids = me ? [me.id] : [];
    else ids = userVisibleIds.length > 0 ? userVisibleIds : (me ? [me.id] : []);
    
    // Fallback: Wenn noch keine Daten da sind, nehmen wir Mitglieder, sonst Spieler mit Daten
    const base = playersWithData.length > 0 ? playersWithData : members;
    return base.filter(p => ids.includes(p.id));
  }, [layoutPolicy, members, me, userVisibleIds, playersWithData]);

  // Index-Sicherung (Verhindert Absturz beim Abwählen)
  useEffect(() => {
    if (selectedPlayerIndex >= displayPlayers.length) setSelectedPlayerIndex(0);
  }, [displayPlayers.length, selectedPlayerIndex]);

  // --- 4. Berechnungen (Winrate, Leader, etc.) ---
  const getWinner = (mResults) => {
    if (!mResults || mResults.length === 0) return null;
    return [...mResults].sort((a, b) => 
      safeNum(b.score) - safeNum(a.score) || safeNum(b.spice) - safeNum(a.spice) || safeNum(b.solari) - safeNum(a.solari) || safeNum(b.water) - safeNum(a.water)
    )[0];
  };

  const playerStatsVisible = useMemo(() => {
    const matchIds = [...new Set(results.map(r => r.match_id))];
    return displayPlayers.map(player => {
      const pRes = results.filter(r => r.players?.id === player.id);
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

  const avgScoreOverTime = useMemo(() => sortedDates.map(date => {
    const dateRes = results.filter(r => r.matches?.date && r.matches.date <= date);
    const point = { date: new Date(date).toLocaleDateString() };
    displayPlayers.forEach(p => {
      const pRes = dateRes.filter(r => r.players.id === p.id);
      const avg = pRes.length ? (pRes.reduce((s, r) => s + safeNum(r.score), 0) / pRes.length).toFixed(1) : 0;
      point[p.username] = parseFloat(avg);
    });
    return point;
  }), [sortedDates, results, displayPlayers]);

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

  // --- Render Ladezustand ---
  if (groupLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="animate-pulse font-bold tracking-widest uppercase text-sm">Synchronisiere Daten...</p>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-green-400 w-6 h-6" /> Dashboard
        </h1>
        {layoutPolicy === 'member_custom' && (
          <button 
            onClick={() => setShowPrefs(!showPrefs)} 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-gray-200 hover:border-blue-400 text-sm font-bold transition-all"
          >
            <Settings2 className="w-4 h-4" /> Layout anpassen
          </button>
        )}
      </div>

      {/* Layout Anpassungs Panel */}
      {showPrefs && layoutPolicy === 'member_custom' && (
        <div className="mb-6 bg-white rounded-2xl shadow-md p-6 border-b-4 border-blue-400 animate-in slide-in-from-top-2">
          <div className="font-bold mb-4 flex items-center gap-2"><User size={18}/> Sichtbare Spieler</div>
          <div className="flex flex-wrap gap-2">
            {members.map(p => {
              const checked = displayPlayers.some(dp => dp.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    const next = checked ? userVisibleIds.filter(id => id !== p.id) : [...userVisibleIds, p.id];
                    setUserVisibleIds(next);
                    supabase.rpc('save_dashboard_prefs', { p_group_id: groupId, p_visible_player_ids: next });
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                    checked ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-500 border-gray-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: p.favorite_color || colorFallbackFor(p.id) }} />
                  <span className="text-xs font-bold uppercase">{p.username}{p.id === me?.id ? ' (ich)' : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Persönliche Kopfzeile */}
      <div className="mb-6 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl"
               style={{ background: me?.favorite_color || colorFallbackFor(me?.id) }}>
            {me?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="block text-xl font-black text-gray-800">{me?.username}</span>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
              {activeGroup?.name}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Partien</div>
            <div className="text-4xl font-black text-gray-800">{playerStatsVisible.find(s => s.id === me?.id)?.totalGames || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-green-50 border border-green-100">
            <div className="text-[10px] uppercase font-bold text-green-400 tracking-widest">Ø Punkte</div>
            <div className="text-4xl font-black text-green-600">{playerStatsVisible.find(s => s.id === me?.id)?.avgScore || 0}</div>
          </div>
        </div>
      </div>

      {/* KPIs Gruppe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Gesamt Partien', value: matchStats.total, color: 'text-green-500' },
          { label: 'Dune Imperium', value: matchStats.dune, color: 'text-blue-500' },
          { label: 'Uprising', value: matchStats.uprising, color: 'text-orange-500' }
        ].map(item => (
          <div key={item.label} className="p-6 bg-white rounded-2xl shadow-lg transform hover:scale-105 transition-all">
            <div className={`text-5xl font-black ${item.color} mb-1`}>{item.value}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Globale Leader (Gruppe) */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star className="text-yellow-400" /> {showAllLeadersGlobal ? 'Alle Leader' : 'Top 7 Leader'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setLeaderModeGlobal(v => v === 'mostUsed' ? 'bestWinrate' : 'mostUsed')}
              className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase"
            >
              {leaderModeGlobal === 'mostUsed' ? 'Nach Winrate' : 'Nach Einsätzen'}
            </button>
            <button 
              onClick={() => setShowAllLeadersGlobal(v => !v)}
              className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase"
            >
              {showAllLeadersGlobal ? 'Top 7' : 'Alle'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-800 text-white text-[10px] uppercase font-bold">
                <th className="p-3 rounded-l-lg">Leader</th>
                <th className="p-3 text-center">{leaderModeGlobal === 'mostUsed' ? 'Spiele' : 'Winrate'}</th>
                <th className="p-3 text-center rounded-r-lg">{leaderModeGlobal === 'mostUsed' ? 'Winrate' : 'Spiele'}</th>
              </tr>
            </thead>
            <tbody>
              {leadersGlobalSorted.slice(0, showAllLeadersGlobal ? undefined : 7).map(leader => (
                <tr key={leader.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-bold text-sm">{leader.name}</td>
                  <td className="p-3 text-center font-black text-blue-600">
                    {leaderModeGlobal === 'mostUsed' ? leader.count : `${leader.winrate}%`}
                  </td>
                  <td className="p-3 text-center text-gray-400 text-xs">
                    {leaderModeGlobal === 'mostUsed' ? `${leader.winrate}%` : leader.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Runden-Stats */}
      <RoundsBox results={results} />

      {/* Haupt-Ranking Tabelle */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold flex items-center gap-2">Spieler-Statistiken</h2>
          {layoutPolicy !== 'member_custom' && <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-full font-bold uppercase">Fixiert</span>}
        </div>
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="p-5">Spieler</th>
                <th className="p-5 text-center">Partien</th>
                <th className="p-5 text-center">Siege</th>
                <th className="p-5 text-center">Ø Punkte</th>
                {!hideMemberWinrate && <th className="p-5 text-right">Winrate (%)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {playerStatsVisible.map(stat => (
                <tr key={stat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-5 font-bold flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: stat.favorite_color || colorFallbackFor(stat.id) }} />
                    {stat.username}
                  </td>
                  <td className="p-5 text-center font-medium">{stat.totalGames}</td>
                  <td className="p-5 text-center font-black text-green-600">{stat.wins}</td>
                  <td className="p-5 text-center font-bold text-gray-700">{stat.avgScore}</td>
                  {!hideMemberWinrate && (
                    <td className="p-5 text-right">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">
                        {stat.winrate}%
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-100">
          {playerStatsVisible.map(stat => (
            <div key={stat.id} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: stat.favorite_color || colorFallbackFor(stat.id) }} />
                <span className="font-black text-lg">{stat.username}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-xs text-gray-500 uppercase font-bold">Partien: <span className="text-gray-800 ml-1">{stat.totalGames}</span></div>
                <div className="text-xs text-gray-500 uppercase font-bold">Siege: <span className="text-green-600 ml-1">{stat.wins}</span></div>
                <div className="text-xs text-gray-500 uppercase font-bold">Ø Punkte: <span className="text-gray-800 ml-1">{stat.avgScore}</span></div>
                {!hideMemberWinrate && <div className="text-xs text-gray-500 uppercase font-bold">Winrate: <span className="text-blue-600 ml-1">{stat.winrate}%</span></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Sektion */}
      {!hideMemberWinrate && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">📈 Winrate-Verlauf</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={winrateOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} dy={10} />
                <YAxis domain={[0, 100]} tickFormatter={(t) => `${t}%`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                {displayPlayers.map(p => (
                  <Line 
                    key={p.id} 
                    type="monotone" 
                    dataKey={p.username} 
                    stroke={p.favorite_color || colorFallbackFor(p.id)} 
                    strokeWidth={4} 
                    strokeDasharray={lineStyleFor(p).strokeDasharray} 
                    dot={false} 
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Punkteentwicklung Chart */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">⏳ Punkteentwicklung</h2>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={avgScoreOverTime}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#999' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              {displayPlayers.map(p => (
                <Line 
                  key={p.id} 
                  type="monotone" 
                  dataKey={p.username} 
                  stroke={p.favorite_color || colorFallbackFor(p.id)} 
                  strokeWidth={4} 
                  strokeDasharray={lineStyleFor(p).strokeDasharray} 
                  dot={false} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Untere Grid Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Platzierungen Pie Chart */}
        <PlacementsSection 
          results={results} 
          displayPlayers={displayPlayers} 
          selectedIndex={selectedPlayerIndex} 
          setSelectedIndex={setSelectedPlayerIndex} 
        />

        {/* Leader Picks pro Spieler */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Individuelle Leader-Top-Picks</h2>
            <button 
              onClick={() => setLeaderMode(v => v === 'mostUsed' ? 'bestScore' : 'mostUsed')}
              className="text-[10px] font-bold uppercase tracking-tighter bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {leaderMode === 'mostUsed' ? 'Nach Einsätzen' : 'Nach Ø Punkte'}
            </button>
          </div>
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {displayPlayers.map(p => {
              const pRes = results.filter(r => r.players?.id === p.id && r.leaders);
              const lMap = {};
              pRes.forEach(r => {
                const n = r.leaders.name;
                if (!lMap[n]) lMap[n] = { count: 0, score: 0 };
                lMap[n].count++; lMap[n].score += r.score;
              });
              const sorted = Object.entries(lMap).map(([name, d]) => ({ 
                name, 
                count: d.count, 
                avg: (d.score / d.count).toFixed(1) 
              })).sort((a,b) => leaderMode === 'mostUsed' ? b.count - a.count : b.avg - a.avg);

              const isExpanded = expandedPlayers.has(p.username);
              const rows = isExpanded ? sorted : sorted.slice(0, 3);

              return (
                <div key={p.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-black text-sm uppercase tracking-wider text-gray-500">{p.username}</span>
                    <button onClick={() => {
                      const next = new Set(expandedPlayers);
                      if (next.has(p.username)) next.delete(p.username); else next.add(p.username);
                      setExpandedPlayers(next);
                    }} className="text-[10px] font-bold text-blue-500 hover:underline">
                      {isExpanded ? 'Weniger' : 'Mehr'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {rows.map(l => (
                      <div key={l.name} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-700">{l.name}</span>
                        <span className="text-sm font-black text-blue-600">{leaderMode === 'mostUsed' ? l.count : l.avg}</span>
                      </div>
                    ))}
                    {sorted.length === 0 && <div className="text-[10px] italic text-gray-400">Keine Daten verfügbar</div>}
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

// --- Hilfs-Komponenten ---

function RoundsBox({ results }) {
  const matchGroups = results.reduce((acc, r) => {
    if (!acc[r.match_id]) acc[r.match_id] = [];
    acc[r.match_id].push(r);
    return acc;
  }, {});
  const matchesWithRounds = Object.values(matchGroups).filter(m => m[0]?.matches?.played_rounds != null);
  const matches3 = matchesWithRounds.filter(m => m.length === 3);
  const matches4 = matchesWithRounds.filter(m => m.length === 4);

  const avgRounds3 = matches3.length
    ? (matches3.reduce((s, m) => s + (m[0]?.matches?.played_rounds ?? 0), 0) / matches3.length).toFixed(1)
    : '–';
  const avgRounds4 = matches4.length
    ? (matches4.reduce((s, m) => s + (m[0]?.matches?.played_rounds ?? 0), 0) / matches4.length).toFixed(1)
    : '–';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-blue-400">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 uppercase tracking-tight">
        <TrendingUp className="text-blue-400" size={18} /> Durchschnittliche Runden
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">3 Spieler</div>
          <div className="text-2xl font-black text-gray-800">{avgRounds3}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">4 Spieler</div>
          <div className="text-2xl font-black text-gray-800">{avgRounds4}</div>
        </div>
      </div>
    </div>
  );
}

function PlacementsSection({ results, displayPlayers, selectedIndex, setSelectedIndex }) {
  const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];
  const selectedPlayer = displayPlayers[selectedIndex] || displayPlayers[0];
  
  const pieData = useMemo(() => {
    if (!selectedPlayer) return [];
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const pMatchIds = [...new Set(results.filter(r => r.players?.id === selectedPlayer.id).map(r => r.match_id))];
    
    pMatchIds.forEach(mId => {
      const mRes = results.filter(r => r.match_id === mId).sort((a, b) => {
        return safeNum(b.score) - safeNum(a.score) || safeNum(b.spice) - safeNum(a.spice);
      });
      const pos = mRes.findIndex(r => r.players?.id === selectedPlayer.id) + 1;
      if (pos >= 1 && pos <= 4) counts[pos]++;
    });
    
    return Object.entries(counts).map(([place, val]) => ({ name: `${place}. Platz`, value: val }));
  }, [selectedPlayer, results]);

  if (!selectedPlayer) return (
    <div className="bg-white rounded-2xl shadow-xl p-6 h-64 flex items-center justify-center text-gray-400 italic">
      Wähle Spieler für Statistiken
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">🥧 Platzierungen</h2>
        <select 
          value={selectedIndex} 
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
          className="bg-gray-50 border-2 border-gray-100 text-sm font-bold rounded-xl px-2 py-1 outline-none focus:border-blue-400 transition-all"
        >
          {displayPlayers.map((p, i) => <option key={p.id} value={i}>{p.username}</option>)}
        </select>
      </div>
      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={85} paddingAngle={5}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Ø Platz</div>
          <div className="text-4xl font-black text-gray-800">
            {(pieData.reduce((acc, curr, i) => acc + curr.value * (i + 1), 0) / (pieData.reduce((a, b) => a + b.value, 0) || 1)).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}