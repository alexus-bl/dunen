import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Matches() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    async function fetchMatchesAndResults() {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          games (id, name),
          expansions (id, name),
          with_expansion,
          with_family_atomic,
          played_rounds,
          results (
            id,
            players (id, name),
            leaders (id, name),
            score,
            spice,
            solari,
            water
          )
        `)
        .order('date', { ascending: false })

      if (error) {
        console.error('Fehler:', error)
      } else {
        const sortedData = data.map(match => {
          const sortedResults = [...match.results].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            if (b.spice !== a.spice) return b.spice - a.spice
            if (b.solari !== a.solari) return b.solari - a.solari
            return b.water - a.water
          })

          const resultsWithPlacement = sortedResults.map((result, index) => ({
            ...result,
            placement: index + 1,
          }))

          return { ...match, results: resultsWithPlacement }
        })

        setMatches(sortedData)
      }
      setLoading(false)
    }

    fetchMatchesAndResults()
  }, [])

  if (loading) return <div className="p-4">Lade Partien und Ergebnisse...</div>

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Gespeicherte Partien</h2>
      <button
        className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? '🔽 Details ausblenden' : '🔼 Details einblenden'}
      </button>

      {matches.length === 0 ? (
        <p>Keine Partien gespeichert.</p>
      ) : (
        matches.map(match => (
          <div key={match.id} className="mb-6 p-4 border rounded shadow">
            <div className="mb-3 text-sm sm:text-base">
              <strong>Datum:</strong> {new Date(match.date).toLocaleDateString()}<br />
              <strong>Spiel:</strong> {match.games?.name || '-'}<br />
              <strong>Erweiterung:</strong> {match.with_expansion ? match.expansions?.name : '-'}<br />
              <strong>Family Atomic:</strong> {match.with_family_atomic ? '✅' : '❌'}<br />
              <strong>Runden:</strong> {match.played_rounds ?? '-'}
            </div>

            {match.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse border text-sm sm:text-base">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="border p-2">Platz</th>
                      <th className="border p-2">Spieler</th>
                      <th className="border p-2">Anführer</th>
                      <th className="border p-2">Siegpunkte</th>
                      {showDetails && <th className="border p-2 hidden sm:table-cell">Spice</th>}
                      {showDetails && <th className="border p-2 hidden sm:table-cell">Solari</th>}
                      {showDetails && <th className="border p-2 hidden sm:table-cell">Wasser</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {match.results.map(result => (
                      <tr key={result.id}>
                        <td className="border p-2 text-center">
                          {result.placement === 1 && '🥇'}
                          {result.placement === 2 && '🥈'}
                          {result.placement === 3 && '🥉'}
                          {result.placement > 3 && result.placement}
                        </td>
                        <td className="border p-2 break-words max-w-[120px]">{result.players?.name || '-'}</td>
                        <td className="border p-2 break-words max-w-[120px]">{result.leaders?.name || '-'}</td>
                        <td className="border p-2">{result.score}</td>
                        {showDetails && <td className="border p-2 hidden sm:table-cell">{result.spice}</td>}
                        {showDetails && <td className="border p-2 hidden sm:table-cell">{result.solari}</td>}
                        {showDetails && <td className="border p-2 hidden sm:table-cell">{result.water}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Keine Ergebnisse gespeichert.</p>
            )}

            <Link
              to={`/edit-match/${match.id}`}
              className="mt-4 inline-block bg-yellow-500 text-white px-3 py-1 rounded"
            >
              ✏️ Bearbeiten
            </Link>
          </div>
        ))
      )}
    </div>
  )
}
