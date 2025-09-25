import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { List, Calendar, Gamepad, Puzzle, Atom, RotateCw, Pencil, Trash2 } from 'lucide-react';
import { useGroup } from '../context/GroupContext';

export default function Matches() {
  const { groupId, setGroupId } = useGroup();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // groupId nach Reload wiederherstellen
  useEffect(() => {
    if (!groupId) {
      try {
        const last = localStorage.getItem('lastGroupId');
        if (last) setGroupId(last);
      } catch {}
    }
  }, [groupId, setGroupId]);

  // prüfen, ob aktueller User Owner dieser Gruppe ist
  useEffect(() => {
    const checkOwner = async () => {
      setIsOwner(false);
      if (!groupId) return;

      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr || !user) return;

      const { data: me, error: pErr } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (pErr || !me) return;

      const { data: gm, error: gmErr } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('player_id', me.id)
        .maybeSingle();

      if (!gmErr && gm && gm.role === 'owner') setIsOwner(true);
    };
    checkOwner();
  }, [groupId]);

  const fetchMatchesAndResults = useCallback(async () => {
    try {
      if (!groupId) { setLoading(false); return; }

      const { data, error, status } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          group_id,
          games (id, name),
          expansions (id, name),
          with_expansion,
          with_family_atomic,
          played_rounds,
          results (
            id,
            players (id, username),
            leaders (id, name),
            score,
            spice,
            solari,
            water
          )
        `)
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      if (error) {
        console.error('[Matches] SELECT error:', status, error.message);
        setMatches([]);
        return;
      }

      const sortedData = (data || []).map(match => {
        const sortedResults = [...(match.results || [])].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.spice !== a.spice) return b.spice - a.spice;
          if (b.solari !== a.solari) return b.solari - a.solari;
          return b.water - a.water;
        });
        const resultsWithPlacement = sortedResults.map((result, index) => ({
          ...result,
          placement: index + 1,
        }));
        return { ...match, results: resultsWithPlacement };
      });

      setMatches(sortedData);
    } catch (e) {
      console.error('[Matches] load fail:', e);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMatchesAndResults();
  }, [fetchMatchesAndResults]);

  const handleDeleteMatch = async (matchId) => {
    if (!isOwner) return;
    if (!confirm('Diese Partie wirklich löschen? Alle zugehörigen Ergebnisse werden entfernt.')) return;
  
    setDeletingId(matchId);
    try {
      const { error } = await supabase.rpc('delete_match_cascade', { p_match_id: matchId });
      if (error) throw error;
  
      // lokal aus der Liste nehmen
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (e) {
      console.error('[Matches] delete failed:', e);
      const msg = String(e.message || '');
      if (msg.includes('NOT_OWNER')) alert('Nur der Owner darf Partien löschen.');
      else if (msg.includes('MATCH_NOT_FOUND')) alert('Partie nicht gefunden.');
      else alert('Partie konnte nicht gelöscht werden.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-600">Lade Partien und Ergebnisse...</div>;

  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-2"><List className="text-purple-500" /> Gespeicherte Partien</h2>

      {matches.length === 0 ? (
        <p className="text-gray-500">Keine Partien gespeichert.</p>
      ) : (
        matches.map(match => {
          const showResources = (match.results || []).some(r => r.spice || r.solari || r.water);

          return (
            <div key={match.id} className="mb-8 p-6 bg-white rounded-xl shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 text-sm sm:text-base">
                <div className="flex items-center gap-2"><Calendar className="text-gray-600" /><strong>Datum:</strong> {new Date(match.date).toLocaleDateString()}</div>
                <div className="flex items-center gap-2"><Gamepad className="text-gray-600" /><strong>Spiel:</strong> {match.games?.name || '-'}</div>
                <div className="flex items-center gap-2"><Puzzle className="text-gray-600" /><strong>Erweiterung:</strong> {match.with_expansion ? match.expansions?.name : '-'}</div>
                <div className="flex items-center gap-2"><Atom className="text-gray-600" /><strong>Family Atomic:</strong> {match.with_family_atomic ? '✅' : '❌'}</div>
                <div className="flex items-center gap-2"><RotateCw className="text-gray-600" /><strong>Runden:</strong> {match.played_rounds ?? '-'}</div>
              </div>

              {(match.results || []).length > 0 ? (
                <>
                  {/* Desktop */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full table-auto border-collapse text-sm md:text-base">
                      <thead className="bg-gray-800 text-white">
                        <tr>
                          <th className="border p-2">Platz</th>
                          <th className="border p-2">Spieler</th>
                          <th className="border p-2">Anführer</th>
                          <th className="border p-2">Siegpunkte</th>
                          {showResources && <th className="border p-2">Spice</th>}
                          {showResources && <th className="border p-2">Solari</th>}
                          {showResources && <th className="border p-2">Wasser</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {match.results.map(result => (
                          <tr key={result.id}>
                            <td className="border p-2 text-center font-semibold">
                              {result.placement === 1 && '🥇'}
                              {result.placement === 2 && '🥈'}
                              {result.placement === 3 && '🥉'}
                              {result.placement > 3 && result.placement}
                            </td>
                            <td className="border p-2 break-words">{result.players?.username || '-'}</td>
                            <td className="border p-2 break-words">{result.leaders?.name || '-'}</td>
                            <td className="border p-2 text-center">{result.score}</td>
                            {showResources && <td className="border p-2 text-center">{result.spice}</td>}
                            {showResources && <td className="border p-2 text-center">{result.solari}</td>}
                            {showResources && <td className="border p-2 text-center">{result.water}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="sm:hidden space-y-4">
                    {match.results.map(result => (
                      <div key={result.id} className="border rounded-xl bg-gray-50 p-4 shadow-sm">
                        <div className="font-bold text-lg">
                          {result.placement <= 3 ? ['🥇', '🥈', '🥉'][result.placement - 1] : `${result.placement}. Platz`}
                        </div>
                        <div><strong>Spieler:</strong> {result.players?.username || '-'}</div>
                        <div><strong>Anführer:</strong> {result.leaders?.name || '-'}</div>
                        <div><strong>Siegpunkte:</strong> {result.score}</div>
                        {showResources && (
                          <div className="flex justify-between mt-2 text-sm">
                            <span>Spice: {result.spice}</span>
                            <span>Solari: {result.solari}</span>
                            <span>Wasser: {result.water}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">Keine Ergebnisse gespeichert.</p>
              )}
        {isOwner && (
              <div className="mt-4 flex items-center gap-2">
                <Link
                  to={`/edit-match/${match.id}`}
                  className="inline-flex items-center gap-1 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
                >
                  <Pencil className="w-4 h-4" /> Bearbeiten
                </Link>

                
                  <button
                    onClick={() => handleDeleteMatch(match.id)}
                    disabled={deletingId === match.id}
                    className="inline-flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition disabled:opacity-60"
                    title="Partie löschen (nur Owner)"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingId === match.id ? 'Lösche…' : 'Löschen'}
                  </button>
                
              </div>)}
            </div>
          );
        })
      )}
    </div>
  );
}
