// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Trophy, TrendingUp, Shuffle, Star, ChevronDown, Settings2, User, Loader2 } from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useGroup } from '../context/GroupContext';

// --- Konstanten & Helper ---
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
  const { groupId, setGroupId } = useGroup();

  // ---- State ----
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  
  // Gruppen-Einstellungen (Policy)
  const [groupData, setGroupData] = useState({ name: '', layout_policy: 'member_custom', hide_member_winrate: false });
  
  // User & Mitglieder
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  
  // Spieldaten
  const [results, setResults] = useState([]);
  const [playersWithData, setPlayersWithData] = useState([]);
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 });

  // UI States
  const [userVisibleIds, setUserVisibleIds] = useState([]); // Was der User in "Custom" gewählt hat
  const [showPrefs, setShowPrefs] = useState(false);
  const [leaderMode, setLeaderMode] = useState('mostUsed');
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [showAllLeadersGlobal, setShowAllLeadersGlobal] = useState(false);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // ---------------------------------------------------------
  // 1. INITIALES LADEN (Group, Me, Members)
  // ---------------------------------------------------------
  const loadBaseData = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { navigate('/'); return; }

      const [groupRes, meRes, membersRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
        supabase.from('players').select('id, username, favorite_color').eq('user_id', authUser.id).maybeSingle(),
        supabase.from('group_members').select('players(id, username, favorite_color)').eq('group_id', groupId)
      ]);

      if (groupRes.data) setGroupData(groupRes.data);
      if (meRes.data) setMe(meRes.data);
      if (membersRes.data) {
        setMembers(membersRes.data.map(m => m.players).filter(Boolean));
      }

      // User-Präferenzen laden (nur für Custom Layout)
      const { data: prefData } = await supabase.rpc('load_dashboard_prefs', { p_group_id: groupId });
      if (prefData && Array.isArray(prefData)) {
        setUserVisibleIds(prefData.map(Number));
      } else if (meRes.data) {
        setUserVisibleIds([meRes.data.id]);
      }

    } catch (e) {
      console.error("Fehler beim Laden der Basisdaten:", e);
      setErr(e.message);
    }
  }, [groupId, navigate]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // ---------------------------------------------------------
  // 2. REALTIME LISTENER (Für sofortige Policy-Updates)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase.channel(`dashboard-realtime-${groupId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, 
      (payload) => {
        setGroupData(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId]);

  // ---------------------------------------------------------
  // 3. SPIELDATEN LADEN
  // ---------------------------------------------------------
  useEffect(() => {
    async function fetchMatches() {
      if (!groupId) return;
      setLoading(true);
      try {
        const { data: rData, error: rErr } = await supabase
          .from('results')
          .select(`
            id, match_id, score, spice, solari, water, leader_id,
            players ( id, username, favorite_color ),
            leaders ( id, name ),
            matches ( id, date, played_rounds, group_id, games(name) )
          `)
          .eq('matches.group_id', groupId);

        if (rErr) throw rErr;

        const filtered = (rData || []).filter(r => r.matches && r.players);
        setResults(filtered);

        // Stats berechnen
        const matchIds = [...new Set(filtered.map(r => r.match_id))];
        const uniqueMatches = matchIds.map(id => filtered.find(r => r.match_id === id).matches);
        
        setMatchStats({
          total: matchIds.length,
          dune: uniqueMatches.filter(m => m.games?.name === 'Dune Imperium').length,
          uprising: uniqueMatches.filter(m => m.games?.name === 'Dune Imperium Uprising').length,
        });

        const uniquePlayers = [...new Map(filtered.map(r => [r.players.id, r.players])).values()];
        setPlayersWithData(uniquePlayers);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, [groupId]);

  // ---------------------------------------------------------
  // 4. LOGIK: WELCHE SPIELER WERDEN ANGEZEIGT? (BUG-FIX)
  // ---------------------------------------------------------
  const effectiveVisibleIds = useMemo(() => {
    if (groupData.layout_policy === 'force_all') {
      return members.map(m => m.id);
    }
    if (groupData.layout_policy === 'force_self') {
      return me ? [me.id] : [];
    }
    // member_custom
    return userVisibleIds.length > 0 ? userVisibleIds : (me ? [me.id] : []);
  }, [groupData.layout_policy, members, me, userVisibleIds]);

  const displayPlayers = useMemo(() => {
    return playersWithData.filter(p => effectiveVisibleIds.includes(p.id));
  }, [playersWithData, effectiveVisibleIds]);

  // Speichern der User-Prefs (nur wenn erlaubt)
  useEffect(() => {
    if (groupData.layout_policy === 'member_custom' && userVisibleIds.length > 0 && me) {
      supabase.rpc('save_dashboard_prefs', {
        p_group_id: groupId,
        p_visible_player_ids: userVisibleIds
      }).catch(console.error);
    }
  }, [userVisibleIds, groupId, me, groupData.layout_policy]);

  // ---------------------------------------------------------
  // 5. BERECHNUNGEN (Stats & Charts)
  // ---------------------------------------------------------
  
  // Gewinner-Ermittlung
  const getWinner = (matchResults) => {
    if (!matchResults.length) return null;
    return [...matchResults].sort((a, b) => 
      safeNum(b.score) - safeNum(a.score) || 
      safeNum(b.spice) - safeNum(a.spice) || 
      safeNum(b.solari) - safeNum(a.solari) || 
      safeNum(b.water) - safeNum(a.water)
    )[0];
  };

  const playerStatsVisible = useMemo(() => {
    const matchIds = [...new Set(results.map(r => r.match_id))];
    return displayPlayers.map(player => {
      const pResults = results.filter(r => r.players.id === player.id);
      const wins = matchIds.reduce((acc, mId) => {
        const winner = getWinner(results.filter(r => r.match_id === mId));
        return winner?.players?.id === player.id ? acc + 1 : acc;
      }, 0);
      return {
        ...player,
        totalGames: pResults.length,
        wins,
        avgScore: pResults.length ? (pResults.reduce((s, r) => s + safeNum(r.score), 0) / pResults.length).toFixed(1) : 0,
        winrate: pResults.length ? ((wins / pResults.length) * 100).toFixed(1) : 0
      };
    });
  }, [displayPlayers, results]);

  // Leaderboard Global
  const leadersGlobalSorted = useMemo(() => {
    const counts = {};
    const wins = {};
    const matchGroups = results.reduce((acc, r) => { (acc[r.match_id] ||= []).push(r); return acc; }, {});

    Object.values(matchGroups).forEach(mResults => {
      const seenInMatch = new Set();
      mResults.forEach(r => {
        if (!r.leaders?.name) return;
        if (!seenInMatch.has(r.leaders.name)) {
          counts[r.leaders.name] = (counts[r.leaders.name] || 0) + 1;
          seenInMatch.add(r.leaders.name);
        }
      });
      const winner = getWinner(mResults);
      if (winner?.leaders?.name) wins[winner.leaders.name] = (wins[winner.leaders.name] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name, count, winrate: wins[name] ? ((wins[name] / count) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => leaderModeGlobal === 'mostUsed' ? b.count - a.count : b.winrate - a.winrate);
  }, [results, leaderModeGlobal]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  if (loading && results.length === 0) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800 text-white">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p>Lade dein Dashboard...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-yellow-500" /> {groupData.name || 'Dashboard'}
          </h1>
          <p className="text-gray-400 text-sm">Willkommen zurück, {me?.username}</p>
        </div>
        
        {groupData.layout_policy === 'member_custom' && (
          <button 
            onClick={() => setShowPrefs(!showPrefs)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-600 transition-all"
          >
            <Settings2 size={18} /> <span className="hidden sm:inline">Layout anpassen</span>
          </button>
        )}
      </div>

      {/* Layout Prefs Panel */}
      {showPrefs && groupData.layout_policy === 'member_custom' && (
        <div className="bg-gray-800 p-4 rounded-xl border border-blue-500/30 animate-in fade-in slide-in-from-top-4">
          <p className="text-sm font-semibold mb-3">Sichtbare Spieler wählen:</p>
          <div className="flex flex-wrap gap-2">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => setUserVisibleIds(prev => 
                  prev.includes(member.id) ? prev.filter(id => id !== member.id || id === me?.id) : [...prev, member.id]
                )}
                className={`px-3 py-1 rounded-full text-sm border transition-all ${
                  effectiveVisibleIds.includes(member.id) 
                  ? 'bg-blue-600 border-blue-400 text-white' 
                  : 'bg-gray-700 border-gray-600 text-gray-400'
                }`}
              >
                {member.username} {member.id === me?.id && '(Ich)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-lg">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Spiele Gesamt</div>
          <div className="text-3xl font-bold text-white">{matchStats.total}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-lg">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Dune Imperium</div>
          <div className="text-3xl font-bold text-blue-500">{matchStats.dune}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-lg">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Uprising</div>
          <div className="text-3xl font-bold text-green-500">{matchStats.uprising}</div>
        </div>
      </div>

      {/* Main Stats Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold">Spieler-Statistiken</h2>
          {groupData.layout_policy !== 'member_custom' && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 uppercase">
              Vom Owner fixiert
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 text-gray-400 text-sm uppercase">
              <tr>
                <th className="p-4">Spieler</th>
                <th className="p-4 text-center">Partien</th>
                <th className="p-4 text-center">Siege</th>
                <th className="p-4 text-center">Ø Punkte</th>
                {!groupData.hide_member_winrate && <th className="p-4 text-right">Winrate</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {playerStatsVisible.map(stat => (
                <tr key={stat.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-4 font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: stat.favorite_color || '#ccc' }} />
                    {stat.username}
                  </td>
                  <td className="p-4 text-center">{stat.totalGames}</td>
                  <td className="p-4 text-center text-yellow-500 font-bold">{stat.wins}</td>
                  <td className="p-4 text-center">{stat.avgScore}</td>
                  {!groupData.hide_member_winrate && (
                    <td className="p-4 text-right">
                      <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-sm">
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

      {/* Globale Leader Table (Immer sichtbar, da gruppenweit) */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star className="text-yellow-500" /> Leader-Ranking
          </h2>
          <button 
            onClick={() => setLeaderModeGlobal(prev => prev === 'mostUsed' ? 'winrate' : 'mostUsed')}
            className="text-xs bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
          >
            Sortierung: {leaderModeGlobal === 'mostUsed' ? 'Einsätze' : 'Winrate'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {leadersGlobalSorted.slice(0, showAllLeadersGlobal ? undefined : 8).map(leader => (
            <div key={leader.name} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
              <div>
                <div className="font-bold text-sm">{leader.name}</div>
                <div className="text-xs text-gray-500">{leader.count} Partien</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-400">{leader.winrate}%</div>
                <div className="text-[10px] text-gray-500 uppercase">Winrate</div>
              </div>
            </div>
          ))}
        </div>
        <button 
          onClick={() => setShowAllLeadersGlobal(!showAllLeadersGlobal)}
          className="w-full mt-4 text-sm text-gray-500 hover:text-white transition-colors"
        >
          {showAllLeadersGlobal ? 'Weniger anzeigen' : 'Alle Leader anzeigen'}
        </button>
      </div>

      {/* Winrate Chart - Respektiert hide_member_winrate */}
      {!groupData.hide_member_winrate && (
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
           <h2 className="text-xl font-bold mb-6">Winrate Verlauf</h2>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[] /* Hier deine winrateOverTime Logik einfügen */}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none' }} />
                  {displayPlayers.map(p => (
                    <Line 
                      key={p.id} 
                      type="monotone" 
                      dataKey={p.username} 
                      stroke={p.favorite_color || '#3B82F6'} 
                      strokeWidth={3} 
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
           </div>
        </div>
      )}
      
      {/* Placements Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hier kannst du deine PlacementsSection und LeaderStats einfügen */}
      </div>

    </div>
  );
}