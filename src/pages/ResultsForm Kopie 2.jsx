import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { SelectButton } from 'primereact/selectbutton'

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
    <div className="p-4 max-w-md mx-auto">
      {!isResultsComplete ? (
        currentPlayerIndex === 0 ? (
          <div>
            <h3 className="text-xl font-bold mb-4">Wer hat mitgespielt?</h3>
            <SelectButton
              value={selectedPlayers}
              onChange={(e) => setSelectedPlayers(e.value)}
              options={playerOptions}
              optionLabel="name"
              multiple
              className="mb-2"
              pt={{
                button: {
                 
                },
                root: {
                  className: 'flex gap-0' // optional: Abstand zwischen Buttons
                }
              }}
             
            />
            <button
              onClick={startResultsInput}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Weiter
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-bold mb-4">
              Ergebnisse: {currentPlayer?.name}
            </h3>

            <label className="flex flex-col mb-2">
              Anführer:
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
              <label key={field} className="flex flex-col mb-2 capitalize">
                {field.charAt(0).toUpperCase() + field.slice(1)}:


                {/*  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={
                      playerResults[currentPlayer.id]?.score === 0
                        ? '0'
                        : playerResults[currentPlayer.id]?.score || ''
                    }
                    onChange={(e) => {
                      const value = e.target.value
                      setPlayerResults(prev => ({
                        ...prev,
                        [currentPlayer.id]: {
                          ...prev[currentPlayer.id],
                          score: value === '' ? '' : Number(value)
                        }
                      }))
                    }}
                    className="border p-2 rounded"
                  /> */}

                  
               
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
              className="bg-green-500 text-white px-4 py-2 rounded mt-4"
            >
              {currentPlayerIndex < selectedPlayers.length ? 'Weiter' : 'Abschließen'}
            </button>
          </div>
        )
      ) : (
        <div>
          <h3 className="text-xl font-bold mb-4">Ergebnisse überprüfen und speichern</h3>
          <button
            onClick={handleSaveResults}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Ergebnisse speichern
          </button>
        </div>
      )}
    </div>
  )
}
