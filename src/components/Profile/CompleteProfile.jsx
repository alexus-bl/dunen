import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function CompleteProfile() {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        setMessage('Fehler beim Abrufen des Benutzers.');
      } else {
        setMessage(`E-Mail-Adresse "${user.email}" erfolgreich bestätigt.`);
      }
    };

    checkUser();
  }, []);

  const handleContinue = () => {
    navigate('/groups');
  };

  return (
    <div className="p-6 min-h-screen bg-gray-800 text-white flex items-center justify-center">
      <div className="bg-gray-900 p-6 rounded w-full max-w-md text-center">
        <h2 className="text-xl font-bold mb-4">Registrierung abgeschlossen</h2>
        <p className="mb-6">{message}</p>
        <button
          onClick={handleContinue}
          className="bg-green-600 hover:bg-green-700 text-white p-3 rounded w-full"
        >
          Zur Übersicht</button>
      </div>
    </div>
  );
}
