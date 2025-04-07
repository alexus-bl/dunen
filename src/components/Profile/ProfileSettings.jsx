import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function ProfileSettings() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newPassword, setNewPassword] = useState('');
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
      setMessage('Fehler beim Speichern des Benutzernamens: ' + error.message);
    } else {
      setMessage('Benutzername erfolgreich aktualisiert!');
      setEditingUsername(false);
    }
  };

  const updatePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage('Fehler beim Ändern des Passworts: ' + error.message);
    } else {
      setMessage('Passwort erfolgreich geändert!');
      setNewPassword('');
    }
  };

  return (
    <div className="p-8 bg-gray-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-6">Profil-Einstellungen</h2>

      <div className="mb-6">
        <label className="block mb-2">E-Mail (nicht änderbar)</label>
        <input
          type="email"
          className="p-3 rounded w-full text-gray-500 cursor-not-allowed"
          value={email}
          disabled
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2">Benutzername</label>
        {!editingUsername ? (
          <div className="flex justify-between items-center">
            <span className="text-lg">{username}</span>
            <button
              className="text-sm text-green-400 underline"
              onClick={() => setEditingUsername(true)}
            >
              Bearbeiten
            </button>
          </div>
        ) : (
          <div>
            <input
              className="p-3 rounded w-full text-gray-800 mb-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded w-full"
              onClick={updateUsername}
            >
              Speichern
            </button>
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block mb-2">Neues Passwort</label>
        <input
          type="password"
          placeholder="Neues Passwort eingeben"
          className="p-3 rounded w-full text-gray-800 mb-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button
          className="bg-green-600 hover:bg-green-700 text-white p-2 rounded w-full"
          onClick={updatePassword}
        >
          Passwort ändern
        </button>
      </div>

      {message && <p className="text-center text-red-400 mt-4">{message}</p>}
    </div>
  );
}
