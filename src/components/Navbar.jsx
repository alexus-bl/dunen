import { LayoutDashboard, UserCircle, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Navbar({ toggleSidebar }) {
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState('');

useEffect(() => {
  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email);
    } else {
      setUserEmail('');
    }
  };

  fetchUser();
}, []);


  return (
    <header className="flex w-full items-center bg-gray-800 dark:text-white py-3 px-6">
  {/* Toggle Sidebar Button – nur auf kleinen Bildschirmen sichtbar */}
  <div className="md:hidden mr-4">
    <button className="dark:bg-white dark:text-gray-800" onClick={toggleSidebar}>
      <Menu className="w-6 h-6" />
    </button>
  </div>

  {/* Platzhalter für Abstand – immer da */}
  <div className="flex-grow" />

  {/* Icons rechts */}

  <div className="flex items-center gap-4">
  {userEmail && (
    <span className="text-sm text-white hidden sm:block">{userEmail}</span>
  )}
  <button
    onClick={() => navigate('/profile-settings')}
    className="p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition"
  >
    <UserCircle className="w-5 h-5" />
  </button>
</div>

  <div className="flex items-center gap-4">
    <button onClick={() => navigate('/groups')}
      className="relative p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition">
      <LayoutDashboard className="w-5 h-5" />
      
    </button>
    <button
      onClick={() => navigate('/profile-settings')}
      className="p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition"
    >
      <UserCircle className="w-5 h-5" />
    </button>

    <button
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  }}
  className="text-sm text-red-400 hover:underline ml-4"
>
  Logout
</button>
  </div>
</header>
  );
}
