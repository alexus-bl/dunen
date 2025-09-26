// components/Group/GroupOverview.jsx (gestraffte Version)
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';
import InvitesPanel from './InvitesPanel';
import { Settings2 } from 'lucide-react';

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setGroupId } = useGroup();
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  const getUserAndPlayer = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error(userError?.message || 'Kein User');
    const { data: player, error: playerError } = await supabase
      .from('players').select('id, email').eq('user_id', user.id).maybeSingle();
    if (playerError || !player) throw new Error(playerError?.message || 'Kein Player');
    return { user, player };
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { player } = await getUserAndPlayer();

      const { data: memberships, error: memberError } = await supabase
        .from('group_members').select('group_id, role').eq('player_id', player.id);
      if (memberError) throw new Error(memberError.message);

      const groupIds = (memberships || []).map(m => m.group_id);
      if (groupIds.length === 0) { setGroups([]); return; }

      const { data: groupList, error: groupError } = await supabase
        .from('groups').select('id, name').in('id', groupIds);
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

  useEffect(() => { fetchGroups(); }, []);

  const onSelectGroup = (group) => {
    setGroupId(group.id);
    try { localStorage.setItem('lastGroupId', group.id); } catch {}
    navigate('/dashboard');
  };

  const createGroup = async () => {
    try {
      const name = newGroupName.trim();
      if (!name) return;
      const { data: gid, error } = await supabase.rpc('create_group_and_membership', { p_name: name });
      if (error) throw error;
      setNewGroupName('');
      await fetchGroups();
    } catch (e) {
      console.error('[createGroup] FAILED:', e);
      alert(e.message || 'Gruppe konnte nicht erstellt werden.');
    }
  };

  return (
    <div className="p-6 bg-gray-800 min-h-screen text-white">
      <InvitesPanel />
      <h2 className="text-2xl font-bold mb-4">Meine Gruppen</h2>

      {loading ? (
        <div>lädt…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {groups.map(group => (
            <div key={group.id} className="transform hover:scale-105 transition duration-300 shadow-xl rounded-lg bg-white text-gray-800 p-5">
              <div className="flex justify-between items-start">
                <button className="text-left" onClick={() => onSelectGroup(group)} title="Diese Gruppe öffnen">
                  <div className="ml-2">
                    <div className="mt-1 text-2xl font-bold leading-8 text-gray-700">{group.name}</div>
                    <div className="text-sm text-gray-500">Meine Rolle: <span className="font-semibold">{group.role}</span></div>
                  </div>
                </button>

                {(group.role === 'owner' || group.role === 'admin') && (
                  <Link
                    to={`/groups/${group.id}/settings`}
                    className="bg-gray-900 hover:bg-gray-700 text-white px-2 py-1 rounded"
                    title="Einstellungen"
                  >
                    <Settings2 size={16} />
                  </Link>
                )}
              </div>

              {/* Nur Leseliste der Mitglieder */}
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-1">Mitglieder</div>
                <ul className="space-y-1">
                  {group.members.map(m => (
                    <li key={m.id} className="text-sm text-gray-700 flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{m.username}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.role==='owner' ? 'bg-blue-100 text-blue-800' : m.role==='admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
                        {m.role}
                      </span>
                    </li>
                  ))}
                  {group.members.length === 0 && (
                    <li className="text-sm text-gray-500 italic">Keine Mitglieder</li>
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Neue Gruppe */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold">Neue Gruppe erstellen</h3>
        <input
          className="p-2 rounded w-full my-2 text-white bg-gray-700"
          placeholder="Name der Gruppe"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
        />
        <button onClick={createGroup} className="bg-green-500 hover:bg-green-600 p-2 rounded w-full">
          Gruppe erstellen
        </button>
      </div>
    </div>
  );
}
