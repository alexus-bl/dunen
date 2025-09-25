// src/components/routing/guards.jsx
import { Navigate } from 'react-router-dom';
import { useGroup } from '../../context/GroupContext';

export function RequireAuth({ user, ready, children }) {
  if (!ready) return null;            // optional: Spinner
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export function PublicOnly({ user, ready, children }) {
  if (!ready) return null;
  if (user) return <Navigate to="/groups" replace />;
  return children;
}

export function RequireGroup({ children }) {
  const { groupId } = useGroup();
  if (!groupId) return <Navigate to="/groups" replace />;
  return children;
}
