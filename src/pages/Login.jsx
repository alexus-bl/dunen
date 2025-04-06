import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Bitte prüfe deine E-Mails und klicke auf den Anmeldelink.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800">
      <div className="bg-gray-900 p-10 rounded shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Login via Magic Link</h2>
        <input
          type="email"
          placeholder="Email"
          className="p-3 rounded w-full mb-4"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        {message && <p className="text-white text-center mb-4">{message}</p>}
        <button
          className="bg-green-600 hover:bg-green-500 text-white p-3 rounded w-full transition"
          onClick={handleLogin}
        >
          Magic Link senden
        </button>
      </div>
    </div>
  );
}
