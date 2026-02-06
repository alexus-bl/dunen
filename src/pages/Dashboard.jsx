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
const colorFallbackFor = (id) => ALLOWED_COLORS[Number(id) % ALLOWED_COLORS.length] || ALLOWED_COLORS[0];
const safeNum = (n) => (typeof n === 'number' ? n : 0);

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Daten aus dem Context
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

  // Policy aus Context
  const layoutPolicy = activeGroup?.layout_policy || 'member_custom';
  const hideMemberWinrate = !!activeGroup?.hide_member_winrate;

  // --- 1. Basisdaten laden ---
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
        if (prefRes.data) {
          setUserVisibleIds(Array.isArray(prefRes.data) ? prefRes.data.map(Number) : []);
        }
      } catch (e) {
        console.error("Init Error:", e);
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
    if (layoutPolicy === 'force_all') {
      ids = members.map(m => m.id);
    } else if (layoutPolicy === 'force_self') {
      ids = me ? [me.id] : [];
    } else {
      ids = userVisibleIds.length > 0 ? userVisibleIds : (me ? [me.id] : []);
    }
    // Falls noch keine Ergebnisse da sind, zeigen wir zumindest die Mitglieder der Gruppe an
    const baseList = playersWithData.length > 0 ? playersWithData : members;
    return baseList.filter(p => ids.includes(p.id));
  }, [layoutPolicy, members, me, userVisibleIds, playersWithData]);

  // Index-Sicherung
  useEffect(() => {
    if (selectedPlayerIndex >= displayPlayers.length) {
      setSelectedPlayerIndex(0);
    }
  }, [displayPlayers.length, selectedPlayerIndex]);

  const togglePlayerVisibility = async (playerId) => {
    if (layoutPolicy !== 'member_custom') return;
    setUserVisibleIds(prev => {
      if (playerId === me?.id && prev.includes(playerId)) return prev;
      const next = prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId];
      supabase.rpc('save_dashboard_prefs', { p_group_id: groupId, p_visible_player_ids: next }).catch(console.error);
      return next;
    });
  };

  const getWinner = (mResults) => {
    if (!mResults || mResults.length === 0) return null;
    return [...mResults].sort((a, b) => 
      safeNum(b.score) - safeNum(a.score) || safeNum(b.spice) - safeNum(a.spice) || safeNum(b.solari) - safeNum(a.solari) || safeNum(b.water) - safeNum(a.water)
    )[0];
  };

  // Berechnungen für Charts & Tabellen
  const playerStatsVisible = useMemo(() => {
    if (results.length === 0) return [];
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

  // --- Lade-Check ---
  // Fix: Wir prüfen loading separat von results.length, damit leere Gruppen nicht hängen bleiben.
  if (groupLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="animate-pulse">Lade Dashboard-Daten...</p>
      </div>
    );
  }

  // Falls Gruppe geladen, aber keine Daten da sind (leere Gruppe)
  const hasData = results.length > 0;

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

      {!hasData ? (
        <div className="bg-white p-12 rounded-2xl shadow-lg text-center border-2 border-dashed border-gray-200">
          <TrendingUp className="mx-auto text-gray-300 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-700">Noch keine Spiele getrackt</h2>
          <p className="text-gray-500 mt-2">Trage dein erstes Match ein, um Statistiken zu sehen.</p>
          <button 
            onClick={() => navigate('/add-match')}
            className="mt-6 bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-bold transition-all"
          >
            Erstes Match hinzufügen
          </button>
        </div>
      ) : (
        <>
          {/* Spieler-Auswahl Panel (nur wenn Custom) */}
          {showPrefs && layoutPolicy === 'member_custom' && (
            <div className="mb-8 bg-white p-6 rounded-2xl shadow-md border-b-4 border-blue-400">
              <h3 className="font-bold mb-4 flex items-center gap-2"><User size={18}/> Sichtbare Spieler</h3>
              <div className="flex flex-wrap gap-3">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => togglePlayerVisibility(m.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                      displayPlayers.some(p => p.id === m.id) 
                      ? 'bg-gray-800 text-white border-gray-800' 
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                  >
                    {m.username} {m.id === me?.id && '(Ich)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="text-5xl font-black text-green-500">{matchStats.total}</div>
              <div className="text-xs font-bold text-gray-400 uppercase">Partien Gesamt</div>
            </div>
            {/* ... weitere KPI Cards wie in deiner Version ... */}
          </div>

          {/* Statistiken-Tabelle */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold">Mitglieder-Ranking</h2>
              {layoutPolicy !== 'member_custom' && <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-full font-bold uppercase">Fixiert</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-5">Spieler</th>
                    <th className="p-5 text-center">Partien</th>
                    <th className="p-5 text-center">Siege</th>
                    {!hideMemberWinrate && <th className="p-5 text-right">Winrate</th>}
                  </tr>
                </thead>
                <tbody>
                  {playerStatsVisible.map(stat => (
                    <tr key={stat.id} className="border-t border-gray-50">
                      <td className="p-5 font-bold">{stat.username}</td>
                      <td className="p-5 text-center">{stat.totalGames}</td>
                      <td className="p-5 text-center font-black text-green-600">{stat.wins}</td>
                      {!hideMemberWinrate && <td className="p-5 text-right font-bold">{stat.winrate}%</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts etc. (Hier kannst du deine PlacementsSection und Leaderboard wieder einfügen) */}
          <PlacementsSection results={results} displayPlayers={displayPlayers} selectedIndex={selectedPlayerIndex} setSelectedIndex={setSelectedPlayerIndex} />
        </>
      )}
    </div>
  );
}

// Hilfskomponente (Platzierungen)
function PlacementsSection({ results, displayPlayers, selectedIndex, setSelectedIndex }) {
  const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];
  const selectedPlayer = displayPlayers[selectedIndex] || displayPlayers[0];
  
  if (!selectedPlayer) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Platzierungsverteilung</h2>
        <select value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))} className="bg-gray-50 p-2 rounded-lg font-bold">
          {displayPlayers.map((p, i) => <option key={p.id} value={i}>{p.username}</option>)}
        </select>
      </div>
      <div className="h-64 flex items-center justify-center text-gray-400 italic border-t border-gray-50 pt-4">
        {/* Hier dein PieChart Code ... */}
        Platzierungs-Diagramm für {selectedPlayer.username}
      </div>
    </div>
  );
}