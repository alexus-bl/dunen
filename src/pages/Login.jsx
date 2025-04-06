import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  const navigate = useNavigate();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      navigate('/groups');
    }
  };

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.user) {
      const { error: playerError } = await supabase.from('players').insert({
        email,
        user_id: data.user.id,
        username,
      });

      if (playerError) {
        setMessage('Fehler beim Erstellen des Spielerprofils: ' + playerError.message);
      } else {
        navigate('/groups');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800">
      <div className="bg-gray-900 p-10 rounded shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isRegistering ? 'Registrieren' : 'Login'}
        </h2>

        {isRegistering && (
          <input
            type="text"
            placeholder="Benutzername"
            className="p-3 rounded w-full mb-4"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          className="p-3 rounded w-full mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Passwort"
          className="p-3 rounded w-full mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {message && <p className="text-red-500 text-center mb-4">{message}</p>}

        <button
          className="bg-green-600 hover:bg-green-500 text-white p-3 rounded w-full transition"
          onClick={isRegistering ? handleRegister : handleLogin}
        >
          {isRegistering ? 'Registrieren' : 'Login'}
        </button>

        <p
          className="mt-4 text-white text-center cursor-pointer underline"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? 'Schon einen Account? Login!' : 'Noch kein Account? Registrieren!'}
        </p>
      </div>
    </div>
  );
}
