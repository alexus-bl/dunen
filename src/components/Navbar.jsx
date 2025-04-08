import { Bell, UserCircle, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ toggleSidebar }) {
  const navigate = useNavigate();

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
    <button className="relative p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition">
      <Bell className="w-5 h-5" />
      <span className="absolute top-0 right-0 bg-red-500 rounded-full w-2 h-2"></span>
    </button>
    <button
      onClick={() => navigate('/profile-settings')}
      className="p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition"
    >
      <UserCircle className="w-5 h-5" />
    </button>
  </div>
</header>
  );
}
