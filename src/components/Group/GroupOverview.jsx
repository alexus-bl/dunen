// components/Group/GroupOverview.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';
import InvitesPanel from './InvitesPanel';
import { Trash2, X } from 'lucide-react';

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setGroupId } = useGroup();

  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [emailInputs, setEmailInputs] = useState({});
  const [loading, setLoading] = useState(true);


  // -------- Helpers: User & Player laden --------
  const getUserAndPlayer = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error(userError?.message || 'Kein User');
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (playerError || !player) throw new Error(playerError?.message || 'Kein Player');
    return { user, player };
  };

  // -------- Gruppen + eigene Rolle + Mitglieder laden --------
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { player } = await getUserAndPlayer();

      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('player_id', player.id);
      if (memberError) throw new Error(memberError.message);

      const groupIds = (memberships || []).map(m => m.group_id);
      if (groupIds.length === 0) {
        setGroups([]);
        return;
      }

      const { data: groupList, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);
      if (groupError) throw new Error(groupError.message);

      const { data: allMembers, error: gmErr } = await supabase
        .from('group_members')
        .select('group_id, role, player_id, players:player_id (id, username, email)')
        .in('group_id', groupIds);
      if (gmErr) throw new Error(gmErr.message);

      const myRoleByGroup = new Map((memberships || []).map(m => [m.group_id, m.role]));
      const membersByGroup = new Map();
      (allMembers || []).forEach(m => {
        const list = membersByGroup.get(m.group_id) || [];
        list.push({
          id: m.players?.id || m.player_id,
          username: m.players?.username || '—',
          email: m.players?.email || '—',
          role: m.role || 'member',
        });
        membersByGroup.set(m.group_id, list);
      });

      const enriched = (groupList || []).map(g => ({
        id: g.id,
        name: g.name,
        role: myRoleByGroup.get(g.id) || 'member',
        members: (membersByGroup.get(g.id) || []).sort((a, b) => {
          const r = x => (x === 'owner' || x === 'admin' ? 0 : 1);
          const ra = r(a.role), rb = r(b.role);
          if (ra !== rb) return ra - rb;
          return (a.username || '').localeCompare(b.username || '');
        }),
      }));

      enriched.sort((a, b) => {
        const r = x => (x === 'owner' || x === 'admin' ? 0 : 1);
        const ar = r(a.role), br = r(b.role);
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name);
      });

      setGroups(enriched);
    } catch (e) {
      console.error('Fehler beim Laden der Gruppen:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // -------- Gruppe auswählen → Kontext setzen → Dashboard --------
  const onSelectGroup = (group) => {
    setGroupId(group.id);
    try { localStorage.setItem('lastGroupId', group.id); } catch {}
    navigate('/dashboard');
  };

  // -------- Neue Gruppe erstellen --------
  const createGroup = async () => {
    try {
      const name = newGroupName.trim();
      if (!name) return;
  
      const { data: gid, error } = await supabase.rpc('create_group_and_membership', { p_name: name });
      console.log('[createGroup][rpc] gid=', gid, 'error=', error);
      if (error) throw error;
  
      setNewGroupName('');
      await fetchGroups();
    } catch (e) {
      console.error('[createGroup] FAILED:', e);
      alert(e.message || 'Gruppe konnte nicht erstellt werden.');
    }
  };
    
  
  // -------- Einladungen (in-app) mit Prüfungen --------
  const handleEmailInputChange = (groupId, value) => {
    setEmailInputs(prev => ({ ...prev, [groupId]: value }));
  };

  const sendInvitation = async (groupId) => {
    try {
      const email = (emailInputs[groupId] || '').trim().toLowerCase();
      if (!email) { alert('Bitte E-Mail eingeben.'); return; }
  
      const { data: invId, error } = await supabase.rpc('invite_player_by_email', {
        p_group_id: groupId,
        p_email: email,
      });
      console.log('[Invite][rpc] invId=', invId, 'error=', error);
  
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('NO_USER')) return alert('Kein registrierter Benutzer mit dieser E-Mail.');
        if (msg.includes('ALREADY_MEMBER')) return alert('Dieser Benutzer ist bereits Mitglied der Gruppe.');
        if (msg.includes('ALREADY_INVITED')) return alert('Es existiert bereits eine offene Einladung.');
        if (msg.includes('NOT_ALLOWED')) return alert('Nur Owner/Admins dürfen einladen.');
        return alert('Einladung fehlgeschlagen: ' + msg);
      }
  
      alert('Einladung erstellt.');
      setEmailInputs(prev => ({ ...prev, [groupId]: '' }));
    } catch (e) {
      console.error('[Invite][rpc] FAILED:', e);
      alert(e.message || 'Einladung fehlgeschlagen.');
    }
  };
  
  
  

  // -------- Rollen ändern / Mitglied entfernen (nur Admin/Owner) --------
  const updateMemberRole = async (groupId, playerId, newRole) => {
    try {
           if (newRole === 'owner') {
               alert('Die Owner-Rolle kann nicht vergeben werden.');
               return;
             }
      const { error } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('group_id', groupId)
        .eq('player_id', playerId);
      if (error) throw new Error(error.message);
      await fetchGroups();
    } catch (e) {
      console.error('Rollenänderung fehlgeschlagen:', e.message);
      alert('Rollenänderung fehlgeschlagen.');
    }
  };

  const deleteGroup = async (group) => {
    try {
      const ok = window.confirm(`Gruppe "${group.name}" und alle Verknüpfungen wirklich löschen?`);
      if (!ok) return;
  
      // Variante A: Wenn DB-FKs ON DELETE CASCADE gesetzt sind:
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', group.id);
      if (error) throw new Error(error.message);
  
      // Variante B (Fallback ohne CASCADE): Abhängigkeiten zuerst löschen
      // await supabase.from('group_members').delete().eq('group_id', group.id);
      // await supabase.from('group_invitations').delete().eq('group_id', group.id);
      // ... ggf. weitere Tabellen (matches, etc.)
      // await supabase.from('groups').delete().eq('id', group.id);
  
      await fetchGroups();
    } catch (e) {
      console.error('Gruppen-Löschung fehlgeschlagen:', e.message);
      alert('Gruppe konnte nicht gelöscht werden.');
    }
  };
  

  const removeMember = async (groupId, playerId) => {
    try {
      const confirm = window.confirm('Mitglied wirklich aus dieser Gruppe entfernen?');
      if (!confirm) return;

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('player_id', playerId);
      if (error) throw new Error(error.message);
      await fetchGroups();
    } catch (e) {
      console.error('Entfernen fehlgeschlagen:', e.message);
      alert('Mitglied konnte nicht entfernt werden.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-800 min-h-screen text-white">

        <h2 className="text-2xl font-bold mb-4">Meine Gruppen</h2>
        <div className="opacity-80">Lade…</div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-gray-800 min-h-screen text-white">
      <InvitesPanel />
      <h2 className="text-2xl font-bold mb-4">Meine Gruppen</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {groups.map(group => (
          <div
            key={group.id}
            className="transform hover:scale-105 transition duration-300 shadow-xl rounded-lg bg-white text-gray-800 p-5"
          >
            <div className="flex justify-between items-start">
              <button
                className="text-left"
                onClick={() => onSelectGroup(group)}
                title="Diese Gruppe öffnen"
              >
                <div className="ml-2">
                  <div className="mt-1 text-2xl font-bold leading-8 text-gray-700">{group.name}</div>
                  <div className="text-sm text-gray-500">Meine Rolle: <span className="font-semibold">{group.role}</span></div>
                </div>
              </button>

              

              {group.role === 'owner' && (
                <button
                  onClick={async (e) => { e.stopPropagation(); await deleteGroup(group); }}
                  className="ml-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full flex items-center justify-center"
                  title="Gruppe löschen"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Mitgliederliste */}
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-1">Mitglieder</div>
              <ul className="space-y-2">
  {group.members.map(m => (
    <li
      key={m.id}
      className="text-sm text-gray-700 flex items-center justify-between gap-2"
    >
      <div className="truncate font-medium flex items-center gap-2">
        {m.username || m.id}
        {m.role === 'owner' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
            owner
          </span>
        )}
      </div>

      {(group.role === 'admin' || group.role === 'owner') ? (
        <div className="flex items-center gap-2">
          {m.role !== 'owner' && (
            <select
              value={m.role}
              onChange={(e) =>
                updateMemberRole(group.id, m.id, e.target.value)
              }
              className="text-xs bg-gray-100 rounded px-2 py-1"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          )}

          {m.role !== 'owner' && (
            <button
              onClick={() => removeMember(group.id, m.id)}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full flex items-center justify-center"
              title="Mitglied entfernen"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
          {m.role}
        </span>
      )}
    </li>
  ))}
  {group.members.length === 0 && (
    <li className="text-sm text-gray-500 italic">Keine Mitglieder</li>
  )}
</ul>
            </div>

            {/* Einladung (nur Admin/Owner) */}
            {(group.role === 'admin' || group.role === 'owner') && (
              <div className="mt-4">
                <label className="text-sm text-gray-700">Registrierten Benutzer per E-Mail hinzufügen</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="email"
                    className="p-2 rounded w-full bg-gray-100 text-gray-800"
                    placeholder="name@domain.com"
                    value={emailInputs[group.id] || ''}
                    onChange={(e) => handleEmailInputChange(group.id, e.target.value)}
                  />
                  <button
                    onClick={() => sendInvitation(group.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded"
                  >
                    Einladen
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Hinweis: Es werden nur bereits registrierte Benutzer gefunden. Keine E-Mail wird verschickt. Neue Mitglieder werden als <b>member</b> hinzugefügt.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Neue Gruppe erstellen */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold">Neue Gruppe erstellen</h3>
        <input
          className="p-2 rounded w-full my-2 text-white bg-gray-700"
          placeholder="Name der Gruppe"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
        />
        <button
          onClick={createGroup}
          className="bg-green-500 hover:bg-green-600 p-2 rounded w-full"
        >
          Gruppe erstellen
        </button>
      </div>
    </div>
  );
}