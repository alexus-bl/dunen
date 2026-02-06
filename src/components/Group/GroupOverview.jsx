// src/components/Group/GroupOverview.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';
import InvitesPanel from './InvitesPanel';
import { Settings2, Loader2 } from 'lucide-react';

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setGroupId } = useGroup();
  
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const getUserAndPlayer = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kein User eingeloggt');
    
    const { data: player } = await supabase
      .from('players')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (!player) throw new Error('Kein Spielerprofil gefunden');
    return { user, player };
  };

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const { player } = await getUserAndPlayer();

      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('player_id', player.id);
      
      if (memberError) throw memberError;

      const groupIds = (memberships || []).map(m => m.group_id);
      if (groupIds.length === 0) {
        setGroups([]);
        return;
      }

      const [groupsRes, allMembersRes] = await Promise.all([
        supabase.from('groups').select('id, name').in('id', groupIds),
        supabase.from('group_members')
          .select('group_id, role, player_id, players:player_id (id, username, email)')
          .in('group_id', groupIds)
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (allMembersRes.error) throw allMembersRes.error;

      const myRoleByGroup = new Map(memberships.map(m => [m.group_id, m.role]));
      const membersByGroup = new Map();
      
      (allMembersRes.data || []).forEach(m => {
        const list = membersByGroup.get(m.group_id) || [];
        list.push({
          id: m.players?.id || m.player_id,
          username: m.players?.username || '—',
          role: m.role || 'member',
        });
        membersByGroup.set(m.group_id, list);
      });

      const enriched = groupsRes.data.map(g => ({
        id: g.id,
        name: g.name,
        role: myRoleByGroup.get(g.id) || 'member',
        members: (membersByGroup.get(g.id) || []).sort((a, b) => {
          const rank = x => (x === 'owner' ? 0 : x === 'admin' ? 1 : 2);
          return rank(a.role) - rank(b.role) || a.username.localeCompare(b.username);
        }),
      })).sort((a, b) => a.name.localeCompare(b.name));

      setGroups(enriched);
    } catch (e) {
      console.error('Fehler beim Laden der Gruppen:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const onSelectGroup = (group) => {
    setGroupId(group.id);
    setTimeout(() => {
      navigate('/dashboard');
    }, 10);
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name || isCreating) return;
    
    try {
      setIsCreating(true);
      const { data: gid, error } = await supabase.rpc('create_group_and_membership', { p_name: name });
      if (error) throw error;
      
      setNewGroupName('');
      await fetchGroups();
      
      if (gid) {
        setGroupId(gid);
        navigate('/dashboard');
      }
    } catch (e) {
      alert(e.message || 'Gruppe konnte nicht erstellt werden.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-800 min-h-screen text-white">
      <InvitesPanel />
      
      <div className="flex items-center justify-between mb-6 mt-4">
        <h2 className="text-2xl font-bold">Meine Gruppen</h2>
        {loading && <Loader2 className="animate-spin text-gray-400" />}
      </div>

      {loading && groups.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Lade Gruppenübersicht...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div 
              key={group.id} 
              className="group transform hover:translate-y-[-4px] transition-all duration-300 shadow-xl rounded-2xl bg-white text-gray-800 p-5 flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <button 
                  className="text-left flex-1" 
                  onClick={() => onSelectGroup(group)}
                >
                  <div className="text-2xl font-black text-gray-800 group-hover:text-blue-600 transition-colors">
                    {group.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
                    Deine Rolle: <span className="text-blue-500">{group.role}</span>
                  </div>
                </button>

                {(group.role === 'owner' || group.role === 'admin') && (
                  <Link
                    to={`/groups/${group.id}/settings`}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg transition-colors"
                  >
                    <Settings2 size={18} />
                  </Link>
                )}
              </div>

              <div className="mt-2 pt-4 border-t border-gray-100 flex-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-tight">Mitglieder</div>
                <ul className="space-y-1">
                  {group.members.map(m => (
                    <li key={m.id} className="text-xs flex items-center justify-between">
                      <span className="truncate font-medium text-gray-600">{m.username}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 
                        m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {m.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <button 
                onClick={() => onSelectGroup(group)}
                className="mt-6 w-full py-2 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-700 transition-colors"
              >
                Dashboard öffnen
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 max-w-md mx-auto sm:mx-0">
        <h3 className="text-lg font-bold mb-3">Neue Spielgruppe gründen</h3>
        <div className="flex flex-col gap-2">
          <input
            className="p-3 rounded-xl w-full text-white bg-gray-700 border border-gray-600 focus:border-blue-500 outline-none transition-all"
            placeholder="Name deiner neuen Gruppe..."
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
          />
          <button 
            onClick={createGroup} 
            disabled={isCreating || !newGroupName.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            {isCreating && <Loader2 className="animate-spin" size={18} />}
            Gruppe erstellen
          </button>
        </div>
      </div>
    </div>
  );
}