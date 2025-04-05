import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import AddMatch from './pages/AddMatch';
import Matches from './pages/Matches';
import EditMatch from './pages/EditMatch';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import { supabase } from './supabaseClient';
import GroupOverview from './components/Group/GroupOverview';

function AppLayout({ children }) {
  const location = useLocation();
  const isLoginPage = location.pathname === '/';

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  if (isLoginPage || !user) {
    // Hier liegt die entscheidende Änderung: Kein Flex, sondern normales Block-Layout!
    return (
      <div className="min-h-screen w-full bg-gray-800">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-800">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 w-full">
        <Navbar toggleSidebar={() => setSidebarOpen(prev => !prev)} />
        <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/add-match" element={<AddMatch />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/edit-match/:matchId" element={<EditMatch />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/groups" element={<GroupOverview />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
