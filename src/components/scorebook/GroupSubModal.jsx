import { useState } from "react";
import { T } from "../../utils/constants";

const AMBER = "#F59E0B";

export default function GroupSubModal({
  roster,
  activePlayers,
  standbySubs = [],
  onSaveStandby,
  onConfirm,
  onClose,
}) {
  // selected = players who will be ON COURT after the sub
  // standby = pre-queued bench players waiting to sub in
  const [selected, setSelected] = useState([...activePlayers]);
  const [standby, setStandby] = useState([...standbySubs]);

  const tap = (pid) => {
    const isActive  = activePlayers.includes(pid);
    const isSelected = selected.includes(pid);
    const isStandby  = standby.includes(pid);

    if (isActive) {
      // Tapping an active player removes them from selected; standby fills in FIFO
      if (isSelected) {
        const newSelected = selected.filter(id => id !== pid);
        // Auto-fill from standby
        if (standby.length > 0) {
          const [fill, ...rest] = standby;
          setSelected([...newSelected, fill]);
          setStandby(rest);
        } else {
          setSelected(newSelected);
        }
      }
      // Tapping an already-deselected active player re-adds them if space allows
      else if (selected.length < 5) {
        setSelected([...selected, pid]);
      }
    } else {
      // Bench player
      if (isStandby) {
        // Remove from standby
        setStandby(standby.filter(id => id !== pid));
      } else if (isSelected) {
        // Was auto-filled into selected — move back to bench
        setSelected(selected.filter(id => id !== pid));
      } else {
        // Add to standby queue
        setStandby([...standby, pid]);
      }
    }
  };

  const hasStandbyChanges = standby.length > 0;
  const canConfirm = selected.length === 5;
  const isSubstitution = canConfirm && (
    selected.some(pid => !activePlayers.includes(pid)) ||
    activePlayers.some(pid => !selected.includes(pid))
  );

  // Label & color for each player card
  const getCardState = (pid) => {
    if (selected.includes(pid))  return { label: activePlayers.includes(pid) ? "ON COURT" : "COMING IN", color: T.orange, border: T.orange, bg: "rgba(249,115,22,0.15)" };
    if (standby.includes(pid))   return { label: "STANDBY",  color: AMBER,   border: AMBER,   bg: "rgba(245,158,11,0.15)" };
    return { label: activePlayers.includes(pid) ? "GOING OUT" : "", color: "#555", border: T.border, bg: "rgba(255,255,255,0.04)" };
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0", padding: "20px 16px",
        maxHeight: "80vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>

        <div style={{ fontSize: 14, fontWeight: 700, color: "#888", marginBottom: 4 }}>
          Group Substitution
        </div>
        <div style={{ fontSize: 12, color: T.orange, fontWeight: 700, marginBottom: 16 }}>
          {canConfirm
            ? "Ready — tap Confirm Lineup to execute"
            : hasStandbyChanges
              ? `${standby.length} player${standby.length > 1 ? "s" : ""} queued — tap active players going off`
              : `Select 5 players (${selected.length}/5)`
          }
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {roster.map(p => {
            const { label, color, border, bg } = getCardState(p.playerId);
            return (
              <button key={p.playerId} onClick={() => tap(p.playerId)} style={{
                padding: "14px 8px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                background: bg, border: `2px solid ${border}`,
              }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900,
                  color: color,
                }}>{p.jerseyNumber}</div>
                <div style={{ fontSize: 11, color: color === "#555" ? "#666" : "#fff", fontWeight: 600, marginTop: 4 }}>
                  {p.name}
                </div>
                {label && (
                  <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>{label}</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {hasStandbyChanges ? (
            <button onClick={() => onSaveStandby(standby)} style={{
              flex: 1, background: "rgba(245,158,11,0.12)", color: AMBER,
              border: `1px solid ${AMBER}`, borderRadius: 12, padding: "14px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Save & Close
            </button>
          ) : (
            <button onClick={onClose} style={{
              flex: 1, background: "rgba(255,255,255,0.06)", color: "#888",
              border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Cancel</button>
          )}
          <button
            onClick={() => isSubstitution && canConfirm && onConfirm(selected)}
            disabled={!canConfirm}
            style={{
              flex: 2, borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 800,
              cursor: canConfirm ? "pointer" : "default",
              background: canConfirm
                ? `linear-gradient(135deg, ${T.orange}, #ea580c)`
                : "rgba(255,255,255,0.04)",
              color: canConfirm ? "#fff" : "#444", border: "none",
            }}
          >
            Confirm Lineup
          </button>
        </div>
      </div>
    </div>
  );
}
