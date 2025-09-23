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
import { supabase } from './supabaseClient';
import ProfileSettings from './components/Profile/ProfileSettings';
import InvitationPage from './pages/InvitationPage';

// ---------- Route Guards ----------
function RequireAuth({ user, ready, children }) {
  if (!ready) return null; // oder Loading-Spinner
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ user, ready, children }) {
  if (!ready) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

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
    let subscription;

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

      // 3) Auth-Änderungen (Login/Logout/OAuth-Callback) beobachten
      subscription = supabase.auth.onAuthStateChange((_event, newSession) => {
        setUser(newSession?.user ?? null);
      }).data.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Login (nur für nicht eingeloggte Nutzer) */}
          <Route
            path="/"
            element={
              <PublicOnly user={user} ready={profileChecked}>
                <Login />
              </PublicOnly>
            }
          />

          {/* Einladungsseite – ggf. public (Token-basiert) */}
          <Route path="/invite/:id" element={<InvitationPage />} />

          {/* Geschützte Routen */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/groups"
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <GroupOverview />
              </RequireAuth>
            }
          />
          <Route
            path="/add-match"
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <AddMatch />
              </RequireAuth>
            }
          />
          <Route
            path="/matches"
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <Matches />
              </RequireAuth>
            }
          />
          <Route
            path="/edit-match/:matchId"
            element={
              <RequireAuth user={user} ready={profileChecked}>
                <EditMatch />
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
