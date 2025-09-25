import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const ALLOWED_COLORS = ['#3B82F6', '#10B981', '#EF4444', '#FFBF00'];

export default function ProfileSettings() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage('Fehler beim Laden des Benutzers.');
        setLoading(false);
        return;
      }

      setEmail(user.email);

      const { data, error } = await supabase
        .from('players')
        .select('username, favorite_color')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        setMessage('Fehler beim Laden des Profils.');
        setLoading(false);
        return;
      }

      setUsername(data.username || '');
      // Falls noch keine Lieblingsfarbe gesetzt: zufällig eine wählen und speichern
      if (!data.favorite_color || !ALLOWED_COLORS.includes(data.favorite_color)) {
        const random = ALLOWED_COLORS[Math.floor(Math.random() * ALLOWED_COLORS.length)];
        setFavoriteColor(random);
        await supabase
          .from('players')
          .update({ favorite_color: random })
          .eq('user_id', user.id);
      } else {
        setFavoriteColor(data.favorite_color);
      }

      setLoading(false);
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

  const updateFavoriteColor = async (color) => {
    if (!ALLOWED_COLORS.includes(color)) return;
    setFavoriteColor(color);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('players')
      .update({ favorite_color: color })
      .eq('user_id', user.id);

    if (error) {
      setMessage('Fehler beim Speichern der Farbe: ' + error.message);
    } else {
      setMessage('Farbe gespeichert!');
    }
  };

  return (
    <div className="p-8 bg-gray-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-6">Profil-Einstellungen</h2>

      {loading ? (
        <div className="opacity-70">Lade Profil…</div>
      ) : (
        <>
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
                  className="p-3 rounded w-full text-white mb-2"
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

          <div className="mb-8">
            <label className="block mb-2">Favorisierte Spielerfarbe</label>
            <div className="flex gap-3">
              {ALLOWED_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateFavoriteColor(c)}
                  className={`w-10 h-10 rounded-full border-2 transition
                    ${favoriteColor === c ? 'ring-2 ring-offset-2 ring-white border-white' : 'border-gray-300'}
                  `}
                  style={{ backgroundColor: c }}
                  aria-label={`Farbe ${c}`}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-300">Wird im Dashboard für Linienfarbe (Winrate & Punkte) verwendet.</p>
          </div>

          <div className="mb-6">
            <label className="block mb-2">Neues Passwort</label>
            <input
              type="password"
              placeholder="Neues Passwort eingeben"
              className="p-3 rounded w-full text-white mb-2"
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

          {message && <p className="text-center text-green-300 mt-4">{message}</p>}
        </>
      )}
    </div>
  );
}
