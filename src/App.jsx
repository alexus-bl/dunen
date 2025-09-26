// App.jsx
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
import GroupSettings from './components/Group/GroupSettings';
import { supabase } from './supabaseClient';
import ProfileSettings from './components/Profile/ProfileSettings';
import InvitationPage from './pages/InvitationPage';
import { GroupProvider } from './context/GroupContext';
import { RequireAuth, PublicOnly, RequireGroup } from './components/routing/guards';


// ---------- Layout (Navbar/Sidebar je nach Route) ----------
function AppLayout({ children }) {
  const location = useLocation();
  const noNavRoutes = ['/'];
  const noSidebarRoutes = ['/', '/groups', '/invite', '/invite/:id'];
  const showNavbar = !noNavRoutes.includes(location.pathname);
  const showSidebar = !noSidebarRoutes.includes(location.pathname);

  const [isSidebarOpen, setSidebarOpen] = useState(false);

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

export default function App() {
  const [user, setUser] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    let sub;

    const initAuth = async () => {
      // 1) aktuelle Session laden
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // 2) Falls verifiziert: Player-Record sicherstellen
      if (currentUser && currentUser.confirmed_at) {
        const { data: player, error } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (!player && !error) {
          const username =
            currentUser.user_metadata?.username ||
            currentUser.email?.split('@')[0] ||
            `user_${currentUser.id.slice(0, 6)}`;

          const { error: insertError } = await supabase.from('players').insert({
            user_id: currentUser.id,
            email: currentUser.email,
            username,
          });

          if (insertError) {
            console.error('Fehler beim automatischen Spieler-Insert:', insertError.message);
          }
        }
      }

      setProfileChecked(true);

      sub = supabase.auth.onAuthStateChange((_e, s) => {
        setUser(s?.user ?? null);
      }).data.subscription;
    };
    initAuth();
    return () => sub?.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <GroupProvider user={user}>
        <AppLayout>
          <Routes>
            {/* Login nur für nicht eingeloggte */}
            <Route
              path="/"
              element={
                <PublicOnly user={user} ready={profileChecked}>
                  <Login />
                </PublicOnly>
              }
            />

            {/* Gruppenübersicht nach Login */}
            <Route
              path="/groups"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <GroupOverview />
                </RequireAuth>
              }
            />
            <Route path="/groups/:groupId/settings" element={<GroupSettings />} />

            {/* Ab hier ist zusätzlich eine gewählte Gruppe Pflicht */}
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

            <Route
              path="/profile-settings"
              element={
                <RequireAuth user={user} ready={profileChecked}>
                  <ProfileSettings />
                </RequireAuth>
              }
            />

            {/* Einladung ggf. public lassen */}
            <Route path="/invite/:id" element={<InvitationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </GroupProvider>
    </BrowserRouter>
  );
}
