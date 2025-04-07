import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function CompleteProfile() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // Spielerprofil anlegen
    const { error: insertError } = await supabase.from('players').insert({
      user_id: user.id,
      email: user.email,
      username,
    });

    if (insertError) {
      setMessage('Fehler beim Speichern des Profils: ' + insertError.message);
      return;
    }

    // Passwort setzen
    const { error: passwordError } = await supabase.auth.updateUser({ password });

    if (passwordError) {
      setMessage('Fehler beim Setzen des Passworts: ' + passwordError.message);
      return;
    }

    navigate('/groups');
  };

  return (
    <div className="p-6 min-h-screen bg-gray-800 text-white flex items-center justify-center">
      <div className="bg-gray-900 p-6 rounded w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-center">Profil vervollständigen</h2>

        <input
          className="p-3 rounded w-full text-gray-800 mb-4"
          placeholder="Benutzername"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="p-3 rounded w-full text-gray-800 mb-4"
          placeholder="Passwort setzen"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleSave} className="bg-green-600 text-white p-3 rounded w-full">
          Speichern und fortfahren
        </button>

        {message && <p className="text-red-500 mt-4 text-center">{message}</p>}
      </div>
    </div>
  );
}
