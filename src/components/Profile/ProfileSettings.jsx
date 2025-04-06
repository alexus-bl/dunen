import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ProfileSettings() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage('Fehler beim Laden des Benutzers.');
        return;
      }

      setEmail(user.email);

      const { data, error } = await supabase
        .from('players')
        .select('username')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setMessage('Fehler beim Laden des Profils.');
      } else {
        setUsername(data.username);
      }
    };

    fetchProfile();
  }, []);

  const updateUsername = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('players')
      .update({ username })
      .eq('user_id', user.id);

    if (error) {
      setMessage('Fehler beim Speichern: ' + error.message);
    } else {
      setMessage('Benutzername erfolgreich aktualisiert!');
    }
  };

  return (
    <div className="p-8 bg-gray-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-6">Profil-Einstellungen</h2>

      <div className="mb-4">
        <label className="block mb-2">E-Mail (nicht änderbar)</label>
        <input
          type="email"
          className="p-3 rounded w-full text-gray-500 cursor-not-allowed"
          value={email}
          disabled
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2">Benutzername</label>
        <input
          className="p-3 rounded w-full text-gray-800"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <button
        className="bg-green-500 hover:bg-green-600 p-3 rounded w-full"
        onClick={updateUsername}
      >
        Speichern
      </button>

      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}
