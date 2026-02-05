import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useGroup } from '../../context/GroupContext';
import {
  Settings2, ArrowLeft, Save, UserPlus, X, Shield, Trash2, Loader2
} from 'lucide-react';

export default function GroupSettings() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  // WICHTIG: Wir brauchen refreshGroupData vom Context, 
  // um nach dem Speichern die App-weiten Daten zu aktualisieren.
  const { setGroupId, refreshGroupData } = useGroup();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [myRole, setMyRole] = useState('member');
  const [group, setGroup] = useState({ id: groupId, name: '', layout_policy: 'member_custom', hide_member_winrate: false });
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);

  // Form States
  const [newName, setNewName] = useState('');
  const [layoutPolicy, setLayoutPolicy] = useState('member_custom');
  const [hideMemberWinrate, setHideMemberWinrate] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // 1. Daten laden (memoisierte Funktion)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data: me } = await supabase.from('players').select('id').eq('user_id', user.id).maybeSingle();
      if (!me) throw new Error('Kein Player-Profil gefunden.');

      // Rolle & Gruppe parallel laden
      const [roleRes, groupRes] = await Promise.all([
        supabase.from('group_members').select('role').eq('group_id', groupId).eq('player_id', me.id).maybeSingle(),
        supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
      ]);

      if (roleRes.data) setMyRole(roleRes.data.role);
      
      if (!['owner', 'admin'].includes(roleRes.data?.role)) {
        navigate('/dashboard'); 
        return;
      }

      if (groupRes.data) {
        setGroup(groupRes.data);
        setNewName(groupRes.data.name || '');
        setLayoutPolicy(groupRes.data.layout_policy || 'member_custom');
        setHideMemberWinrate(!!groupRes.data.hide_member_winrate);
      }

      // Mitglieder laden
      const { data: gmRows } = await supabase
        .from('group_members')
        .select('role, player_id, players:player_id (id, username, email)')
        .eq('group_id', groupId);

      const mappedMembers = (gmRows || []).map(m => ({
        id: m.players?.id || m.player_id,
        username: m.players?.username || 'Unbekannt',
        email: m.players?.email || '',
        role: m.role || 'member',
      })).sort((a, b) => {
        const ranks = { owner: 0, admin: 1, member: 2 };
        return ranks[a.role] - ranks[b.role] || a.username.localeCompare(b.username);
      });
      
      setMembers(mappedMembers);
      await loadInvites();

    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate]);

  const loadInvites = async () => {
    const { data } = await supabase
      .from('group_invitations')
      .select('id, created_at, players:invited_player_id ( id, username, email )')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    setInvites(data?.map(r => ({ id: r.id, created_at: r.created_at, player: r.players })) || []);
  };

  useEffect(() => {
    setGroupId(groupId);
    loadData();
  }, [groupId, setGroupId, loadData]);

  // 2. Speicher-Funktionen
  const handleSavePolicy = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ 
          layout_policy: layoutPolicy, 
          hide_member_winrate: hideMemberWinrate 
        })
        .eq('id', groupId);

      if (error) throw error;

      // WICHTIGSTER TEIL FÜR DEN BUG-FIX:
      // Wir sagen dem Context, dass er die Gruppendaten neu laden muss.
      if (refreshGroupData) {
        await refreshGroupData();
      }

      alert('Einstellungen erfolgreich gespeichert. Das Dashboard wird für alle Mitglieder angepasst.');
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (playerId, newRole) => {
    const { error } = await supabase
      .from('group_members')
      .update({ role: newRole })
      .eq('group_id', groupId)
      .eq('player_id', playerId);
    if (!error) setMembers(prev => prev.map(m => m.id === playerId ? { ...m, role: newRole } : m));
  };

  if (loading) return <div className="p-10 text-center text-white"><Loader2 className="animate-spin inline mr-2"/> Lade Einstellungen...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link to="/groups" className="text-gray-400 hover:text-white flex items-center gap-2 mb-2 transition-colors">
            <ArrowLeft size={18} /> Zurück
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="text-blue-400" /> Gruppeneinstellungen
          </h1>
        </div>
        <div className="bg-gray-700/50 border border-gray-600 px-4 py-2 rounded-lg">
          <span className="text-sm text-gray-400">Deine Rolle:</span>
          <span className="ml-2 font-mono text-blue-400 uppercase tracking-wider">{myRole}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Sektion: Allgemein */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">Allgemein</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Gruppenname</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={() => {/* saveName logic */}} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors">
                  <Save size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sektion: Dashboard-Berechtigungen (DER BUG-FIX BEREICH) */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-blue-400">Dashboard & Sichtbarkeit</h2>
          <div className="space-y-6">
            <div className="grid gap-3">
              {[
                { id: 'member_custom', label: 'Mitglieder dürfen ihr Dashboard selbst anpassen' },
                { id: 'force_all', label: 'Layout vorgeben: Alle Mitglieder anzeigen' },
                { id: 'force_self', label: 'Layout vorgeben: Nur eigene Informationen anzeigen' }
              ].map(opt => (
                <label key={opt.id} className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${layoutPolicy === opt.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800'}
                `}>
                  <input 
                    type="radio" 
                    className="w-4 h-4 text-blue-600"
                    checked={layoutPolicy === opt.id}
                    onChange={() => setLayoutPolicy(opt.id)}
                  />
                  <span className="text-sm sm:text-base">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-700">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-1">
                  <input 
                    type="checkbox" 
                    checked={hideMemberWinrate} 
                    onChange={e => setHideMemberWinrate(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-700"
                  />
                </div>
                <div>
                  <span className="block font-medium group-hover:text-blue-300 transition-colors">Winrate-Informationen global ausblenden</span>
                  <span className="block text-xs text-gray-400">Blendet Winrate-Graphen und Prozente in den Profilen aus. Leaderboard bleibt aktiv.</span>
                </div>
              </label>
            </div>

            <button 
              onClick={handleSavePolicy}
              disabled={isSaving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
              Richtlinien für alle Mitglieder speichern
            </button>
          </div>
        </div>

        {/* Sektion: Mitglieder (vereinfacht) */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Mitgliederverwaltung ({members.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-gray-700">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Rolle</th>
                  <th className="pb-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {members.map(m => (
                  <tr key={m.id} className="group">
                    <td className="py-3">
                      <div className="font-medium">{m.username}</div>
                      <div className="text-xs text-gray-500">{m.email}</div>
                    </td>
                    <td className="py-3">
                      {m.role === 'owner' ? (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">Owner</span>
                      ) : (
                        <select 
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                          className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {m.role !== 'owner' && (
                        <button className="text-gray-500 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}