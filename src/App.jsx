import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import AddMatch from './pages/AddMatch';
import Matches from './pages/Matches';
import EditMatch from './pages/EditMatch';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';

function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex flex-col w-screen md:flex-row min-h-screen bg-gray-800">
        <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setSidebarOpen(false)} />

        <div className="flex flex-col flex-1">
          <Navbar toggleSidebar={() => setSidebarOpen(prev => !prev)} />

          {/* Stelle sicher, dass hier KEINE flex-col und KEINE items-center Klassen stehen */}
          <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/add-match" element={<AddMatch />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/edit-match/:matchId" element={<EditMatch />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
