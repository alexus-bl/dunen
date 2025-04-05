import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');

  const navigate = useNavigate(); // <--- wichtig!

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      navigate('/groups'); // Weiterleitung erfolgt hier!
    }
  };

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      await supabase.from('players').insert({ email, user_id: data.user.id });
      navigate('/groups');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800">
      <div className="bg-gray-900 p-10 rounded shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isRegistering ? 'Registrieren' : 'Login'}
        </h2>
        <input
          type="email"
          placeholder="Email"
          className="p-3 rounded w-full mb-4"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Passwort"
          className="p-3 rounded w-full mb-4"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
