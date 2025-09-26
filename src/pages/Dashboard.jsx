// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Trophy, TrendingUp, Shuffle, Star, ChevronDown, Settings2, User } from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useGroup } from '../context/GroupContext';

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

  // ---- State
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showAllLeadersGlobal, setShowAllLeadersGlobal] = useState(false);
  const [layoutPolicy, setLayoutPolicy] = useState('member_custom');


  const [me, setMe] = useState(null);                  // {id, username, favorite_color}
  const [members, setMembers] = useState([]);          // [{id, username, favorite_color}]
  const [results, setResults] = useState([]);          // rows in aktueller Gruppe
  const [playersWithData, setPlayersWithData] = useState([]); // aus results abgeleitet

  const [visiblePlayerIds, setVisiblePlayerIds] = useState([]); // Server-Prefs
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [showPrefs, setShowPrefs] = useState(false);
  const [leaderMode, setLeaderMode] = useState('mostUsed');
  const [leaderModeGlobal, setLeaderModeGlobal] = useState('mostUsed');
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [matchStats, setMatchStats] = useState({ total: 0, dune: 0, uprising: 0 });

  // ---- Effects (niemals bedingt HOOKS auslassen!) ----

  // groupId aus localStorage (nur setzen, keine Hooks danach abbrechen)
  useEffect(() => {
    if (!groupId) {
      try { const last = localStorage.getItem('lastGroupId'); if (last) setGroupId(last); } catch {}
    }
  }, [groupId, setGroupId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupId) return;
      const { data, error } = await supabase.from('groups').select('layout_policy').eq('id', groupId).maybeSingle();
      if (!cancelled && !error) setLayoutPolicy(data?.layout_policy || 'member_custom');
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  // Gruppenname
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupId) { setGroupName(''); return; }
      const { data, error } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle();
      if (!cancelled) setGroupName(error ? '' : (data?.name || ''));
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  // Ich selbst (Player)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) navigate('/'); return; }
      const { data: meRow } = await supabase.from('players').select('id, username, favorite_color').eq('user_id', user.id).maybeSingle();
      if (!cancelled) setMe(meRow || null);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Mitgliederliste (für Toggle)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupId) { setMembers([]); return; }
      const { data, error } = await supabase
        .from('group_members').select('players ( id, username, favorite_color )')
        .eq('group_id', groupId);
      if (cancelled) return;
      if (error) setMembers([]);
      else {
        const list = (data || []).map(r => r.players).filter(Boolean)
          .map(p => ({ id: p.id, username: p.username, favorite_color: p.favorite_color }));
        const unique = [...new Map(list.map(p => [p.id, p])).values()];
        setMembers(unique);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  //ggf. Layout-Möglichkeit ausblenden durch Gruppen-Einstellung

  // nachdem members & me geladen sind:
useEffect(() => {
  if (!groupId || !me?.id) return;

  if (layoutPolicy === 'force_self') {
    // nur ich sichtbar
    setVisiblePlayerIds([me.id]);
    // optional: Prefs-Panel automatisch schließen
    setShowPrefs(false);
  }
  if (layoutPolicy === 'force_all') {
    // alle Gruppenmitglieder sichtbar
    const ids = (members || []).map(m => m.id);
    if (ids.length > 0) setVisiblePlayerIds(ids);
    setShowPrefs(false);
  }
}, [layoutPolicy, groupId, me?.id, members]);

  // Matches-Stats + Ergebnisse laden
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        if (!groupId) { setLoading(false); return; }

        const { data: mData, error: mErr } = await supabase
          .from('matches')
          .select('id, group_id, game_id, games ( id, name )')
          .eq('group_id', groupId);
        if (!mErr) {
          const rows = mData || [];
          setMatchStats({
            total: rows.length,
            dune: rows.filter(m => m.games?.name === 'Dune Imperium').length,
            uprising: rows.filter(m => m.games?.name === 'Dune Imperium Uprising').length,
          });
        }

        const { data, error } = await supabase
          .from('results')
          .select(`
            id,
            match_id,
            score, spice, solari, water,
            leader_id,
            players ( id, username, favorite_color ),
            leaders ( id, name ),
            matches ( id, date, played_rounds, group_id )
          `)
          .eq('matches.group_id', groupId);

        if (error) throw error;

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
        setPlayersWithData(uniquePlayers);
      } catch (e) {
        setErr(e.message || 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  // Prefs vom Server laden (einmal, wenn me & groupId da sind)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupId || !me?.id) return;
      const { data, error } = await supabase.rpc('load_dashboard_prefs', { p_group_id: groupId });
      if (cancelled) return;
      let ids = (error ? null : data) || null;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        ids = [me.id]; // Standard: nur ich
      }
      // Supabase gibt BIGINTs als Zahl zurück → sicherstellen, dass Number[]
      setVisiblePlayerIds(ids.map(Number));
      setPrefsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [groupId, me?.id]);

  // Prefs speichern, wenn sich sichtbare IDs ändern (nur wenn geladen)
  useEffect(() => {
    (async () => {
      if (!prefsLoaded || !groupId || !me?.id) return;
      await supabase.rpc('save_dashboard_prefs', {
        p_group_id: groupId,
        p_visible_player_ids: visiblePlayerIds
      });
    })();
  }, [visiblePlayerIds, prefsLoaded, groupId, me?.id]);

  // selectedPlayerIndex immer in Bounds halten
  useEffect(() => {
    if (selectedPlayerIndex >= visiblePlayerIds.length) setSelectedPlayerIndex(0);
  }, [visiblePlayerIds.length, selectedPlayerIndex]);

  // --------------------- Ableitungen (Hooks wie useMemo VOR jeglichen returns!) ----------------------

  const validResults = results.filter(r => r && r.players?.id != null);
  const uniqueMatchIds = useMemo(
    () => [...new Set(validResults.map(r => r.match_id))],
    [validResults]
  );

  const displayPlayers = useMemo(() => {
    const base = (playersWithData || []).filter(p => visiblePlayerIds.includes(p.id));
    if (base.length === 0 && me?.id) return playersWithData.filter(p => p.id === me.id);
    return base;
  }, [playersWithData, visiblePlayerIds, me?.id]);

  const playerColorMap = useMemo(() => {
    return displayPlayers.reduce((acc, p) => {
      const c = ALLOWED_COLORS.includes(p.favorite_color)
        ? p.favorite_color
        : colorFallbackFor(p.id || p.username);
      acc[p.username] = c;
      return acc;
    }, {});
  }, [displayPlayers]);

  const getWinner = (matchResults) => {
    const arr = (matchResults || []).filter(x => x && x.players?.id != null);
    if (!arr.length) return null;
    return [...arr].sort((a, b) => {
      if (safeNum(b.score) !== safeNum(a.score)) return safeNum(b.score) - safeNum(a.score);
      if (safeNum(b.spice) !== safeNum(a.spice)) return safeNum(b.spice) - safeNum(a.spice);
      if (safeNum(b.solari) !== safeNum(a.solari)) return safeNum(b.solari) - safeNum(a.solari);
      return safeNum(b.water) - safeNum(a.water);
    })[0] || null;
  };

  // Mein Header (persönliche Summen)
  const myId = me?.id ?? null;
  const myResults = useMemo(() => validResults.filter(r => r.players.id === myId), [validResults, myId]);
  const myGamesCount = useMemo(() => new Set(myResults.map(r => r.match_id)).size, [myResults]);
  const myTotals = useMemo(() => myResults.reduce((acc, r) => {
    acc.score += safeNum(r.score);
    acc.spice += safeNum(r.spice);
    acc.solari += safeNum(r.solari);
    acc.water += safeNum(r.water);
    return acc;
  }, { score: 0, spice: 0, solari: 0, water: 0 }), [myResults]);

  const playerStatsVisible = useMemo(() => displayPlayers.map(player => {
    const prs = validResults.filter(r => r.players.id === player.id);
    const totalGames = prs.length;
    const wins = uniqueMatchIds.reduce((acc, matchId) => {
      const matchResults = validResults.filter(r => r.match_id === matchId);
      const winner = getWinner(matchResults);
      return winner?.players?.id === player.id ? acc + 1 : acc;
    }, 0);
    const avgScore = totalGames ? (prs.reduce((s, r) => s + safeNum(r.score), 0) / totalGames).toFixed(1) : '0.0';
    const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
    return { id: player.id, player: player.username, totalGames, wins, winrate: parseFloat(winrate), avgScore: parseFloat(avgScore) };
  }), [displayPlayers, validResults, uniqueMatchIds]);

  const sortedDates = useMemo(
    () => [...new Set(validResults.map(r => r.matches?.date).filter(Boolean))].sort(),
    [validResults]
  );

  const winrateOverTime = useMemo(() => sortedDates.map(date => {
    const dateResults = validResults.filter(r => r.matches?.date && r.matches.date <= date);
    const matchIdsToDate = [...new Set(dateResults.map(r => r.match_id))];
    const dataPoint = { date: new Date(date).toLocaleDateString() };
    displayPlayers.forEach(player => {
      const prs = dateResults.filter(r => r.players.id === player.id);
      const totalGames = prs.length;
      const wins = matchIdsToDate.reduce((acc, matchId) => {
        const matchResults = dateResults.filter(r => r.match_id === matchId);
        const winner = getWinner(matchResults);
        return winner?.players?.id === player.id ? acc + 1 : acc;
      }, 0);
      const winrate = totalGames ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
      dataPoint[player.username] = parseFloat(winrate);
    });
    return dataPoint;
  }), [sortedDates, validResults, displayPlayers]);

  const avgScoreOverTime = useMemo(() => sortedDates.map(date => {
    const dateResults = validResults.filter(r => r.matches?.date && r.matches.date <= date);
    const dataPoint = { date: new Date(date).toLocaleDateString() };
    displayPlayers.forEach(player => {
      const prs = dateResults.filter(r => r.players.id === player.id);
      const totalGames = prs.length;
      const avg = totalGames ? (prs.reduce((s, r) => s + safeNum(r.score), 0) / totalGames).toFixed(1) : 0;
      dataPoint[player.username] = parseFloat(avg);
    });
    return dataPoint;
  }), [sortedDates, validResults, displayPlayers]);

  const leaderStatsPerPlayer = useMemo(() => displayPlayers.map(player => {
    const prs = validResults.filter(r => r.players.id === player.id && r.leaders?.name);
    const leaderMap = {};
    prs.forEach(r => {
      const name = r.leaders.name; if (!name) return;
      if (!leaderMap[name]) leaderMap[name] = { count: 0, totalScore: 0 };
      leaderMap[name].count += 1;
      leaderMap[name].totalScore += safeNum(r.score);
    });
    const leadersArray = Object.entries(leaderMap).map(([name, data]) => ({
      name, count: data.count, avgScore: (data.totalScore / data.count).toFixed(1),
    }));
    const sorted = leaderMode === 'mostUsed'
      ? leadersArray.sort((a, b) => b.count - a.count)
      : leadersArray.sort((a, b) => b.avgScore - a.avgScore);
    return { player: player.username, leaders: sorted };
  }), [displayPlayers, validResults, leaderMode]);

  const placementsPerPlayer = useMemo(() => displayPlayers.map(player => {
    const placementCounts = {}; let totalGames = 0;
    validResults.forEach(result => {
      if (result.players.id === player.id) {
        const matchResults = validResults.filter(r => r.match_id === result.match_id);
        const sorted = matchResults.filter(r => r.players?.id != null).sort((a, b) => {
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
  }), [displayPlayers, validResults]);

  // Globale Leader-Statistik (pro MATCH, nicht pro Result-Zeile)
const leadersGlobalSorted = useMemo(() => {
  // Nach match_id gruppieren
  const byMatch = validResults.reduce((acc, r) => {
    (acc[r.match_id] ||= []).push(r);
    return acc;
  }, {});

  const occurrences = {}; // wie oft ein Leader in Matches benutzt wurde
  const wins = {};        // wie oft ein Leader das Match gewonnen hat

  Object.values(byMatch).forEach((rows) => {
    // Alle Leadernamen in diesem Match (einmalig je Leader zählen)
    const leadersInMatch = Array.from(new Set(rows.map(r => r.leaders?.name).filter(Boolean)));
    leadersInMatch.forEach((name) => {
      occurrences[name] = (occurrences[name] || 0) + 1;
    });

    // Sieger einmal pro Match bestimmen
    const winner = getWinner(rows);
    const wl = winner?.leaders?.name;
    if (wl) wins[wl] = (wins[wl] || 0) + 1;
  });

  const stats = Object.entries(occurrences).map(([name, count]) => ({
    name,
    count, // "Spiele"
    winrate: wins[name] ? ((wins[name] / count) * 100).toFixed(1) : '0.0',
  }));

  // Sortiermodus: meistgespielt vs. beste Winrate
  const sorted = (leaderModeGlobal === 'mostUsed')
    ? [...stats].sort((a, b) => b.count - a.count)
    : [...stats].sort((a, b) => parseFloat(b.winrate) - parseFloat(a.winrate));

  return sorted;
}, [validResults, leaderModeGlobal]);

// Liste für die Tabelle (Top 7 oder alle)
const leadersToShow = useMemo(
  () => (showAllLeadersGlobal ? leadersGlobalSorted : leadersGlobalSorted.slice(0, 7)),
  [leadersGlobalSorted, showAllLeadersGlobal]
);


  // --------------- Helper für UI ---------------

  const togglePlayerExpanded = (name) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const toggleVisible = (id) => {
    if (!id) return;
    if (id === me?.id && visiblePlayerIds.includes(id) && visiblePlayerIds.length === 1) return;
    setVisiblePlayerIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F87171'];
  const isReady = !!groupId && !!me && prefsLoaded && !loading;

  // --------------------- Render (einziger return) ----------------------
  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      {/* Header mit Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2 sm:gap-0">
  <h1 className="text-2xl font-bold flex items-center gap-2">
    <Trophy className="text-green-400 w-6 h-6" /> Dashboard
  </h1>
  {layoutPolicy === 'member_custom' && (
  <button onClick={() => setShowPrefs(v => !v)} className="inline-flex items-center gap-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm">
    <Settings2 className="w-4 h-4" /> Layout anpassen
  </button>
)}
</div>


      {/* Lade-/Fehlerzustände ohne Hooks zu ändern */}
      {!isReady ? (
        <div className="flex items-center justify-center h-40 text-xl text-gray-600">
          {err ? `Fehler beim Laden: ${err}` : 'Lade Dashboard…'}
        </div>
      ) : (
        <>

        {/* Layout anpassen */}
        {showPrefs && (
            <div className="mb-6 bg-white rounded-xl shadow-md p-4">
              <div className="font-semibold mb-2">Spieler ein-/ausblenden</div>
              {members.length === 0 ? (
                <div className="text-sm text-gray-500">Keine Mitglieder gefunden.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {members.map(p => {
                    const checked = visiblePlayerIds.includes(p.id);
                    const color = ALLOWED_COLORS.includes(p.favorite_color) ? p.favorite_color : colorFallbackFor(p.id);
                    return (
                      <label key={p.id}
                             className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${checked ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-700 border-gray-300'} cursor-pointer`}>
                        <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleVisible(p.id)} />
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-sm">{p.username}{p.id === me?.id ? ' (ich)' : ''}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Hinweis: Spieler ohne Ergebnisse erscheinen ggf. nicht in Diagrammen/Tabellen.
              </div>
            </div>
          )}

          {/* Persönliche Kopfzeile */}
          <div className="mb-6 bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                   style={{ background: (me && (ALLOWED_COLORS.includes(me.favorite_color) ? me.favorite_color : colorFallbackFor(me.id))) }}>
                <User className="text-white w-5 h-5" />
              </div>
              <div className="flex flex-col">
                 {/*  <span className="text-sm text-gray-500">Angemeldet als</span>*/}
                <span className="text-lg font-semibold">{me?.username ?? '–'}</span>
              </div>
              <div className="ml-auto inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                <span className="font-semibold"></span>
                <span className="font-medium">{groupName || '–'}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-gray-50 ">
                  <div className="text-xs text-gray-500">Gespielte Partien</div>
                  <div className="text-5xl font-bold">{myGamesCount}</div>
                </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-xs text-green-500">Gesamt‑Siegpunkte</div>
                  <div className="text-5xl font-extrabold text-green-500">{myTotals.score}</div>
                </div>
            </div>
          </div>

          

          {/* Gruppen-KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[{label:'Gesamt Partien',value:matchStats.total},{label:'Dune Imperium',value:matchStats.dune},{label:'Dune Imperium Uprising',value:matchStats.uprising}]
              .map(item=>(
              <div key={item.label} className="p-5 bg-white rounded-xl shadow-lg transform hover:scale-105 transition duration-300">
                <div className="text-4xl font-bold text-green-500 mb-2">{item.value}</div>
                <div className="text-xs text-gray-600">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Top Leader (gruppenweit) */}
          <div className="bg-white flex-wrap rounded-xl shadow-lg p-6 mb-8 sm:flex-row sm:items-center sm:justify-between mt-10 mb-4 gap-2 overflow-x-auto">
          <div className="flex flex-col sm:items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Star className="text-yellow-400" /> {showAllLeadersGlobal ? 'Alle Leader (Gruppe)' : 'Top 7 Leader (Gruppe)'}
            </h2>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setLeaderModeGlobal(leaderModeGlobal === 'mostUsed' ? 'bestWinrate' : 'mostUsed')}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded flex items-center gap-2 text-sm"
              >
                {leaderModeGlobal === 'mostUsed' ? (<><Shuffle className="w-4 h-4" /> Nach Winrate sortieren</>) : (<><Star className="w-4 h-4" /> Meistgespielt anzeigen</>)}
              </button>
              <button
                onClick={() => setShowAllLeadersGlobal(v => !v)}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
              >
                {showAllLeadersGlobal ? 'Top 7 anzeigen' : 'Alle anzeigen'}
              </button>
            </div>
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
            {leadersToShow.map(leader => (
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


          {/* Durchschnittliche Runden */}
          <RoundsBox results={validResults} />

          {/* Spieler-Statistik (nur sichtbare) */}
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Star className="text-yellow-400" /> Spieler‑Statistik</h2>
          <div className="overflow-auto mb-8 bg-white rounded-xl shadow-lg flex-wrap hidden md:block">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>{['Spieler','Partien','Siege','Ø Punkte','Winrate (%)'].map(h => <th key={h} className="p-4 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {playerStatsVisible.map(stat => (
                  <tr key={stat.player}>
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
          <div className="space-y-4 flex-wrap mb-4 md:hidden">
            {playerStatsVisible.map(stat => (
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

          {/* Winrate-Verlauf (nur sichtbare) */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📈 Winrate‑Verlauf</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={winrateOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} tickFormatter={(t) => `${t}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend iconType="plainline" />
                {displayPlayers.map(player => (
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

          {/* Punkteentwicklung (nur sichtbare) */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">⏳ Punkteentwicklung</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={avgScoreOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend iconType="plainline" />
                {displayPlayers.map(player => (
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

          {/* Placements (nur sichtbare) */}
          <PlacementsSection
            placementsPerPlayer={placementsPerPlayer}
            selectedPlayerIndex={selectedPlayerIndex}
            setSelectedPlayerIndex={setSelectedPlayerIndex}
            COLORS={COLORS}
          />

          {/* Leader pro Spieler */}
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
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table id={`leader-table-${stat.player}`} className="w-full border-collapse text-sm md:text-base">
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
        </>
      )}
    </div>
  );
}

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
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><TrendingUp className="text-blue-500" /> Durchschnittliche Rundenanzahl</h2>
      <p><strong>3 Spieler:</strong> {avgRounds3}</p>
      <p><strong>4 Spieler:</strong> {avgRounds4}</p>
    </div>
  );
}

function PlacementsSection({ placementsPerPlayer, selectedPlayerIndex, setSelectedPlayerIndex, COLORS }) {
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
                cx="50%" cy="50%"
                paddingAngle={5}
                innerRadius={55} outerRadius={75}
                labelLine={false} labelRadius={50}
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
                const avg = Object.entries(chart.placements).reduce((sum, [place, percent]) =>
                  sum + parseInt(place) * (parseFloat(percent) / 100)
                , 0);
                return avg.toFixed(2);
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
