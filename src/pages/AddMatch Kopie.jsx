import { useState } from 'react'
import { supabase } from '../supabaseClient'
import ResultsForm from './ResultsForm'

export default function AddMatch() {
  const [date, setDate] = useState('')
  const [gameId, setGameId] = useState(null)
  const [withExpansion, setWithExpansion] = useState(false)
  const [expansionId, setExpansionId] = useState(null)
  const [withFamilyAtomic, setWithFamilyAtomic] = useState(false)
  const [playedRounds, setPlayedRounds] = useState(null)
  const [resultsFormProps, setResultsFormProps] = useState(null) // <- Neu hinzugefügt

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
        // Erst hier definitiv und vollständig Werte setzen
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
  console.log('Finale übergebene Werte an ResultsForm:', resultsFormProps)
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-full mx-auto">

      <h2 className="text-2xl font-bold">Neue Partie eintragen</h2>

      {resultsFormProps ? (
        <ResultsForm
          matchId={resultsFormProps.matchId}
          gameId={resultsFormProps.gameId}
          withExpansion={resultsFormProps.withExpansion}
          resetForm={resetForm}
          
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col">
            Datum:
            <input
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
              className="border p-2 rounded"
            />
          </label>

          <label className="flex flex-col">
            Spiel:
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
            Mit Erweiterung?
          </label>

          {withExpansion && (
            <label className="flex flex-col">
              Erweiterung:
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
            Mit Family Atomic gespielt?
          </label>

          <label className="flex flex-col">
            Gespielte Runden (optional):
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

          <button type="submit" className="bg-blue-500 text-white p-2 rounded">
            Partie speichern
          </button>
        </form>
      )}
    </div>
  )
}
