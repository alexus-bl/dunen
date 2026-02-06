// src/context/GroupContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const GroupContext = createContext(null);

export function GroupProvider({ user, children }) {
  // Wir initialisieren die ID sofort aus dem localStorage, um Redirect-Glitches zu vermeiden
  const [groupId, setGroupId] = useState(() => localStorage.getItem('lastGroupId'));
  const [activeGroup, setActiveGroup] = useState(null); // Speichert Name, Policy, etc.
  const [loading, setLoading] = useState(false);

  // Funktion zum Laden/Aktualisieren der Gruppendaten (Policy, Name etc.)
  const refreshGroupData = useCallback(async (idToFetch = groupId) => {
    if (!idToFetch || !user) {
      setActiveGroup(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', idToFetch)
        .maybeSingle();

      if (error) throw error;
      setActiveGroup(data);
    } catch (err) {
      console.error('[GroupContext] Fehler beim Laden der Gruppendaten:', err.message);
    }
  }, [groupId, user]);

  // Effekt 1: Wenn sich die groupId ändert, Daten laden und im localStorage speichern
  useEffect(() => {
    if (groupId) {
      localStorage.setItem('lastGroupId', groupId);
      setLoading(true);
      refreshGroupData(groupId).finally(() => setLoading(false));
    } else {
      localStorage.removeItem('lastGroupId');
      setActiveGroup(null);
    }
  }, [groupId, refreshGroupData]);

  // Effekt 2: Wenn der User ausloggt, alles zurücksetzen
  useEffect(() => {
    if (!user) {
      setGroupId(null);
      setActiveGroup(null);
      localStorage.removeItem('lastGroupId');
    }
  }, [user]);

  // Der Value enthält nun alles, was die App braucht
  const value = {
    groupId,
    setGroupId,
    activeGroup,      // Hier steckt die layout_policy drin!
    refreshGroupData, // Erlaubt GroupSettings, ein Update zu erzwingen
    loading
  };

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup muss innerhalb eines GroupProviders verwendet werden');
  }
  return context;
}