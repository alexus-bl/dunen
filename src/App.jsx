import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import AddMatch from './pages/AddMatch';
import Matches from './pages/Matches';
import EditMatch from './pages/EditMatch';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import GroupOverview from './components/Group/GroupOverview';
import { supabase } from './supabaseClient';

function AppLayout({ children }) {
  const location = useLocation();
  const noNavRoutes = ['/', '/groups']; // Keine Navbar und Sidebar hier anzeigen
  const isNoNavRoute = noNavRoutes.includes(location.pathname);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  if (isNoNavRoute || !user) {
    // Ohne Navbar/Sidebar (Login und GroupOverview)
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
          <Route path="/groups" element={<GroupOverview />} />
          <Route path="/add-match" element={<AddMatch />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/edit-match/:matchId" element={<EditMatch />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
