import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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
import ProfileSettings from './components/Profile/ProfileSettings';
import CompleteProfile from './components/Profile/CompleteProfile';

function AppLayout({ children }) {
  const location = useLocation();
  const noNavRoutes = ['/', '/complete-profile'];
  const noSidebarRoutes = ['/', '/groups', '/complete-profile'];
  const showNavbar = !noNavRoutes.includes(location.pathname);
  const showSidebar = !noSidebarRoutes.includes(location.pathname);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: player } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!player && location.pathname !== '/complete-profile') {
          return window.location.replace('/complete-profile');
        }
      }

      setProfileChecked(true);
    };

    initAuth();
  }, [location.pathname]);

  if (!profileChecked) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-800">
      {showSidebar && (
        <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      )}
      <div className="flex flex-col flex-1 w-full">
        {showNavbar && (
          <Navbar toggleSidebar={() => setSidebarOpen(prev => !prev)} />
        )}
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
          <Route path="/profile-settings" element={<ProfileSettings />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="*" element={<Navigate to="/" />} /> 
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
