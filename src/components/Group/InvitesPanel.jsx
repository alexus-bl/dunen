// components/Group/InvitesPanel.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';

export default function InvitesPanel() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();
  const { setGroupId } = useGroup();

  const fetchInvites = async () => {
    try {
      setLoading(true);

      // Eingeloggt?
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr || !user) throw new Error('Nicht angemeldet');

      // Player des Users
      const { data: player, error: perr } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (perr || !player) throw new Error('Spielerprofil nicht gefunden');

      // Einladungen für mich (Relation: groups(name))
      const { data, error } = await supabase
        .from('group_invitations')
        .select('id, group_id, invited_player_id, status, created_at, groups(name)')
        .eq('invited_player_id', player.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const normalized = (data || []).map(i => ({
        id: i.id,
        group_id: i.group_id,
        group_name: i.groups?.name || 'Unbekannte Gruppe',
        status: i.status,
        created_at: i.created_at,
      }));

      setInvites(normalized);
    } catch (e) {
      console.error('[Invites][fetchInvites] Fehler:', e);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const acceptInvite = async (invite) => {
    try {
      setBusyId(invite.id);

      // Player laden
      const { data: { user } } = await supabase.auth.getUser();
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Mitgliedschaft sicherstellen
      const { data: existing } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', invite.group_id)
        .eq('player_id', player.id)
        .maybeSingle();

      if (!existing) {
        const { error: memberErr } = await supabase
          .from('group_members')
          .insert({ group_id: invite.group_id, player_id: player.id, role: 'member' });
        if (memberErr) throw new Error(memberErr.message);
      }

      // Einladung updaten
      const { error: updErr } = await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
      if (updErr) throw new Error(updErr.message);

      // aktiv setzen & navigieren
      setGroupId(invite.group_id);
      try { localStorage.setItem('lastGroupId', invite.group_id); } catch {}
      navigate('/dashboard');
    } catch (e) {
      console.error('[Invites][acceptInvite] Fehler:', e);
      alert(e.message || 'Fehler beim Annehmen der Einladung.');
    } finally {
      setBusyId(null);
    }
  };

  const declineInvite = async (invite) => {
    try {
      setBusyId(invite.id);
      const { error } = await supabase
        .from('group_invitations')
        .update({ status: 'declined' })
        .eq('id', invite.id);
      if (error) throw new Error(error.message);
      await fetchInvites();
    } catch (e) {
      console.error('[Invites][declineInvite] Fehler:', e);
      alert(e.message || 'Fehler beim Ablehnen der Einladung.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-4 bg-gray-700 rounded text-white">Lade Einladungen…</div>;
  }
  if (!invites.length) {
    return <div className="p-4 bg-gray-700 rounded text-white">Keine offenen Einladungen.</div>;
  }

  return (
    <div className="p-6 bg-gray-700 rounded-lg text-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Offene Einladungen</h3>
        <button
          onClick={fetchInvites}
          className="text-sm px-3 py-1 rounded bg-gray-600 hover:bg-gray-500"
          title="Neu laden"
        >
          Aktualisieren
        </button>
      </div>

      <ul className="space-y-4">
        {invites.map(invite => (
          <li key={invite.id} className="p-4 bg-gray-800 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-bold">{invite.group_name}</div>
              <div className="text-sm text-gray-400">Status: {invite.status}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => acceptInvite(invite)}
                disabled={busyId === invite.id}
                className={`px-3 py-1 rounded text-white ${busyId === invite.id ? 'bg-green-700' : 'bg-green-500 hover:bg-green-600'}`}
              >
                {busyId === invite.id ? 'Bitte warten…' : 'Beitreten'}
              </button>
              <button
                onClick={() => declineInvite(invite)}
                disabled={busyId === invite.id}
                className={`px-3 py-1 rounded text-white ${busyId === invite.id ? 'bg-red-700' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {busyId === invite.id ? 'Bitte warten…' : 'Ablehnen'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
