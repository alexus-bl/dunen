// App.jsx
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
// Diese Komponente regelt, wo Sidebar und Navbar erscheinen
function AppLayout({ isSidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  
  // Definition, auf welchen Routen KEINE Sidebar/Navbar sein soll
  const noNavRoutes = ['/'];
  const noSidebarRoutes = ['/', '/groups', '/invite'];
  
  const showNavbar = !noNavRoutes.includes(location.pathname);
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
          <Outlet /> {/* Hier werden die jeweiligen Pages gerendert */}
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

  // Hilfsfunktion: Spieler-Profil in DB sicherstellen (Upsert verhindert Fehler)
  const ensurePlayerProfile = useCallback(async (currentUser) => {
    if (!currentUser || !currentUser.confirmed_at) return;

    const username =
      currentUser.user_metadata?.username ||
      currentUser.email?.split('@')[0] ||
      `user_${currentUser.id.slice(0, 6)}`;

    await supabase.from('players').upsert(
      {
        user_id: currentUser.id,
        email: currentUser.email,
        username,
      },
      { onConflict: 'user_id' }
    );
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Session prüfen
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
  
        const currentUser = session?.user ?? null;
        setUser(currentUser);
  
        // 2. Profil nur prüfen, wenn User da ist
        if (currentUser) {
          // Wir nutzen hier KEIN await, damit der App-Start nicht blockiert wird,
          // falls die Datenbank-Anfrage mal länger dauert.
          ensurePlayerProfile(currentUser);
        }
      } catch (err) {
        console.error("Fehler beim Auth-Init:", err);
      } finally {
        // WICHTIG: Das muss IMMER ausgeführt werden, damit "Lade Profil..." verschwindet
        setProfileChecked(true);
      }
    };
  
    initAuth();
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) ensurePlayerProfile(currentUser);
      setProfileChecked(true);
    });
  
    return () => subscription.unsubscribe();
  }, [ensurePlayerProfile]);

  // Falls Supabase noch arbeitet, zeigen wir einen Ladebildschirm
  if (!profileChecked) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center text-white font-medium">
        Lade Profil...
      </div>
    );
  }

  return (
    <BrowserRouter>
      {/* GroupProvider muss innerhalb von BrowserRouter sein, damit er Navigieren kann */}
      <GroupProvider user={user}>
        <Routes>
          
          {/* Layout Wrapper für die gesamte App */}
          <Route element={<AppLayout isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />}>
            
            {/* 1. ÖFFENTLICHE ROUTEN */}
            <Route
              path="/"
              element={
                <PublicOnly user={user} ready={profileChecked}>
                  <Login />
                </PublicOnly>
              }
            />
            <Route path="/invite/:id" element={<InvitationPage />} />

            {/* 2. AUTH ERFORDERLICH (Keine Gruppe nötig) */}
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

            {/* 3. AUTH + GRUPPE ERFORDERLICH */}
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GroupProvider>
    </BrowserRouter>
  );
}