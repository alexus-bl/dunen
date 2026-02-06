// src/context/GroupContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const GroupContext = createContext(null);

export function GroupProvider({ user, children }) {
  // 1. Initialisierung aus dem Speicher
  const [groupId, setGroupIdState] = useState(() => {
    try {
      return localStorage.getItem('lastGroupId') || null;
    } catch {
      return null;
    }
  });

  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  // WICHTIG: Diese Funktion wird aufgerufen, wenn man in der Übersicht eine Gruppe anklickt
  const setGroupId = useCallback((id) => {
    if (id) {
      setLoading(true); // SOFORT auf true setzen, damit der Guard wartet!
      localStorage.setItem('lastGroupId', id);
    } else {
      localStorage.removeItem('lastGroupId');
      setLoading(false);
    }
    setGroupIdState(id);
  }, []);

  // Funktion zum Laden der echten Gruppendaten aus der DB
  const refreshGroupData = useCallback(async (idToFetch) => {
    if (!idToFetch || !user) {
      setActiveGroup(null);
      setLoading(false);
      return;
    }

    // Wir stellen sicher, dass loading aktiv ist
    setLoading(true); 
    
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', idToFetch)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setActiveGroup(data);
      } else {
        // Gruppe existiert nicht (mehr)
        setActiveGroup(null);
        setGroupIdState(null);
        localStorage.removeItem('lastGroupId');
      }
    } catch (err) {
      console.error('[GroupContext] Fehler beim Laden:', err.message);
      setActiveGroup(null);
    } finally {
      // Erst wenn die DB geantwortet hat, geben wir die App frei
      setLoading(false);
    }
  }, [user]);

  // Effekt: Wenn die ID sich ändert (durch Klick oder Initialisierung) -> Daten laden
  useEffect(() => {
    if (user && groupId) {
      refreshGroupData(groupId);
    } else if (user && !groupId) {
      // Wenn eingeloggt, aber keine Gruppe gewählt -> wir sind fertig mit "Laden"
      setLoading(false); 
    }
  }, [groupId, user, refreshGroupData]);

  const value = {
    groupId,
    setGroupId,
    activeGroup,
    refreshGroupData: () => refreshGroupData(groupId),
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
  if (!context) throw new Error('useGroup muss im Provider liegen');
  return context;
}