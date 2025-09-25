// src/pages/ResultsForm.jsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Users, ClipboardCheck } from 'lucide-react';
import { useGroup } from '../context/GroupContext';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

export default function ResultsForm({ matchId, resetForm, gameId, withExpansion }) {
  const { groupId, setGroupId } = useGroup();

  const [leaders, setLeaders] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]); // [{id, username}]
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLeaders, setLoadingLeaders] = useState(true);

  const [selectedPlayers, setSelectedPlayers] = useState([]); // [{id, username}]
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [playerResults, setPlayerResults] = useState({});
  const [isResultsComplete, setIsResultsComplete] = useState(false);

  // groupId nach Reload wiederherstellen (falls leer)
  useEffect(() => {
    if (!groupId) {
      try {
        const last = localStorage.getItem('lastGroupId');
        if (last) setGroupId(last);
      } catch {}
    }
  }, [groupId, setGroupId]);

  // Leader laden
  useEffect(() => {
    let cancelled = false;
    async function fetchLeaders() {
      setLoadingLeaders(true);
      const { data, error } = await supabase.rpc('get_available_leaders', {
        selected_game_id: gameId,
        selected_expansion: withExpansion,
      });
      if (!cancelled) {
        if (error) {
          console.error('[ResultsForm] get_available_leaders error:', error);
          setLeaders([]);
        } else {
          setLeaders(data || []);
        }
        setLoadingLeaders(false);
      }
    }
    if (gameId != null) fetchLeaders();
    return () => { cancelled = true; };
  }, [gameId, withExpansion]);

  // Gruppen-Mitglieder laden
  useEffect(() => {
    let cancelled = false;
    async function fetchMembers() {
      if (!groupId) {
        setMemberOptions([]);
        setLoadingMembers(false);
        return;
      }
      setLoadingMembers(true);
      const { data, error, status } = await supabase
        .from('group_members')
        .select(`
          player_id,
          players ( id, username )
        `)
        .eq('group_id', groupId);

      if (!cancelled) {
        if (error) {
          console.error('[ResultsForm] group_members.select error:', status, error.message);
          setMemberOptions([]);
        } else {
          const list = (data || [])
            .map(row => row.players)
            .filter(p => p && p.id != null)
            .map(p => ({ id: p.id, username: p.username || `Player #${p.id}` }));
          const unique = [...new Map(list.map(p => [p.id, p])).values()];
          setMemberOptions(unique);
        }
        setLoadingMembers(false);
      }
    }
    fetchMembers();
    return () => { cancelled = true; };
  }, [groupId]);

  const togglePlayerSelection = (player) => {
    const exists = selectedPlayers.some(p => p.id === player.id);

    if (exists) {
      // Entfernen
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
      setPlayerResults(prev => {
        const next = { ...prev };
        delete next[player.id];
        return next;
      });
    } else {
      // Hinzufügen (bis MAX_PLAYERS)
      if (selectedPlayers.length >= MAX_PLAYERS) {
        alert(`Maximal ${MAX_PLAYERS} Spieler möglich.`);
        return;
      }
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const startResultsInput = () => {
    if (selectedPlayers.length < MIN_PLAYERS) {
      alert(`Bitte mindestens ${MIN_PLAYERS} Spieler auswählen.`);
      return;
    }
    setCurrentPlayerIndex(1);
  };

  const currentPlayer = useMemo(
    () => selectedPlayers[currentPlayerIndex - 1],
    [selectedPlayers, currentPlayerIndex]
  );

  const handleNextPlayer = () => {
    if (currentPlayerIndex < selectedPlayers.length) setCurrentPlayerIndex(currentPlayerIndex + 1);
    else setIsResultsComplete(true);
  };

  const handleSaveResults = async () => {
    // Anzahl nochmal absichern
    if (selectedPlayers.length < MIN_PLAYERS || selectedPlayers.length > MAX_PLAYERS) {
      alert(`Es müssen zwischen ${MIN_PLAYERS} und ${MAX_PLAYERS} Spielern ausgewählt sein.`);
      return;
    }
    if (!matchId) {
      alert('Match-ID fehlt. Speichern nicht möglich.');
      return;
    }

    const resultsToInsert = selectedPlayers.map((p) => {
      const result = playerResults[p.id] || {};
      return {
        match_id: matchId,
        player_id: p.id,
        leader_id: result.leader ?? null,
        score: result.score ?? null,
        spice: result.spice ?? null,
        solari: result.solari ?? null,
        water: result.water ?? null,
      };
    });

    const { error, status } = await supabase.from('results').insert(resultsToInsert);
    if (error) {
      console.error('[ResultsForm] results.insert error:', status, error.message);
      alert(`Fehler: ${error.message}`);
    } else {
      alert('✅ Ergebnisse gespeichert!');
      resetForm();
    }
  };

  return (
    <div className="container mx-auto">
      {!isResultsComplete ? (
        currentPlayerIndex === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Users className="text-blue-500" /> Wer hat mitgespielt?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Wähle zwischen {MIN_PLAYERS} und {MAX_PLAYERS} Spielern.
            </p>

            {loadingMembers ? (
              <div className="text-gray-500">Lade Gruppen-Mitglieder…</div>
            ) : memberOptions.length === 0 ? (
              <div className="p-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
                In dieser Gruppe sind (noch) keine Mitglieder vorhanden.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {memberOptions.map(player => {
                  const isSelected = selectedPlayers.some(p => p.id === player.id);
                  const disableBecauseMax = !isSelected && selectedPlayers.length >= MAX_PLAYERS;
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayerSelection(player)}
                      disabled={disableBecauseMax}
                      className={`px-4 py-2 rounded-xl border transition whitespace-nowrap
                        ${isSelected 
                          ? 'text-gray-100 bg-green-500 border-blue-600' 
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-200 border-gray-300'}
                        ${disableBecauseMax ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={String(player.username)}
                    >
                      {player.username}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              Ausgewählt: {selectedPlayers.length} / {MAX_PLAYERS}
            </div>

            <button
              onClick={startResultsInput}
              disabled={selectedPlayers.length < MIN_PLAYERS}
              className="bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded hover:bg-gray-200 transition"
            >
              Weiter
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-2xl font-bold mb-4">
              Ergebnisse: {currentPlayer?.username ?? '–'}
            </h3>

            <label className="flex flex-col mb-4">
              <span className="font-semibold">Anführer:</span>
              {loadingLeaders ? (
                <div className="text-gray-500">Lade Anführer…</div>
              ) : (
                <select
                  value={playerResults[currentPlayer.id]?.leader || ''}
                  onChange={(e) =>
                    setPlayerResults(prev => ({
                      ...prev,
                      [currentPlayer.id]: {
                        ...prev[currentPlayer.id],
                        leader: Number(e.target.value)
                      }
                    }))
                  }
                  className="border p-2 rounded"
                >
                  <option value="">Bitte wählen</option>
                  {leaders.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </label>

            {['score', 'spice', 'solari', 'water'].map(field => (
              <label key={field} className="flex flex-col mb-3 capitalize">
                <span className="font-semibold">{field.charAt(0).toUpperCase() + field.slice(1)}:</span>
                <input
                  type="number"
                  min="0"
                  value={playerResults[currentPlayer.id]?.[field] ?? ''}
                  onChange={(e) =>
                    setPlayerResults(prev => ({
                      ...prev,
                      [currentPlayer.id]: {
                        ...prev[currentPlayer.id],
                        [field]: e.target.value === '' ? null : Number(e.target.value)
                      }
                    }))
                  }
                  className="border p-2 rounded"
                />
              </label>
            ))}

            <button
              onClick={handleNextPlayer}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
            >
              {currentPlayerIndex < selectedPlayers.length ? 'Weiter' : 'Abschließen'}
            </button>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-md">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <ClipboardCheck className="text-green-500" /> Ergebnisse überprüfen und speichern
          </h3>

          {/* Optional: kurze Zusammenfassung */}
          <ul className="mb-4 list-disc list-inside text-sm text-gray-700">
            {selectedPlayers.map(p => {
              const r = playerResults[p.id] || {};
              return (
                <li key={p.id}>
                  {p.username}: Leader {r.leader ?? '–'}, Punkte {r.score ?? '–'}
                  {r.spice != null || r.solari != null || r.water != null ? (
                    <> (Spice {r.spice ?? 0}, Solari {r.solari ?? 0}, Wasser {r.water ?? 0})</>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <button
            onClick={handleSaveResults}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Ergebnisse speichern
          </button>
        </div>
      )}
    </div>
  );
}
