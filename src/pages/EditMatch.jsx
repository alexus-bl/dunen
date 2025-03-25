import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function EditMatch() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [date, setDate] = useState('')
  const [playedRounds, setPlayedRounds] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  // Match laden
  useEffect(() => {
    async function fetchMatch() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (error) {
        console.error('Fehler beim Laden der Partie:', error)
      } else {
        setDate(data.date)
        setPlayedRounds(data.played_rounds ?? '')
      }
    }

    fetchMatch()
  }, [matchId])

  // Ergebnisse laden
  useEffect(() => {
    async function fetchResults() {
      const { data, error } = await supabase
        .from('results')
        .select(`
          id, score, spice, solari, water,
          players (id, name),
          leaders (id, name)
        `)
        .eq('match_id', matchId)

      if (error) {
        console.error('Fehler beim Laden der Ergebnisse:', error)
      } else {
        setResults(data)
      }

      setLoading(false)
    }

    fetchResults()
  }, [matchId])

  // Änderungen in Eingabefeldern verarbeiten
  function handleResultChange(resultId, field, value) {
    setResults(prev =>
      prev.map(result =>
        result.id === resultId ? { ...result, [field]: Number(value) } : result
      )
    )
  }

  // Ergebnisse in Supabase aktualisieren
  async function updateResults() {
    const updates = results.map(result =>
      supabase
        .from('results')
        .update({
          score: result.score,
          spice: result.spice,
          solari: result.solari,
          water: result.water,
        })
        .eq('id', result.id)
    )

    const resultsResponse = await Promise.all(updates)

    const error = resultsResponse.find(res => res.error)
    if (error) {
      console.error('Fehler beim Speichern der Ergebnisse:', error.error)
      alert('Fehler beim Speichern der Ergebnisse.')
    } else {
      alert('✅ Ergebnisse erfolgreich gespeichert!')
    }
  }

  // Änderungen (Match + Results) speichern
  const handleSubmit = async (e) => {
    e.preventDefault()

    const { error } = await supabase
      .from('matches')
      .update({
        date,
        played_rounds: playedRounds !== '' ? Number(playedRounds) : null,
      })
      .eq('id', matchId)

    if (error) {
      alert(`Fehler: ${error.message}`)
    } else {
      await updateResults() // Ergebnisse speichern
      navigate('/matches')
    }
  }

  if (loading) return <div className="p-4">Lade Daten...</div>

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Partie bearbeiten</h2>

      <label className="flex flex-col">
        Datum:
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
        />
      </label>

      <label className="flex flex-col">
        Gespielte Runden (optional):
        <input
          type="number"
          min="0"
          value={playedRounds}
          onChange={(e) => setPlayedRounds(e.target.value)}
          className="border p-2 rounded"
        />
      </label>

      <h3 className="text-xl font-bold mt-4">Ergebnisse bearbeiten</h3>

      {results.map(result => (
        <div key={result.id} className="border p-3 rounded mb-2">
          <h4 className="font-semibold">{result.players?.name} ({result.leaders?.name})</h4>

          <label>Siegpunkte:
            <input
              type="number" min="0"
              value={result.score}
              onChange={(e) => handleResultChange(result.id, 'score', e.target.value)}
              className="border p-2 rounded w-full"
            />
          </label>

          <label>Spice:
            <input
              type="number" min="0"
              value={result.spice}
              onChange={(e) => handleResultChange(result.id, 'spice', e.target.value)}
              className="border p-2 rounded w-full"
            />
          </label>

          <label>Solari:
            <input
              type="number" min="0"
              value={result.solari}
              onChange={(e) => handleResultChange(result.id, 'solari', e.target.value)}
              className="border p-2 rounded w-full"
            />
          </label>

          <label>Wasser:
            <input
              type="number" min="0"
              value={result.water}
              onChange={(e) => handleResultChange(result.id, 'water', e.target.value)}
              className="border p-2 rounded w-full"
            />
          </label>
        </div>
      ))}

      <button type="submit" className="bg-blue-500 text-white p-2 rounded mt-2">
        Änderungen speichern
      </button>
    </form>
  )
}
