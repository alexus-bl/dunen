import { Bell, UserCircle, Search, Menu } from 'lucide-react';

export default function Navbar({ toggleSidebar }) {
  return (
    <header className="flex w-full justify-between items-center bg-gray-800 dark:text-white py-3 px-6">
      <button className="md:hidden mr-4 dark:bg-white dark:text-gray-800" onClick={toggleSidebar}>
        <Menu className="w-6 h-6" />
      </button>{/* 
      <div className="flex items-center flex-grow">
       <div className="relative w-full md:max-w-xs">
          <input
            type="search"
            placeholder="Suchen..."
            className="pl-10 pr-4 py-2 rounded-lg bg-white text-gray-700 outline-none shadow w-full"
          />
          <Search className="absolute top-1/2 transform -translate-y-1/2 left-3 text-gray-400 w-5 h-5" />
        </div>
      </div>
      {/*<div className="flex items-center gap-4">
        <button className="relative p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 bg-red-500 rounded-full w-2 h-2"></span>
        </button>
        <button className="p-2 bg-white text-green-500 rounded-full hover:bg-green-400 hover:text-white transition">
          <UserCircle className="w-5 h-5" />
        </button>
      </div>*/}
    </header>
  );
}
