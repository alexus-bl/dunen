// src/pages/AddMatch.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ResultsForm from './ResultsForm';
import { PlusCircle } from 'lucide-react';
import { useGroup } from '../context/GroupContext';

export default function AddMatch() {
  const navigate = useNavigate();
  const { groupId, setGroupId } = useGroup();

  const [groupName, setGroupName] = useState('');
  const [date, setDate] = useState('');
  const [gameId, setGameId] = useState(null);
  const [withExpansion, setWithExpansion] = useState(false);
  const [expansionId, setExpansionId] = useState(null);
  const [withFamilyAtomic, setWithFamilyAtomic] = useState(false);
  const [playedRounds, setPlayedRounds] = useState(null);
  const [resultsFormProps, setResultsFormProps] = useState(null);
  const [saving, setSaving] = useState(false);

  // Nach Reload groupId wiederherstellen
  useEffect(() => {
    if (!groupId) {
      try {
        const last = localStorage.getItem('lastGroupId');
        if (last) setGroupId(last);
      } catch {}
    }
  }, [groupId, setGroupId]);

  // Gruppennamen laden (nur Anzeige)
  useEffect(() => {
    let cancelled = false;
    const fetchGroup = async () => {
      if (!groupId) return;
      const { data, error } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle();
      if (!cancelled) setGroupName(error ? '' : (data?.name || ''));
    };
    fetchGroup();
    return () => { cancelled = true; };
  }, [groupId]);

  const resetForm = () => {
    setDate('');
    setGameId(null);
    setWithExpansion(false);
    setExpansionId(null);
    setWithFamilyAtomic(false);
    setPlayedRounds(null);
    setResultsFormProps(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupId) {
      alert('Bitte zuerst eine Gruppe auswählen.');
      navigate('/groups');
      return;
    }
    setSaving(true);
    try {
      const { data, error, status } = await supabase
        .from('matches')
        .insert({
          date,                                 // 'YYYY-MM-DD'
          game_id: Number(gameId),
          with_expansion: withExpansion,
          expansion_id: withExpansion ? Number(expansionId) : null,
          with_family_atomic: withFamilyAtomic,
          played_rounds: playedRounds !== null ? playedRounds : null,
          group_id: groupId,                    // <<< WICHTIG
        })
        .select();

      if (error) {
        console.error('[AddMatch] insert error:', status, error.message);
        alert(`Fehler: ${error.message}`);
        return;
      }

      alert('✅ Partie erfolgreich gespeichert!');
      const confirmResults = window.confirm('Möchtest du jetzt die Ergebnisse speichern?');
      if (confirmResults) {
        setResultsFormProps({
          matchId: data[0].id,
          gameId: Number(gameId),
          withExpansion: Boolean(withExpansion),
        });
      } else {
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  // Wenn keine Gruppe gewählt ist, Hinweis anzeigen
  if (!groupId) {
    return (
      <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <PlusCircle className="text-blue-500 w-6 h-6" /> Neue Partie eintragen
        </h2>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800">
          Du hast aktuell keine Gruppe ausgewählt. Bitte wähle zuerst eine Gruppe in der{' '}
          <Link to="/groups" className="text-blue-600 underline">Gruppenübersicht</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
        <PlusCircle className="text-blue-500 w-6 h-6" /> Neue Partie eintragen
      </h2>

      {/* Aktive Gruppe sichtbar machen */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
          <span className="font-semibold">Aktive Gruppe:</span>
          <span className="font-medium">{groupName || '–'}</span>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          (Partie wird in dieser Gruppe gespeichert)
        </div>
      </div>

      {resultsFormProps ? (
        <ResultsForm
          matchId={resultsFormProps.matchId}
          gameId={resultsFormProps.gameId}
          withExpansion={resultsFormProps.withExpansion}
          resetForm={resetForm}
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white rounded-xl p-6 shadow-md">
          <label className="flex flex-col">
            <span className="font-semibold">Datum:</span>
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
              className="border p-2 rounded"
            />
          </label>

          <label className="flex flex-col">
            <span className="font-semibold">Spiel:</span>
            <select
              value={gameId ?? ''}
              required
              onChange={(e) => setGameId(Number(e.target.value))}
              className="border p-2 rounded"
            >
              <option value="">Bitte wählen</option>
              <option value={1}>Dune Imperium</option>
              <option value={2}>Dune Imperium Uprising</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={withExpansion}
              onChange={(e) => setWithExpansion(e.target.checked)}
            />
            <span>Mit Erweiterung?</span>
          </label>

          {withExpansion && (
            <label className="flex flex-col">
              <span className="font-semibold">Erweiterung:</span>
              <select
                value={expansionId || ''}
                onChange={(e) => setExpansionId(Number(e.target.value))}
                className="border p-2 rounded"
              >
                <option value="">Bitte wählen</option>
                <option value={1}>Bloodlines</option>
              </select>
            </label>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={withFamilyAtomic}
              onChange={(e) => setWithFamilyAtomic(e.target.checked)}
            />
            <span>Mit Family Atomic gespielt?</span>
          </label>

          <label className="flex flex-col">
            <span className="font-semibold">Gespielte Runden (optional):</span>
            <input
              type="number"
              value={playedRounds ?? ''}
              onChange={(e) => {
                const value = e.target.value.trim();
                setPlayedRounds(value === '' ? null : Number(value));
              }}
              className="border p-2 rounded"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded hover:bg-blue-600 transition"
          >
            {saving ? 'Speichere…' : 'Partie speichern'}
          </button>
        </form>
      )}
    </div>
  );
}
