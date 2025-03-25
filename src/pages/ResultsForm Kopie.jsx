import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { SelectButton } from 'primereact/selectbutton'

export default function ResultsForm({ matchId, resetForm, gameId, withExpansion }) {
  const players = [
    { id: 1, name: 'Hubertus' },
    { id: 2, name: 'Janosch' },
    { id: 3, name: 'Alex' },
    { id: 4, name: 'Casjen' },
  ]

  const [leaders, setLeaders] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [playerResults, setPlayerResults] = useState({})
  const [isResultsComplete, setIsResultsComplete] = useState(false)

  // Dynamisches Laden der Leader abhängig von Spiel und Erweiterung
  useEffect(() => {
    async function fetchLeaders() {
      if (!gameId) {
        console.warn('gameId ist noch nicht gesetzt.')
        return
      }
  
      const { data, error } = await supabase.rpc('get_available_leaders', {
        selected_game_id: Number(gameId),
        selected_expansion: Boolean(withExpansion),
        
      })
  
      if (error) {
        console.error('Fehler beim Laden der Leader:', error)
      } else {
        console.log('Geladene Leader:', data)
        setLeaders(data)
      }
    }
  
    fetchLeaders()
  }, [gameId, withExpansion])

  const handlePlayerSelection = (playerId) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    )
  }

  const startResultsInput = () => {
    if (selectedPlayers.length > 0) {
      setCurrentPlayerIndex(1)
    } else {
      alert('Bitte mindestens einen Spieler auswählen!')
    }
  }

  const handleNextPlayer = () => {
    if (currentPlayerIndex < selectedPlayers.length) {
      setCurrentPlayerIndex(currentPlayerIndex + 1)
    } else {
      setIsResultsComplete(true)
    }
  }

  const handleSaveResults = async () => {
    const resultsToInsert = selectedPlayers.map((playerId) => ({
      match_id: matchId,
      player_id: playerId,
      leader_id: playerResults[playerId]?.leader,
      score: playerResults[playerId]?.score,
      spice: playerResults[playerId]?.spice,
      water: playerResults[playerId]?.water,
      solari: playerResults[playerId]?.solari,
    }))
    const { error } = await supabase.from('results').insert(resultsToInsert)

    if (error) {
      alert(`Fehler: ${error.message}`)
    } else {
      alert('✅ Ergebnisse erfolgreich gespeichert!')
      resetForm()
    }
  }

  const currentPlayerId = selectedPlayers[currentPlayerIndex - 1] // Hilfsvariable für bessere Lesbarkeit

  return (
    <div className="p-4 max-w-md mx-auto">
      {!isResultsComplete ? (
        <>
          {currentPlayerIndex === 0 ? (
            <div>
              <h3 className="text-xl font-bold">Wer hat mitgespielt?</h3>
              {players.map((player) => (
                <label key={player.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(player.id)}
                    onChange={() => handlePlayerSelection(player.id)}
                  />
                  {player.name}
                </label>
              ))}
              <button
                onClick={startResultsInput}
                className="mt-4 bg-blue-500 text-white p-2 rounded"
              >
                Weiter
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold">
                Ergebnisse Spieler {currentPlayerIndex} von {selectedPlayers.length}:{' '}
                {players.find((p) => p.id === currentPlayerId)?.name}
              </h3>

              <label className="flex flex-col">
                Anführer:
                <select
                  required
                  value={playerResults[currentPlayerId]?.leader || ''}
                  onChange={(e) =>
                    setPlayerResults((prev) => ({
                      ...prev,
                      [currentPlayerId]: {
                        ...prev[currentPlayerId],
                        leader: Number(e.target.value),
                      },
                    }))
                  }
                  className="border p-2 rounded"
                >
                  <option value="">Bitte wählen</option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col">
                Siegpunkte:
                <input
                  type="number"
                  min="0"
                  required
                  value={
                    playerResults[currentPlayerId]?.score !== undefined 
                      ? playerResults[currentPlayerId].score 
                      : ''
                  }
                  onChange={(e) =>
                    setPlayerResults((prev) => ({
                      ...prev,
                      [currentPlayerId]: {
                        ...prev[currentPlayerId],
                        score: Math.max(0, Number(e.target.value)),
                      },
                    }))
                  }
                  className="border p-2 rounded"
                />
              </label>

              <label className="flex flex-col">
                Spice:
                <input
                  type="number"
                  min="0"
                  required
                  value={
                    playerResults[currentPlayerId]?.spice !== undefined 
                      ? playerResults[currentPlayerId].spice 
                      : ''
                  }
                  onChange={(e) =>
                    setPlayerResults((prev) => ({
                      ...prev,
                      [currentPlayerId]: {
                        ...prev[currentPlayerId],
                        spice: Math.max(0, Number(e.target.value)),
                      },
                    }))
                  }
                  className="border p-2 rounded"
                />
              </label>

              <label className="flex flex-col">
                Solari:
                <input
                  type="number"
                  min="0"
                  required
                  value={
                    playerResults[currentPlayerId]?.solari !== undefined 
                      ? playerResults[currentPlayerId].solari 
                      : ''
                  }
                  onChange={(e) =>
                    setPlayerResults((prev) => ({
                      ...prev,
                      [currentPlayerId]: {
                        ...prev[currentPlayerId],
                        solari: Math.max(0, Number(e.target.value)),
                      },
                    }))
                  }
                  className="border p-2 rounded"
                />
              </label>

              <label className="flex flex-col">
                Wasser:
                <input
                  type="number"
                  min="0"
                  required
                  value={
                    playerResults[currentPlayerId]?.water !== undefined 
                      ? playerResults[currentPlayerId].water 
                      : ''
                  }
                  onChange={(e) =>
                    setPlayerResults((prev) => ({
                      ...prev,
                      [currentPlayerId]: {
                        ...prev[currentPlayerId],
                        water: Math.max(0, Number(e.target.value)),
                      },
                    }))
                  }
                  className="border p-2 rounded"
                />
              </label>


              <button
                onClick={handleNextPlayer}
                className="mt-4 bg-green-500 text-white p-2 rounded"
              >
                {currentPlayerIndex < selectedPlayers.length ? 'Weiter' : 'Zur Übersicht'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div>
          <h3 className="text-xl font-bold">Ergebnisse überprüfen & speichern</h3>
          <button
            onClick={handleSaveResults}
            className="mt-4 bg-blue-500 text-white p-2 rounded"
          >
            Ergebnisse speichern
          </button>
        </div>
      )}
    </div>
  )
}
