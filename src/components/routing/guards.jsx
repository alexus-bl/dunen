// src/components/routing/guards.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useGroup } from '../../context/GroupContext';

export function RequireAuth({ user, ready, children }) {
  if (!ready) return null; 
  if (!user) return <Navigate to="/" replace />;
  return children ? children : <Outlet />;
}

export function PublicOnly({ user, ready, children }) {
  if (!ready) return null;
  if (user) return <Navigate to="/groups" replace />;
  return children ? children : <Outlet />;
}


export function RequireGroup({ children }) {
  const { groupId, loading } = useGroup();

  // WICHTIG: Wenn der Context noch lädt (Daten aus DB/Storage holt), 
  // geben wir einfach null zurück (oder einen Spinner). 
  // Wir navigieren NICHT weg!
  if (loading) return null; 

  // Erst wenn loading false ist und WIRKLICH keine ID da ist:
  if (!groupId) {
    return <Navigate to="/groups" replace />;
  }

  return children ? children : <Outlet />;
}

