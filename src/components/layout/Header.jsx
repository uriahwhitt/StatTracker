import { T } from "../../utils/constants";
import { calcPoints } from "../../utils/stats";
import { useAuthUser } from "../../utils/auth";

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>
);

export default function Header({ db, activePlayerId, setActivePlayer, view, stats, setView }) {
  const user = useAuthUser();
  const isAuthenticated = user && !user.isAnonymous;

  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0e1c 0%, #16082a 100%)",
      padding: "env(safe-area-inset-top, 12px) 20px 14px",
      borderBottom: `1px solid ${T.border}`,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>🏀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>WE TRACK</div>
          <div style={{ fontSize: 10, color: T.orange, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Game Log</div>
        </div>
        {db.players.length > 0 && (
          <select value={activePlayerId} onChange={e => setActivePlayer(e.target.value)} style={{
            width: "auto", minWidth: 90, padding: "6px 10px", fontSize: 13, fontWeight: 700,
            background: "rgba(255,255,255,0.08)", borderRadius: 20, textAlign: "center",
          }}>
            {db.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {view === "tracker" && (
          <div style={{ background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.3)`, color: T.orange, borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 900, color: "#fff" }}>{calcPoints(stats)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>PTS</span>
          </div>
        )}
        <button
          onClick={() => setView("settings")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: view === "settings" ? T.orange : "#555",
            padding: "4px", display: "flex", alignItems: "center",
            transition: "color 0.15s",
          }}
          aria-label="Settings"
        >
          {/* Gear icon with optional profile photo avatar overlay */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <GearIcon />
            {isAuthenticated && user.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                style={{
                  position: "absolute",
                  bottom: -4, right: -4,
                  width: 13, height: 13,
                  borderRadius: "50%",
                  border: "1.5px solid #0a0a0f",
                  objectFit: "cover",
                }}
              />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
