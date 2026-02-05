// components/Group/GroupSettings.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';
import {
  Settings2, ArrowLeft, Save, UserPlus, X, Shield, Trash2,
} from 'lucide-react';

export default function GroupSettings() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { setGroupId } = useGroup();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [myRole, setMyRole] = useState('member'); // 'owner' | 'admin' | 'member'
  const [group, setGroup] = useState({ id: groupId, name: '', layout_policy: 'member_custom', hide_member_winrate: false });
  const [members, setMembers] = useState([]); // [{id, username, email, role}]
  const [invites, setInvites] = useState([]); // [{id, created_at, player:{username,email}}]

  // Eingaben
  const [newName, setNewName] = useState('');
  const [layoutPolicy, setLayoutPolicy] = useState('member_custom');
  const [hideMemberWinrate, setHideMemberWinrate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const isOwnerOrAdmin = useMemo(() => ['owner', 'admin'].includes(myRole), [myRole]);

  useEffect(() => {
    setGroupId(groupId);
    try { localStorage.setItem('lastGroupId', groupId); } catch {}
  }, [groupId, setGroupId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // ich -> player
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/'); return; }
        const { data: me } = await supabase
          .from('players')
          .select('id, email, username')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!me) throw new Error('Kein Player gefunden');

        // Rolle in dieser Gruppe
        const { data: gm } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('player_id', me.id)
          .maybeSingle();

        const role = gm?.role || 'member';
        setMyRole(role);

        if (!['owner','admin'].includes(role)) {
          navigate('/groups'); // kein Zugriff
          return;
        }

        // Gruppe laden
     // Gruppe laden (Name + layout_policy + hide_member_winrate)
      let gRow = null;

      // Versuch mit beiden Spalten
      let resp = await supabase
        .from('groups')
        .select('id, name, layout_policy, hide_member_winrate')
        .eq('id', groupId)
        .maybeSingle();

      if (resp.error && String(resp.error.message || '').includes('hide_member_winrate')) {
        // Fallback ohne die Spalte
        const fallback = await supabase
          .from('groups')
          .select('id, name, layout_policy')
          .eq('id', groupId)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        gRow = { ...fallback.data, hide_member_winrate: false }; // Default
      } else if (resp.error) {
        throw resp.error;
      } else {
        gRow = resp.data;
      }

      setGroup(gRow || { id: groupId, name: '', layout_policy: 'member_custom', hide_member_winrate: false });
      setNewName(gRow?.name || '');
      setLayoutPolicy(gRow?.layout_policy || 'member_custom');
      setHideMemberWinrate(!!gRow?.hide_member_winrate);


        // Mitglieder
        const { data: gmRows, error: gmErr } = await supabase
          .from('group_members')
          .select('group_id, role, player_id, players:player_id (id, username, email)')
          .eq('group_id', groupId);
        if (gmErr) throw gmErr;

        const list = (gmRows || []).map(m => ({
          id: m.players?.id || m.player_id,
          username: m.players?.username || `#${m.player_id}`,
          email: m.players?.email || '',
          role: m.role || 'member',
        })).sort((a, b) => {
          const rank = r => (r === 'owner' ? 0 : r === 'admin' ? 1 : 2);
          const da = rank(a.role), db = rank(b.role);
          if (da !== db) return da - db;
          return (a.username || '').localeCompare(b.username || '');
        });
        setMembers(list);

        // Offene Einladungen (nur pending) inkl. invited player
        await loadInvites();

      } catch (e) {
        setErr(e.message || 'Laden fehlgeschlagen');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    async function loadInvites() {
      const { data, error } = await supabase
        .from('group_invitations')
        .select(`
          id, status, created_at, invited_player_id,
          players:invited_player_id ( id, username, email )
        `)
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[GroupSettings] loadInvites:', error.message);
        setInvites([]);
      } else {
        const rows = (data || []).map(r => ({
          id: r.id,
          created_at: r.created_at,
          player: { id: r.players?.id, username: r.players?.username, email: r.players?.email }
        }));
        setInvites(rows);
      }
    }

    // attach to instance
    GroupSettings._loadInvites = loadInvites;

    return () => { cancelled = true; };
  }, [groupId, navigate]);

  // --- Aktionen ---

  const saveName = async () => {
    try {
      const name = newName.trim();
      if (!name) return alert('Name darf nicht leer sein.');
      const { error } = await supabase.from('groups').update({ name }).eq('id', groupId);
      if (error) throw error;
      setGroup(prev => ({ ...prev, name }));
      alert('Name aktualisiert.');
    } catch (e) {
      console.error('[GroupSettings] rename failed:', e);
      alert('Gruppenname konnte nicht aktualisiert werden.');
    }
  };

  const savePolicy = async () => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ layout_policy: layoutPolicy, hide_member_winrate: hideMemberWinrate })
        .eq('id', groupId);
      if (error) throw error;
      setGroup(prev => ({ ...prev, layout_policy: layoutPolicy, hide_member_winrate: hideMemberWinrate }));
      alert('Richtlinie gespeichert.');
    } catch (e) {
      console.error('[GroupSettings] policy failed:', e);
      alert('Richtlinie konnte nicht gespeichert werden.');
    }
  };

  const updateMemberRole = async (playerId, newRole) => {
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
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === playerId ? { ...m, role: newRole } : m));
    } catch (e) {
      console.error('[GroupSettings] role change failed:', e);
      alert('Rollenänderung fehlgeschlagen.');
    }
  };

  const removeMember = async (playerId) => {
    try {
      if (!confirm('Mitglied wirklich aus dieser Gruppe entfernen?')) return;
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('player_id', playerId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== playerId));
    } catch (e) {
      console.error('[GroupSettings] remove member failed:', e);
      alert(e.message || 'Mitglied konnte nicht entfernt werden.');
    }
  };

  const sendInvitation = async () => {
    try {
      const email = inviteEmail.trim().toLowerCase();
      if (!email) return alert('Bitte E‑Mail eingeben.');
      const { data, error } = await supabase.rpc('invite_player_by_email', {
        p_group_id: groupId,
        p_email: email,
      });
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('NO_USER')) return alert('Kein registrierter Benutzer mit dieser E‑Mail.');
        if (msg.includes('ALREADY_MEMBER')) return alert('Dieser Benutzer ist bereits Mitglied.');
        if (msg.includes('ALREADY_INVITED')) return alert('Es existiert bereits eine offene Einladung.');
        if (msg.includes('NOT_ALLOWED')) return alert('Nur Owner/Admins dürfen einladen.');
        return alert('Einladung fehlgeschlagen.');
      }
      setInviteEmail('');
      await GroupSettings._loadInvites?.();
      alert('Einladung erstellt.');
    } catch (e) {
      console.error('[GroupSettings] invite failed:', e);
      alert('Einladung fehlgeschlagen.');
    }
  };

  const revokeInvite = async (inviteId) => {
    try {
      if (!confirm('Einladung wirklich widerrufen?')) return;
      const { error } = await supabase
        .from('group_invitations')
        .update({ status: 'revoked' })
        .eq('id', inviteId);
      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (e) {
      console.error('[GroupSettings] revoke failed:', e);
      alert('Einladung konnte nicht widerrufen werden.');
    }
  };

  const deleteGroup = async () => {
    try {
      if (myRole !== 'owner') return alert('Nur Owner dürfen Gruppen löschen.');
      if (!confirm(`Gruppe "${group.name}" wirklich löschen?`)) return;
      const { error } = await supabase.rpc('delete_group_cascade', { p_group_id: groupId });
      if (error) throw error;
      alert('Gruppe gelöscht.');
      navigate('/groups');
    } catch (e) {
      console.error('[GroupSettings] delete failed:', e);
      const msg = String(e.message || '');
      if (msg.includes('NOT_OWNER')) alert('Nur der Owner darf die Gruppe löschen.');
      else alert('Gruppe konnte nicht gelöscht werden.');
    }
  };

  // ----------------- Render -----------------
  return (
    <div className="p-6 bg-gray-800 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link to="/groups" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Zur Übersicht
          </Link>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-gray-300">
          <Settings2 className="w-4 h-4" /> Gruppen‑Einstellungen
        </div>
      </div>

      {loading ? (
        <div>lädt…</div>
      ) : err ? (
        <div className="text-red-300">{err}</div>
      ) : (
        <>
          {/* Kopf */}
          <div className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">Gruppe</div>
              <div className="text-xl font-semibold">{group.name || '–'}</div>
            </div>
            <div className="text-sm">
              Meine Rolle:{' '}
              <span className={`px-2 py-0.5 rounded-full ${myRole==='owner'?'bg-blue-100 text-blue-800': myRole==='admin'?'bg-purple-100 text-purple-800':'bg-gray-100 text-gray-700'}`}>
                {myRole}
              </span>
            </div>
          </div>

          {/* 1) Name ändern (mobil: Button unter dem Input) */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Gruppennamen ändern</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="p-2 rounded border w-full"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Neuer Gruppenname"
              />
              <button
                onClick={saveName}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                <Save className="w-4 h-4" /> Speichern
              </button>
            </div>
          </section>

          {/* 2) Dashboard‑Layout + Winrate-Toggle */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Dashboard‑Layout</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="layoutPolicy"
                  value="member_custom"
                  checked={layoutPolicy === 'member_custom'}
                  onChange={() => setLayoutPolicy('member_custom')}
                />
                Mitglieder dürfen ihr Dashboard selbst anpassen
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="layoutPolicy"
                  value="force_all"
                  checked={layoutPolicy === 'force_all'}
                  onChange={() => setLayoutPolicy('force_all')}
                />
                Layout vorgeben: <b>Alle Gruppenmitglieder</b> werden angezeigt
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="layoutPolicy"
                  value="force_self"
                  checked={layoutPolicy === 'force_self'}
                  onChange={() => setLayoutPolicy('force_self')}
                />
                Layout vorgeben: <b>Nur eigene Informationen</b> werden angezeigt
              </label>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideMemberWinrate}
                  onChange={(e) => setHideMemberWinrate(e.target.checked)}
                />
                Layout vorgeben: <b>Alle Winrate‑Informationen der Spieler ausblenden</b>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Blendet in Spieler‑Statistiken die Spalte „Winrate (%)“ sowie den „Winrate‑Verlauf“ aus.
                Die Winrate‑Angaben in der globalen Leaderliste (Top‑Leader der Gruppe) bleiben sichtbar.
              </p>
            </div>

            <button
              onClick={savePolicy}
              className="mt-3 inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
            >
              <Save className="w-4 h-4" /> Speichern
            </button>
          </section>

          {/* 3) Mitgliederverwaltung */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Mitglieder</h3>
            <ul className="divide-y">
              {members.map(m => (
                <li key={m.id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.username}</div>
                    <div className="text-xs text-gray-500 truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === 'owner' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                        <Shield className="w-3 h-3" /> owner
                      </span>
                    ) : (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.id, e.target.value)}
                          className="text-xs bg-gray-100 rounded px-2 py-1"
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          onClick={() => removeMember(m.id)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
                          title="Mitglied entfernen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
              {members.length === 0 && (
                <li className="py-2 text-sm text-gray-500 italic">Keine Mitglieder</li>
              )}
            </ul>
          </section>

          {/* 4) Mitglieder einladen */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Registrierten Benutzer einladen</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                className="p-2 rounded border w-full"
                placeholder="name@domain.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <button
                onClick={sendInvitation}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4" /> Einladen
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Es werden nur bereits registrierte Benutzer gefunden. Keine E‑Mail – die Einladung erscheint in der Einladungs‑Kachel.
            </p>
          </section>

          {/* 5) Offene Einladungen (Admin-Ansicht) */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Offene Einladungen</h3>
            {invites.length === 0 ? (
              <div className="text-sm text-gray-500">Keine offenen Einladungen.</div>
            ) : (
              <ul className="divide-y">
                {invites.map(inv => (
                  <li key={inv.id} className="py-2 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{inv.player?.username ?? '(unbekannt)'}</div>
                      <div className="text-xs text-gray-500 truncate">{inv.player?.email ?? ''}</div>
                    </div>
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="bg-gray-900 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Widerrufen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Ein Nutzer kann pro Gruppe nur eine <b>pending</b>-Einladung haben (Server enforced).
            </p>
          </section>

          {/* 6) Danger Zone */}
          <section className="mb-6 bg-white text-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3 text-red-600">Gefahrenzone</h3>
            <button
              onClick={deleteGroup}
              disabled={myRole !== 'owner'}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Gruppe löschen (nur Owner)
            </button>
          </section>
        </>
      )}
    </div>
  );
}
