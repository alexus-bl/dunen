import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Users, ClipboardCheck } from 'lucide-react'

export default function ResultsForm({ matchId, resetForm, gameId, withExpansion }) {
  const playerOptions = [
    { id: 1, name: 'Alex' },
    { id: 2, name: 'Janosch' },
    { id: 3, name: 'Casjen' },
    { id: 4, name: 'Hubertus' }
  ]

  const [leaders, setLeaders] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [playerResults, setPlayerResults] = useState({})
  const [isResultsComplete, setIsResultsComplete] = useState(false)

  useEffect(() => {
    async function fetchLeaders() {
      const { data, error } = await supabase.rpc('get_available_leaders', {
        selected_game_id: gameId,
        selected_expansion: withExpansion
      })
      if (error) console.error(error)
      else setLeaders(data)
    }
    fetchLeaders()
  }, [gameId, withExpansion])

  const togglePlayerSelection = (player) => {
    const exists = selectedPlayers.some(p => p.id === player.id);
    if (exists) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    } else {
      setSelectedPlayers([...selectedPlayers, player]);
    }
  }

  const startResultsInput = () => {
    if (selectedPlayers.length > 0) setCurrentPlayerIndex(1)
    else alert('Bitte mindestens einen Spieler auswählen!')
  }

  const handleNextPlayer = () => {
    if (currentPlayerIndex < selectedPlayers.length) setCurrentPlayerIndex(currentPlayerIndex + 1)
    else setIsResultsComplete(true)
  }

  const handleSaveResults = async () => {
    const resultsToInsert = selectedPlayers.map(p => {
      const result = playerResults[p.id] || {}
      return {
        match_id: matchId,
        player_id: p.id,
        leader_id: result.leader,
        score: result.score,
        spice: result.spice,
        solari: result.solari,
        water: result.water
      }
    })
    const { error } = await supabase.from('results').insert(resultsToInsert)
    if (error) alert(`Fehler: ${error.message}`)
    else {
      alert('✅ Ergebnisse gespeichert!')
      resetForm()
    }
  }

  const currentPlayer = selectedPlayers[currentPlayerIndex - 1]

  return (
    <div className="container mx-auto">
      {!isResultsComplete ? (
        currentPlayerIndex === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="text-blue-500" /> Wer hat mitgespielt?
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {playerOptions.map(player => {
                const isSelected = selectedPlayers.some(p => p.id === player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayerSelection(player)}
                    className={`px-4 py-2 rounded-xl border transition whitespace-nowrap
                      ${isSelected 
                        ? 'text-gray-100 bg-green-500 border-blue-600' 
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-200 border-gray-300'}`}
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={startResultsInput}
              className="bg-gray-100 px-4 py-2 rounded hover:bg-gray-200 transition"
            >
              Weiter
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-2xl font-bold mb-4">
              Ergebnisse: {currentPlayer?.name}
            </h3>

            <label className="flex flex-col mb-4">
              <span className="font-semibold">Anführer:</span>
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
                        [field]: Number(e.target.value)
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
          <button
            onClick={handleSaveResults}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Ergebnisse speichern
          </button>
        </div>
      )}
    </div>
  )
}
