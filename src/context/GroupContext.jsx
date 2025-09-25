// src/context/GroupContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const GroupContext = createContext(null);

export function GroupProvider({ user, children }) {
  const [groupId, setGroupId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Optional: beim Login zuletzt genutzte Gruppe laden
  useEffect(() => {
    const loadLastGroup = async () => {
      if (!user) { setGroupId(null); return; }
      setLoading(true);
      // Beispiel: aus localStorage – oder du liest eine "profiles.last_group_id" Spalte
      const last = localStorage.getItem('lastGroupId');
      if (last) setGroupId(last);
      setLoading(false);
    };
    loadLastGroup();
  }, [user]);

  // wenn Gruppe gewechselt: lokal merken
  useEffect(() => {
    if (groupId) localStorage.setItem('lastGroupId', groupId);
  }, [groupId]);

  return (
    <GroupContext.Provider value={{ groupId, setGroupId, loading }}>
      {children}
    </GroupContext.Provider>
  );
}
export function useGroup() { return useContext(GroupContext); }
