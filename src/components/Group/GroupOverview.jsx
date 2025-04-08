import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function GroupOverview() {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchGroups = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Fehler beim Abrufen des Benutzers:', userError?.message);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (playerError || !player) {
      console.error('Spielerprofil nicht gefunden oder Fehler:', playerError?.message);
      return;
    }

    const { data: memberships, error: memberError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('player_id', player.id);

    if (memberError) {
      console.error('Fehler beim Laden der Mitgliedschaften:', memberError.message);
      return;
    }

    const groupIds = memberships?.map(m => m.group_id) || [];

    const { data: groupList, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', groupIds);

    if (groupError) {
      console.error('Fehler beim Laden der Gruppen:', groupError.message);
      return;
    }

    setGroups(groupList);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const createGroup = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Benutzer nicht gefunden:', userError?.message);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (playerError || !player) {
      console.error('Spielerprofil nicht gefunden oder Fehler:', playerError?.message);
      return;
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: newGroupName, created_by: user.id })   
      .select()
      .single();

    if (groupError || !group) {
      console.error('Fehler beim Erstellen der Gruppe:', groupError?.message);
      return;
    }

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      player_id: player.id,
      role: 'admin'
    });

    if (memberError) {
      console.error('Fehler beim Hinzufügen als Admin:', memberError.message);
      return;
    }

    setNewGroupName('');
    fetchGroups();
  };

  return (
    <div className="p-6 bg-gray-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-4">Meine Gruppen</h2>

      <ul>
        {groups.map(group => (
          <li key={group.id} className="mb-2">
            {group.name}
          </li>
        ))}
      </ul>

      <div className="mt-8">
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
