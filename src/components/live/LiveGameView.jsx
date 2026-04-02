// ── Live Game View — Phase 2 Gate 4 ───────────────────────────────────────────
// Read-only live scorebook view, subscribed via onSnapshot.
// Props: orgId, teamId, onClose

import { useState, useEffect } from 'react';
import { T } from '../../utils/constants';
import { subscribeLiveGame } from '../../utils/liveGame';
import { deriveBoxScore, deriveTeamStats, deriveOpponentStats } from '../../utils/scorebookEngine';

export default function LiveGameView({ orgId, onClose }) {
  const [liveGame, setLiveGame] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribeLiveGame(orgId, (data) => {
      setConnected(true);
      setLiveGame(data);
    });
    return unsub;
  }, [orgId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const events = liveGame?.events || [];
  const format = liveGame?.format || {};
  const roster = liveGame?.roster || [];
  const teamStats = deriveTeamStats(events, format);
  const oppStats = deriveOpponentStats(events);

  const boxScore = liveGame ? (() => {
    try { return deriveBoxScore(events, roster); } catch { return []; }
  })() : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: T.bg, overflowY: 'auto',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${T.border}`,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: T.orange,
          fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0,
        }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: liveGame?.isLive ? T.green : '#444' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: liveGame?.isLive ? T.green : '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {liveGame?.isLive ? 'Live' : 'Ended'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>Read-only</div>
      </div>

      {!connected ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 14 }}>Connecting…</div>
      ) : !liveGame ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 14 }}>No game is currently live.</div>
      ) : (
        <div style={{ padding: '16px 16px 40px' }}>

          {/* Scoreboard */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '20px 16px', marginBottom: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {liveGame.teamName} vs {liveGame.opponent}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{liveGame.teamName || 'Home'}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  {teamStats.score ?? 0}
                </div>
              </div>
              <div style={{ fontSize: 20, color: '#333', fontWeight: 900 }}>—</div>
              <div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{liveGame.opponent || 'Away'}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  {oppStats.score ?? 0}
                </div>
              </div>
            </div>
            {liveGame.period && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 10 }}>
                Period {liveGame.period}
              </div>
            )}
          </div>

          {/* Box score */}
          {boxScore.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Box Score
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th style={thStyle}>Player</th>
                      <th style={thStyle}>PTS</th>
                      <th style={thStyle}>REB</th>
                      <th style={thStyle}>AST</th>
                      <th style={thStyle}>STL</th>
                      <th style={thStyle}>BLK</th>
                      <th style={thStyle}>FLS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxScore.map(row => (
                      <tr key={row.playerId} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{row.name}</div>
                          <div style={{ fontSize: 10, color: '#555' }}>#{row.jerseyNumber}</div>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "'DM Mono',monospace", fontWeight: 700, color: '#fff' }}>{row.stats?.points ?? 0}</td>
                        <td style={tdStyle}>{(row.stats?.offReb ?? 0) + (row.stats?.defReb ?? 0)}</td>
                        <td style={tdStyle}>{row.stats?.assists ?? 0}</td>
                        <td style={tdStyle}>{row.stats?.steals ?? 0}</td>
                        <td style={tdStyle}>{row.stats?.blocks ?? 0}</td>
                        <td style={tdStyle}>{row.stats?.fouls ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent events */}
          {events.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Recent Events
              </div>
              {[...events].reverse().slice(0, 20).map((evt, i) => (
                <div key={evt.id || i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  fontSize: 12,
                }}>
                  <span style={{ color: '#888' }}>{evt.description || evt.type}</span>
                  <span style={{ color: '#444', fontSize: 11 }}>P{evt.period}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '6px 8px', textAlign: 'center', color: '#555', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' };
const tdStyle = { padding: '8px', textAlign: 'center', color: '#888' };
