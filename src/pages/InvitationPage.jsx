import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function InvitationPage() {
  const { id } = useParams(); // Einladung-ID aus der URL
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchInvitation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/'); // nicht eingeloggt → zurück zur Startseite
        return;
      }

      const { data: invite, error } = await supabase
        .from('group_invitations')
        .select('*')
        .eq('id', id)
        .eq('email', user.email)
        .single();

      if (error || !invite) {
        setMessage('Einladung ungültig oder abgelaufen.');
        setLoading(false);
        return;
      }

      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', invite.group_id)
        .single();

      setInvitation(invite);
      setGroup(groupData);
      setLoading(false);
    };

    fetchInvitation();
  }, [id, navigate]);

  const handleResponse = async (accepted) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accepted) {
      // Füge zur Gruppe hinzu
      await supabase.from('group_members').insert({
        group_id: invitation.group_id,
        player_id: player.id,
        role: 'member'
      });
    }

    // Einladung aktualisieren
    await supabase.from('group_invitations')
      .update({ status: accepted ? 'accepted' : 'declined' })
      .eq('id', id);

    navigate('/groups');
  };

  if (loading) return <div className="p-6 text-white">Lade Einladung...</div>;
  if (message) return <div className="p-6 text-white">{message}</div>;

  return (
    <div className="p-6 text-white bg-gray-800 min-h-screen flex flex-col items-center justify-center">
      <div className="bg-gray-900 p-6 rounded max-w-lg w-full shadow">
        <h2 className="text-xl font-bold mb-4 text-center">Einladung zur Gruppe</h2>
        <p className="mb-4 text-center">Du wurdest zur Gruppe <strong>{group?.name}</strong> eingeladen.</p>
        <div className="flex gap-4 justify-center">
          <button
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            onClick={() => handleResponse(true)}
          >
            Beitreten
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            onClick={() => handleResponse(false)}
          >
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
