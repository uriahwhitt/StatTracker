import { useState, useRef } from "react";
import { T } from "../../utils/constants";
import FlashButton from "../common/FlashButton";

export default function OpponentStrip({ opponent, onScore, onFoul, onTechFoul, onTimeout }) {
  const [popup, setPopup] = useState(null);
  const popupTimer = useRef(null);

  const fire = (action, label, color) => {
    action();
    setPopup({ label, color });
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => setPopup(null), 600);
  };

  return (
    <div style={{
      background: "rgba(59,130,246,0.06)",
      borderTop: `1px solid rgba(59,130,246,0.2)`,
      padding: "6px 10px env(safe-area-inset-bottom, 6px)",
      flexShrink: 0,
      position: "relative",
    }}>
      {popup && (
        <div style={{
          position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)",
          background: popup.color, color: "#fff", fontWeight: 900,
          fontSize: 15, fontFamily: "'DM Mono',monospace",
          padding: "2px 12px", borderRadius: 8,
          animation: "fadeUp 0.6s ease-out forwards",
          pointerEvents: "none", zIndex: 10,
        }}>{popup.label}</div>
      )}

      <div style={{ fontSize: 11, color: "#667", fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
        {opponent}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        <FlashButton label="+2" bg="rgba(34,197,94,0.3)" border="rgba(34,197,94,0.55)" onClick={() => fire(() => onScore(2), "+2", T.green)} />
        <FlashButton label="+3" bg="rgba(34,197,94,0.3)" border="rgba(34,197,94,0.55)" onClick={() => fire(() => onScore(3), "+3", T.green)} />
        <FlashButton label="+1" bg="rgba(34,197,94,0.25)" border="rgba(34,197,94,0.5)" onClick={() => fire(() => onScore(1), "+1", T.green)} />
        <FlashButton label="PF" bg="rgba(245,158,11,0.3)" border="rgba(245,158,11,0.55)" onClick={() => fire(onFoul, "+PF", "#F59E0B")} />
        <FlashButton label="TF" bg="rgba(239,68,68,0.3)" border="rgba(239,68,68,0.55)" onClick={() => fire(onTechFoul, "+TF", T.red)} />
        <FlashButton label="T/O" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => fire(onTimeout, "T/O", T.blue)} />
      </div>
    </div>
  );
}
