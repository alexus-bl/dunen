// App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Pages & Components
import Dashboard from './pages/Dashboard';
import AddMatch from './pages/AddMatch';
import Matches from './pages/Matches';
import EditMatch from './pages/EditMatch';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import GroupOverview from './components/Group/GroupOverview';
import GroupSettings from './components/Group/GroupSettings';
import ProfileSettings from './components/Profile/ProfileSettings';
import InvitationPage from './pages/InvitationPage';

// Context & Guards
import { GroupProvider } from './context/GroupContext';
import { RequireAuth, PublicOnly, RequireGroup } from './components/routing/guards';

// ---------- LAYOUTS ----------

// Layout für Seiten MIT Navigation (Dashboard, Matches etc.)
function AuthenticatedLayout({ isSidebarOpen, setSidebarOpen }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-800 text-white">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 w-full">
        <Navbar toggleSidebar={() => setSidebarOpen(prev => !prev)} />
        <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
          <Outlet /> {/* Hier werden die Kind-Komponenten gerendert */}
        </main>
      </div>
    </div>
  );
}

// Layout für einfache Seiten (Login, Einladung)
function SimpleLayout() {
  return (
    <div className="min-h-screen w-full bg-gray-800 flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

// ---------- MAIN APP COMPONENT ----------

export default function App() {
  const [user, setUser] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Hilfsfunktion zum Sicherstellen des Spieler-Profils
  const ensurePlayerProfile = useCallback(async (currentUser) => {
    if (!currentUser || !currentUser.confirmed_at) return;

    const username =
      currentUser.user_metadata?.username ||
      currentUser.email?.split('@')[0] ||
      `user_${currentUser.id.slice(0, 6)}`;

    const { error } = await supabase.from('players').upsert(
      {
        user_id: currentUser.id,
        email: currentUser.email,
        username,
      },
      { onConflict: 'user_id' }
    );

    if (error) console.error('Fehler beim Profil-Sync:', error.message);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      
      if (currentUser) {
        await ensurePlayerProfile(currentUser);
      }
      
      setUser(currentUser);
      setProfileChecked(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await ensurePlayerProfile(currentUser);
    });

    return () => subscription.unsubscribe();
  }, [ensurePlayerProfile]);

  if (!profileChecked) {
    return <div className="min-h-screen bg-gray-800 flex items-center justify-center text-white">Lade Profil...</div>;
  }

  return (
    <BrowserRouter>
      {/* GroupProvider stellt sicher, dass alle Unterkomponenten Zugriff auf Gruppeneinstellungen haben */}
      <GroupProvider user={user}>
        <Routes>
          
          {/* ÖFFENTLICHE ROUTEN */}
          <Route element={<SimpleLayout />}>
            <Route
              path="/"
              element={
                <PublicOnly user={user} ready={profileChecked}>
                  <Login />
                </PublicOnly>
              }
            />
            <Route path="/invite/:id" element={<InvitationPage />} />
          </Route>

          {/* GESCHÜTZTE ROUTEN (Auth erforderlich) */}
          <Route
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <AuthenticatedLayout isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
              </RequireAuth>
            }
          >
            {/* Nur Auth nötig */}
            <Route path="/groups" element={<GroupOverview />} />
            <Route path="/profile-settings" element={<ProfileSettings />} />
            <Route path="/groups/:groupId/settings" element={<GroupSettings />} />

            {/* Auth + Gruppe gewählt nötig */}
            <Route element={<RequireGroup />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/add-match" element={<AddMatch />} />
              <Route path="/edit-match/:matchId" element={<EditMatch />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GroupProvider>
    </BrowserRouter>
  );
}