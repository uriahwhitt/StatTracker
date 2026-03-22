import { useState, useRef, useCallback } from "react";

export default function FlashButton({ label, bg, border, onClick, span, size }) {
  const [flash, setFlash] = useState(false);
  const t = useRef(null);
  const handle = useCallback(() => {
    onClick();
    setFlash(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setFlash(false), 300);
  }, [onClick]);
  return (
    <button onClick={handle} style={{
      gridColumn: span || "auto",
      background: flash ? "#fff" : bg,
      border: `1px solid ${flash ? "#fff" : border}`,
      color: flash ? "#000" : "#fff",
      fontWeight: 800, borderRadius: 8,
      padding: "8px 0", fontSize: size || 11, cursor: "pointer", minHeight: 40,
      display: "flex", alignItems: "center", justifyContent: "center",
      WebkitTapHighlightColor: "transparent", transition: "all 0.15s ease-out",
      width: "100%",
    }}>{label}</button>
  );
}
