import { Link } from 'react-router-dom';
import { Home, Trophy, PlusCircle, List, X } from 'lucide-react';

export default function Sidebar({ isOpen, closeSidebar }) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition duration-300 ease-in-out w-60 bg-gray-800 text-white md:relative md:translate-x-0`}
      >
        <div className="p-4 flex justify-between items-center font-semibold text-xl text-green-500">
          Dunen Dashboard
          <button className="md:hidden dark:bg-white" onClick={closeSidebar}>
            <X />
          </button>
        </div>
        <nav className="mt-6">
          <ul>
            <li className="px-4 py-2 hover:bg-gray-700">
              <Link to="/" className="flex items-center gap-3 " onClick={closeSidebar}>
                <Trophy className="w-5 h-5 text-white" /> Dashboard
              </Link>
            </li>
            <li className="px-4 py-2 hover:bg-gray-700">
              <Link to="/add-match" className="flex items-center gap-3" onClick={closeSidebar}>
                <PlusCircle className="w-5 h-5" /> Neue Partie
              </Link>
            </li>
            <li className="px-4 py-2 hover:bg-gray-700">
              <Link to="/matches" className="flex items-center gap-3" onClick={closeSidebar}>
                <List className="w-5 h-5" /> Partien
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
          onClick={closeSidebar}
        ></div>
      )}
    </>
  );
}
