import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Pencil } from 'lucide-react'

export default function EditMatch() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [date, setDate] = useState('')
  const [playedRounds, setPlayedRounds] = useState('')
  const [results, setResults] = useState([])
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMatch() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (error) console.error('Fehler beim Laden der Partie:', error)
      else {
        setDate(data.date)
        setPlayedRounds(data.played_rounds ?? '')
      }
    }

    fetchMatch()
  }, [matchId])

  useEffect(() => {
    async function fetchResults() {
      const { data, error } = await supabase
        .from('results')
        .select(`
          id, score, spice, solari, water, leader_id,
          players (id, name),
          leaders (id, name)
        `)
        .eq('match_id', matchId)

      if (error) console.error('Fehler beim Laden der Ergebnisse:', error)
      else setResults(data)

      setLoading(false)
    }

    fetchResults()
  }, [matchId])

  useEffect(() => {
    async function fetchLeaders() {
      const { data, error } = await supabase.from('leaders').select('*')
      if (error) console.error('Fehler beim Laden der Anführer:', error)
      else setLeaders(data)
    }

    fetchLeaders()
  }, [])

  function handleResultChange(resultId, field, value) {
    setResults(prev =>
      prev.map(result =>
        result.id === resultId ? { ...result, [field]: Number(value) } : result
      )
    )
  }

  async function updateResults() {
    const updates = results.map(result =>
      supabase
        .from('results')
        .update({
          leader_id: result.leader_id,
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
    } else alert('✅ Ergebnisse erfolgreich gespeichert!')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { error } = await supabase
      .from('matches')
      .update({
        date,
        played_rounds: playedRounds !== '' ? Number(playedRounds) : null,
      })
      .eq('id', matchId)

    if (error) alert(`Fehler: ${error.message}`)
    else {
      await updateResults()
      navigate('/matches')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-xl text-gray-600">Lade Daten...</div>

  return (
    <div className="container mx-auto px-6 py-8 bg-gray-100 rounded-3xl shadow-xl border-4 border-green-400">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Pencil className="text-yellow-500" /> Partie bearbeiten
        </h2>

        <label className="flex flex-col">
          <span className="font-semibold">Datum:</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded"
          />
        </label>

        <label className="flex flex-col">
          <span className="font-semibold">Gespielte Runden (optional):</span>
          <input
            type="number"
            min="0"
            value={playedRounds}
            onChange={(e) => setPlayedRounds(e.target.value)}
            className="border p-2 rounded"
          />
        </label>

        <h3 className="text-2xl font-bold mt-4">Ergebnisse bearbeiten</h3>

        {results.map(result => (
          <div key={result.id} className="border p-4 rounded-xl shadow-sm">
            <h4 className="font-semibold text-lg mb-2">{result.players?.name}</h4>

            <label className="flex flex-col mb-3">
              <span className="font-semibold">Anführer:</span>
              <select
                value={result.leader_id || ''}
                onChange={(e) => handleResultChange(result.id, 'leader_id', e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="">Bitte wählen</option>
                {leaders.map(leader => (
                  <option key={leader.id} value={leader.id}>{leader.name}</option>
                ))}
              </select>
            </label>

            {['score', 'spice', 'solari', 'water'].map(field => (
              <label key={field} className="flex flex-col mb-3">
                <span className="font-semibold capitalize">{field}:</span>
                <input
                  type="number"
                  min="0"
                  value={result[field]}
                  onChange={(e) => handleResultChange(result.id, field, e.target.value)}
                  className="border p-2 rounded w-full"
                />
              </label>
            ))}
          </div>
        ))}

        <button type="submit" className="bg-blue-500 dark:text-white p-2 rounded hover:bg-blue-600 transition">
          Änderungen speichern
        </button>
      </form>
    </div>
  )
}
