import { useState } from 'react'
import { supabase } from '../supabaseClient'
import ResultsForm from './ResultsForm'
import { PlusCircle } from 'lucide-react'

export default function AddMatch() {
  const [date, setDate] = useState('')
  const [gameId, setGameId] = useState(null)
  const [withExpansion, setWithExpansion] = useState(false)
  const [expansionId, setExpansionId] = useState(null)
  const [withFamilyAtomic, setWithFamilyAtomic] = useState(false)
  const [playedRounds, setPlayedRounds] = useState(null)
  const [resultsFormProps, setResultsFormProps] = useState(null)

  const resetForm = () => {
    setDate('')
    setGameId(null)
    setWithExpansion(false)
    setExpansionId(null)
    setWithFamilyAtomic(false)
    setPlayedRounds(null)
    setResultsFormProps(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { data, error } = await supabase
      .from('matches')
      .insert({
        date,
        game_id: Number(gameId),
        with_expansion: withExpansion,
        expansion_id: withExpansion ? Number(expansionId) : null,
        with_family_atomic: withFamilyAtomic,
        played_rounds: playedRounds !== null ? playedRounds : null,
      })
      .select()

    if (error) {
      alert(`Fehler: ${error.message}`)
    } else {
      alert('✅ Partie erfolgreich gespeichert!')

      const confirmResults = window.confirm('Möchtest du jetzt die Ergebnisse speichern?')
      if (confirmResults) {
        setResultsFormProps({
          matchId: data[0].id,
          gameId: Number(gameId),
          withExpansion: Boolean(withExpansion),
        })
      } else {
        resetForm()
      }
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-2"><PlusCircle className="text-blue-500 w-6 h-6" /> Neue Partie eintragen</h2>

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
                const value = e.target.value.trim()
                setPlayedRounds(value === '' ? null : Number(value))
              }}
              className="border p-2 rounded"
            />
          </label>

          <button type="submit" className="bg-blue-500 dark:text-white p-2 rounded hover:bg-blue-600 transition">
            Partie speichern
          </button>
        </form>
      )}
    </div>
  )
}