// ── Live Game Banner — Phase 2 Gate 4 ─────────────────────────────────────────
// Sticky banner shown at top of app when a game is broadcasting.
// onClick opens the live game view.

import { T } from '../../utils/constants';

export default function LiveGameBanner({ liveGame, onClick }) {
  if (!liveGame?.isLive) return null;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))',
        border: `1px solid rgba(34,197,94,0.35)`,
        borderRadius: 12,
        margin: '0 16px 12px',
        padding: '12px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Pulsing dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: T.green,
        }} />
        <div style={{
          position: 'absolute', inset: -3,
          borderRadius: '50%', border: `2px solid ${T.green}`,
          animation: 'livePulse 1.6s ease-out infinite',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live Game
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 1 }}>
          {liveGame.teamName || 'Your Team'} vs {liveGame.opponent || 'Opponent'}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 900, color: '#fff' }}>
          {liveGame.homeScore ?? 0}
          <span style={{ color: '#444', margin: '0 4px' }}>-</span>
          {liveGame.awayScore ?? 0}
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>TAP TO WATCH</div>
      </div>

      <style>{`
        @keyframes livePulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
