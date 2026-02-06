// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Pages
import Dashboard from './pages/Dashboard';
import AddMatch from './pages/AddMatch';
import Matches from './pages/Matches';
import EditMatch from './pages/EditMatch';
import Login from './pages/Login';
import InvitationPage from './pages/InvitationPage';

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import GroupOverview from './components/Group/GroupOverview';
import GroupSettings from './components/Group/GroupSettings';
import ProfileSettings from './components/Profile/ProfileSettings';

// Context & Guards
import { GroupProvider } from './context/GroupContext';
import { RequireAuth, PublicOnly, RequireGroup } from './components/routing/guards';

// ---------- LAYOUT KOMPONENTE ----------
function AppLayout({ isSidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  
  // Pfade ohne Navbar/Sidebar
  const noNavRoutes = ['/'];
  const noSidebarRoutes = ['/', '/groups', '/profile-settings']; 
  
  const showNavbar = !noNavRoutes.includes(location.pathname);
  // Sidebar ausblenden auf noSidebar-Routen oder Einladungs-Links
  const showSidebar = !noSidebarRoutes.includes(location.pathname) && !location.pathname.startsWith('/invite/');

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-800 text-white">
      {showSidebar && (
        <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      )}
      <div className="flex flex-col flex-1 w-full">
        {showNavbar && (
          <Navbar toggleSidebar={() => setSidebarOpen(prev => !prev)} />
        )}
        <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ---------- HAUPT APP KOMPONENTE ----------
export default function App() {
  const [user, setUser] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Backup-Funktion: Stellt sicher, dass ein Spieler-Profil existiert
  // (Der Datenbank-Trigger erledigt das meistens schon von selbst)
  const ensurePlayerProfile = useCallback(async (currentUser) => {
    if (!currentUser) return;
    try {
      const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0];
      
      // Wir nutzen upsert. Dank des UNIQUE-Constraint in der DB 
      // wird hier kein Fehler mehr (400) geworfen.
      await supabase.from('players').upsert({
        user_id: currentUser.id,
        email: currentUser.email,
        username: username,
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error("Fehler beim Profil-Check:", e.message);
    }
  }, []);

  useEffect(() => {
    // 1. Initial Auth Check
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await ensurePlayerProfile(currentUser);
        }
      } catch (err) {
        console.error("Auth-Fehler:", err);
      } finally {
        // Dieser Call muss IMMER kommen, damit der Lade-Screen verschwindet
        setProfileChecked(true);
      }
    };

    initAuth();

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await ensurePlayerProfile(currentUser);
      }
      setProfileChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [ensurePlayerProfile]);

  // WARTESCREEN (Verhindert fehlerhafte Redirects der Guards)
  if (!profileChecked) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white font-medium animate-pulse">Lade Profil...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <GroupProvider user={user}>
        <Routes>
          
          {/* Haupt-Layout Wrapper */}
          <Route element={<AppLayout isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />}>
            
            {/* --- ÖFFENTLICHE SEITEN --- */}
            <Route
              path="/"
              element={
                <PublicOnly user={user} ready={profileChecked}>
                  <Login />
                </PublicOnly>
              }
            />
            <Route path="/invite/:id" element={<InvitationPage />} />

            {/* --- NUR EINGELOGGTE USER --- */}
            <Route
              path="/groups"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <GroupOverview />
                </RequireAuth>
              }
            />
            <Route
              path="/profile-settings"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <ProfileSettings />
                </RequireAuth>
              }
            />
            <Route
              path="/groups/:groupId/settings"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <GroupSettings />
                </RequireAuth>
              }
            />

            {/* --- USER MIT GEWÄHLTER GRUPPE --- */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <RequireGroup>
                    <Dashboard />
                  </RequireGroup>
                </RequireAuth>
              }
            />
            <Route
              path="/matches"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <RequireGroup>
                    <Matches />
                  </RequireGroup>
                </RequireAuth>
              }
            />
            <Route
              path="/add-match"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <RequireGroup>
                    <AddMatch />
                  </RequireGroup>
                </RequireAuth>
              }
            />
            <Route
              path="/edit-match/:matchId"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <RequireGroup>
                    <EditMatch />
                  </RequireGroup>
                </RequireAuth>
              }
            />

          </Route>

          {/* Fallback bei unbekannten URLs */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GroupProvider>
    </BrowserRouter>
  );
}