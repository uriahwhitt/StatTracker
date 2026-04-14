// ── Members Modal — Phase 2 Gate 3 ────────────────────────────────────────────
// Shows the member list for a team, with Add Coach (invite) and role management.
// Props: orgId, teamId, teamName, orgName, user, userRole, onClose

import { useState, useEffect, useCallback } from 'react';
import { T } from '../../utils/constants';
import { createInvite } from '../../utils/invites';
import { getOrgMembers, updateMemberRole, removeRole, updateMemberPermissions, defaultPermissions } from '../../utils/roles';

const ROLE_LABELS = {
  owner: 'Owner',
  headcoach: 'Head Coach',
  assistantcoach: 'Asst. Coach',
  manager: 'Manager',
  staff: 'Staff',
  parent: 'Parent',
};

const ROLE_COLORS = {
  owner: T.orange,
  headcoach: T.blue,
  assistantcoach: '#a78bfa',
  manager: '#34d399',
  staff: '#60a5fa',
  parent: '#888',
};

// Roles that can be assigned via invite or role-change UI
const CHANGEABLE_ROLES = ['headcoach', 'assistantcoach', 'manager', 'staff', 'parent'];

// Which permission flags are grantable (toggleable) for each role.
// "auto" permissions (always on for the role) are not shown here.
// "—" permissions (never available for the role) are also not shown.
const GRANTABLE_BY_ROLE = {
  owner:          [],
  headcoach:      [],
  assistantcoach: ['roster', 'schedule', 'documents', 'tasks', 'equipment'],
  manager:        ['scorebook', 'orgSettings'],
  staff:          ['scorebook', 'roster', 'schedule', 'documents', 'tasks', 'compliance', 'equipment'],
  parent:         ['scorebook'],
};

const PERMISSION_LABELS = {
  scorebook:    'Scorekeeper',
  roster:       'Roster Edits',
  schedule:     'Schedule Edits',
  documents:    'Documents',
  tasks:        'Tasks',
  compliance:   'Compliance',
  equipment:    'Equipment',
  orgSettings:  'Org Settings',
};

export default function MembersModal({ orgId, teamId, teamName, orgName, user, userRole, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState('assistantcoach');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [contextMenuUid, setContextMenuUid] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // uid
  const [changeRoleFor, setChangeRoleFor] = useState(null); // { uid, currentRole }
  const [newRole, setNewRole] = useState('');
  const [confirmHcTransfer, setConfirmHcTransfer] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedPermUid, setExpandedPermUid] = useState(null); // uid of member with open perms panel
  const [permWorking, setPermWorking] = useState(false);

  const canManage = userRole?.role === 'owner' || userRole?.role === 'headcoach';

  const reload = useCallback(async () => {
    setLoading(true);
    const all = await getOrgMembers(orgId);
    // Filter to this team, active members only
    const teamMembers = all.filter(m => m.teamId === teamId && !m.removedAt);
    setMembers(teamMembers);
    setLoading(false);
  }, [orgId, teamId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Invite ─────────────────────────────────────────────────────────────────
  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    setErrorMsg('');
    setInviteLink('');
    try {
      const token = await createInvite({
        orgId,
        teamId,
        role: inviteRole,
        createdByUid: user.uid,
        teamName,
        orgName,
      });
      const link = `${window.location.origin}/invite/${token}`;
      setInviteLink(link);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to generate invite.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Role change ────────────────────────────────────────────────────────────
  const startChangeRole = (member) => {
    setContextMenuUid(null);
    setChangeRoleFor({ uid: member.uid, currentRole: member.role });
    // Default selection: pick something different from the current role
    const others = CHANGEABLE_ROLES.filter(r => r !== member.role);
    setNewRole(others[0] || 'assistantcoach');
    setConfirmHcTransfer(false);
  };

  const handleChangeRole = async () => {
    if (!changeRoleFor) return;
    // If promoting to HC, show confirmation first
    if (newRole === 'headcoach' && !confirmHcTransfer) {
      setConfirmHcTransfer(true);
      return;
    }
    setWorking(true);
    setErrorMsg('');
    try {
      await updateMemberRole(changeRoleFor.uid, orgId, newRole, user.uid);
      setChangeRoleFor(null);
      setConfirmHcTransfer(false);
      await reload();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update role.');
    } finally {
      setWorking(false);
    }
  };

  // ── Remove ─────────────────────────────────────────────────────────────────
  const handleRemove = async (uid) => {
    setWorking(true);
    setErrorMsg('');
    try {
      await removeRole(uid, orgId, user.uid);
      setConfirmRemove(null);
      setContextMenuUid(null);
      await reload();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remove member.');
    } finally {
      setWorking(false);
    }
  };

  // ── Permission toggle ───────────────────────────────────────────────────────
  const handleTogglePermission = async (member, permKey) => {
    setPermWorking(true);
    setErrorMsg('');
    try {
      const current = member.permissions ?? defaultPermissions(member.role);
      const updated = { ...current, [permKey]: !current[permKey] };
      await updateMemberPermissions(member.uid, orgId, updated);
      // Update local state immediately so the toggle reflects without a reload
      setMembers(prev => prev.map(m =>
        m.uid === member.uid ? { ...m, permissions: updated } : m
      ));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update permissions.');
    } finally {
      setPermWorking(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeHCs = members.filter(m => m.role === 'headcoach' && !m.removedAt);
  const conflictMembers = members.filter(m => m.status === 'pending_conflict');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#0f0f18', borderTop: `1px solid ${T.border}`,
        borderRadius: '16px 16px 0 0', width: '100%',
        maxHeight: '85vh', overflowY: 'auto', padding: '20px 16px 32px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Team Members
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 2 }}>{teamName}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555', fontSize: 22,
            cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
          }}>✕</button>
        </div>

        {/* Conflict banner */}
        {conflictMembers.length > 0 && (
          <div style={{
            background: 'rgba(249,115,22,0.08)', border: `1px solid rgba(249,115,22,0.25)`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, lineHeight: 1.5,
          }}>
            <strong style={{ color: T.orange }}>Role Conflict</strong>
            <div style={{ color: '#888', marginTop: 4 }}>
              {conflictMembers.map(m => m.displayName || m.email).join(', ')} accepted a Head Coach invite but a Head Coach is already assigned.
              {' '}Resolve below using Change Role or Remove.
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{errorMsg}</div>
        )}

        {/* Member list */}
        {loading ? (
          <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            No coaches added yet.
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {members.map(member => {
              const isSelf = member.uid === user?.uid;
              const isOnlyHC = member.role === 'headcoach' && activeHCs.length === 1;
              const isPendingConflict = member.status === 'pending_conflict';

              return (
                <div key={member.uid} style={{
                  background: T.card, border: `1px solid ${isPendingConflict ? 'rgba(249,115,22,0.3)' : T.border}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Avatar */}
                    {member.photoURL ? (
                      <img src={member.photoURL} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: T.blue, flexShrink: 0,
                      }}>
                        {(member.displayName || member.email || '?')[0].toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.displayName || member.email || 'Unknown'}
                        {isSelf && <span style={{ color: '#555', fontWeight: 600, fontSize: 11, marginLeft: 6 }}>(you)</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: isPendingConflict ? T.orange : (ROLE_COLORS[member.role] || '#888'),
                          background: isPendingConflict ? 'rgba(249,115,22,0.1)' : 'transparent',
                          padding: isPendingConflict ? '1px 6px' : 0, borderRadius: 4,
                        }}>
                          {isPendingConflict ? 'Pending' : (ROLE_LABELS[member.role] || member.role)}
                        </span>
                        {member.grantedAt && (
                          <span style={{ fontSize: 10, color: '#444' }}>
                            · {new Date(member.grantedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Context menu button */}
                    {canManage && (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button onClick={() => setContextMenuUid(contextMenuUid === member.uid ? null : member.uid)} style={{
                          background: 'none', border: 'none', color: '#555', fontSize: 18,
                          cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
                        }}>⋯</button>

                        {contextMenuUid === member.uid && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', zIndex: 10,
                            background: '#1a1a2e', border: `1px solid ${T.border}`,
                            borderRadius: 10, padding: '6px', minWidth: 160,
                          }}>
                            {/* Permissions */}
                            {(GRANTABLE_BY_ROLE[member.role] || []).length > 0 && (
                              <button onClick={() => {
                                setContextMenuUid(null);
                                setExpandedPermUid(expandedPermUid === member.uid ? null : member.uid);
                              }} style={menuItem}>
                                Permissions
                              </button>
                            )}
                            {/* Change Role */}
                            {CHANGEABLE_ROLES.includes(member.role) && (
                              <button onClick={() => startChangeRole(member)} style={menuItem}>
                                Change Role
                              </button>
                            )}
                            {/* Remove */}
                            {!(isSelf && isOnlyHC) && (
                              <button onClick={() => { setContextMenuUid(null); setConfirmRemove(member.uid); }} style={{ ...menuItem, color: T.red }}>
                                {isSelf ? 'Leave Team' : 'Remove'}
                              </button>
                            )}
                            {isSelf && isOnlyHC && (
                              <div style={{ fontSize: 11, color: '#444', padding: '6px 10px' }}>
                                Assign another HC first
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Permissions panel — shown when expanded via context menu */}
                  {expandedPermUid === member.uid && canManage && (
                    <PermissionsPanel
                      member={member}
                      onToggle={(key) => handleTogglePermission(member, key)}
                      disabled={permWorking}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Change role panel */}
        {changeRoleFor && (
          <div style={{
            background: 'rgba(59,130,246,0.06)', border: `1px solid rgba(59,130,246,0.2)`,
            borderRadius: 10, padding: '14px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 10 }}>Change Role</div>
            {confirmHcTransfer ? (
              <>
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
                  Transferring Head Coach will change the current HC's role. This affects who can manage the team. Are you sure?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionBtn color={T.orange} onClick={handleChangeRole} disabled={working}>
                    {working ? 'Saving…' : 'Confirm Transfer'}
                  </ActionBtn>
                  <ActionBtn color="#555" onClick={() => { setChangeRoleFor(null); setConfirmHcTransfer(false); }}>Cancel</ActionBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {CHANGEABLE_ROLES.map(r => (
                    <button key={r} onClick={() => setNewRole(r)} style={{
                      background: newRole === r ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${newRole === r ? 'rgba(249,115,22,0.4)' : T.border}`,
                      color: newRole === r ? T.orange : '#666',
                      borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionBtn color={T.orange} onClick={handleChangeRole} disabled={working || newRole === changeRoleFor.currentRole}>
                    {working ? 'Saving…' : 'Save'}
                  </ActionBtn>
                  <ActionBtn color="#555" onClick={() => setChangeRoleFor(null)}>Cancel</ActionBtn>
                </div>
              </>
            )}
          </div>
        )}

        {/* Confirm remove */}
        {confirmRemove && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`,
            borderRadius: 10, padding: '14px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
              {confirmRemove === user?.uid
                ? 'Leave this team? Your role will be removed.'
                : 'Remove this member from the team?'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn color={T.red} onClick={() => handleRemove(confirmRemove)} disabled={working}>
                {working ? 'Removing…' : confirmRemove === user?.uid ? 'Leave' : 'Remove'}
              </ActionBtn>
              <ActionBtn color="#555" onClick={() => setConfirmRemove(null)}>Cancel</ActionBtn>
            </div>
          </div>
        )}

        {/* Add Coach section */}
        {canManage && (
          <div>
            {!showInvitePanel ? (
              <button onClick={() => { setShowInvitePanel(true); setInviteLink(''); }} style={{
                width: '100%', background: 'none',
                border: `1px dashed rgba(249,115,22,0.3)`, color: T.orange,
                borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                + Add Coach / Parent
              </button>
            ) : (
              <div style={{
                background: 'rgba(249,115,22,0.05)', border: `1px solid rgba(249,115,22,0.15)`,
                borderRadius: 10, padding: '14px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, marginBottom: 10 }}>
                  Generate Invite Link
                </div>

                {/* Role selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['headcoach', 'assistantcoach', 'manager', 'staff', 'parent'].map(r => (
                    <button key={r} onClick={() => setInviteRole(r)} style={{
                      background: inviteRole === r ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${inviteRole === r ? 'rgba(249,115,22,0.4)' : T.border}`,
                      color: inviteRole === r ? T.orange : '#666',
                      borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>

                {inviteLink ? (
                  <>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 12px',
                      fontSize: 11, color: '#888', wordBreak: 'break-all',
                      fontFamily: "'DM Mono', monospace", marginBottom: 10, lineHeight: 1.5,
                    }}>
                      {inviteLink}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ActionBtn color={copied ? T.green : T.orange} onClick={handleCopy}>
                        {copied ? 'Copied!' : 'Copy Link'}
                      </ActionBtn>
                      <ActionBtn color="#555" onClick={() => { setShowInvitePanel(false); setInviteLink(''); }}>Done</ActionBtn>
                    </div>
                    <div style={{ fontSize: 11, color: '#444', marginTop: 8 }}>Link expires in 48 hours.</div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ActionBtn color={T.orange} onClick={handleGenerateInvite} disabled={generatingInvite}>
                      {generatingInvite ? 'Generating…' : 'Generate Link'}
                    </ActionBtn>
                    <ActionBtn color="#555" onClick={() => setShowInvitePanel(false)}>Cancel</ActionBtn>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
const menuItem = {
  display: 'block', width: '100%', background: 'none', border: 'none',
  color: '#ccc', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  padding: '8px 10px', textAlign: 'left', borderRadius: 6,
};

function ActionBtn({ onClick, disabled, color, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.04)' : `rgba(${hexToRgb(color)},0.12)`,
      border: `1px solid ${disabled ? T.border : color}`,
      color: disabled ? '#444' : color,
    }}>
      {children}
    </button>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Permissions Panel ─────────────────────────────────────────────────────────
// Renders inside the member card when "Permissions" is tapped in the context menu.
// Shows grantable permission toggles for the member's role.
function PermissionsPanel({ member, onToggle, disabled }) {
  const grantable = GRANTABLE_BY_ROLE[member.role] || [];
  const perms = member.permissions ?? defaultPermissions(member.role);

  if (grantable.length === 0) return null;

  return (
    <div style={{
      borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 10,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#555', marginBottom: 8,
      }}>
        Extra Permissions
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {grantable.map(key => {
          const active = perms[key] === true;
          return (
            <button
              key={key}
              onClick={() => !disabled && onToggle(key)}
              disabled={disabled}
              style={{
                background: active ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : T.border}`,
                color: active ? T.orange : '#555',
                borderRadius: 20, padding: '4px 10px',
                fontSize: 10, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {active ? '✓ ' : '+ '}{PERMISSION_LABELS[key] || key}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: '#444', marginTop: 6 }}>
        Tap to grant or revoke. Changes take effect immediately.
      </div>
    </div>
  );
}
