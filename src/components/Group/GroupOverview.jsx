import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function GroupOverview() {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [emailInputs, setEmailInputs] = useState({});

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

  const handleEmailInputChange = (groupId, value) => {
    setEmailInputs(prev => ({ ...prev, [groupId]: value }));
  };

  const sendInvitation = async (groupId) => {
    const email = emailInputs[groupId];
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('group_invitations').insert({
      group_id: groupId,
      email,
      invited_by: user.id,
      status: 'pending'
    });

    if (error) {
      console.error('Einladung fehlgeschlagen:', error.message);
      return;
    }

    alert(`Einladung an ${email} verschickt.`);
    setEmailInputs(prev => ({ ...prev, [groupId]: '' }));
  };

  return (
    <div className="p-6 bg-gray-800 min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-4">Meine Gruppen</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {groups.map(group => (
          <a
            key={group.id}
            href="#"
            className="transform hover:scale-105 transition duration-300 shadow-xl rounded-lg bg-white text-gray-800 p-5"
          >
            <div className="flex justify-between">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <div className="bg-blue-500 rounded-full h-6 px-2 flex items-center text-white font-semibold text-sm">
                <span>Admin</span>
              </div>
            </div>
            <div className="ml-2 w-full flex-1">
              <div className="mt-3 text-2xl font-bold leading-8 text-gray-600">{group.name}</div>
              <div className="mt-1 text-sm text-gray-600">Gruppe</div>
            </div>
            <div className="mt-4">
              <label className="text-sm text-gray-700">Mitglied per E-Mail einladen</label>
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
            </div>
          </a>
        ))}
      </div>

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
