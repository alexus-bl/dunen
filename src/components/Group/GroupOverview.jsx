import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function GroupOverview() {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .contains('members', [user.id]); // Annahme: Spalte "members" enthält User-IDs (Array)

    if (!error) setGroups(data);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const createGroup = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('groups').insert({ name: newGroupName, members: [user.id] });
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
          className="p-2 rounded w-full my-2 text-gray-800"
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
