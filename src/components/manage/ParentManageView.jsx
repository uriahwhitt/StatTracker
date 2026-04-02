// ── Parent Manage View — Phase 2 Gate 4 ──────────────────────────────────────
// Read-only view for parents: lists their joined teams and team rosters.
// No CRUD operations. Profile and documents coming in Gate 7+.

import { T } from '../../utils/constants';

export default function ParentManageView({ db, allRoles }) {
  // allRoles: [{ orgId, teamId, role, ... }]
  const myTeams = allRoles.filter(r => r.role === 'parent' && r.teamId);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14 }}>My Teams</div>

      {myTeams.length === 0 ? (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '32px 16px', textAlign: 'center',
          color: '#444', fontSize: 14,
        }}>
          No teams joined yet.<br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
            Ask your coach for a join code and enter it in Settings → Join a Team.
          </span>
        </div>
      ) : (
        myTeams.map(role => {
          const team = db.teams.find(t => t.id === role.teamId);
          const org = db.organizations.find(o => o.id === role.orgId);
          const roster = (team?.roster || []).map(r => {
            const player = db.players.find(p => p.id === r.playerId);
            return { ...r, name: player?.name || 'Unknown Player' };
          }).sort((a, b) => {
            const na = parseInt(a.jerseyNumber) || 999;
            const nb = parseInt(b.jerseyNumber) || 999;
            return na - nb;
          });

          return (
            <div key={role.orgId + role.teamId} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 12, marginBottom: 12, overflow: 'hidden',
            }}>
              {/* Team header */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {org?.name || 'Organization'}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 2 }}>
                  {team?.name || 'Team'}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700,
                  color: T.orange, background: 'rgba(249,115,22,0.12)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: 20, padding: '2px 10px',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>Parent</div>
              </div>

              {/* Roster */}
              {roster.length === 0 ? (
                <div style={{ padding: '14px 16px', fontSize: 13, color: '#444' }}>No players on roster yet.</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {roster.map(r => (
                    <div key={r.playerId} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: '#a855f7',
                        flexShrink: 0,
                      }}>
                        {r.jerseyNumber || '—'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>{r.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Future placeholder */}
      <div style={{
        marginTop: 8, padding: '12px 16px',
        background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)',
        borderRadius: 10, fontSize: 12, color: '#444', lineHeight: 1.6,
      }}>
        Profile editing and document management coming in a future update.
      </div>
    </div>
  );
}
