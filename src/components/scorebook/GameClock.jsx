import { useState, useEffect, useRef } from "react";
import { T } from "../../utils/constants";

const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
};

export default function GameClock({ periodLabel, periodLengthSec, initialTimeSec, onTimeChange }) {
  const startSec = initialTimeSec ?? periodLengthSec ?? 480;
  const [timeLeft, setTimeLeft] = useState(startSec);
  const [running, setRunning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [wasRunning, setWasRunning] = useState(false);
  const [periodOver, setPeriodOver] = useState(startSec === 0);
  const [flashOn, setFlashOn] = useState(true);

  const intervalRef = useRef(null);
  const flashRef = useRef(null);
  // Keep onTimeChange in a ref so interval callbacks never hold a stale reference
  const onTimeChangeRef = useRef(onTimeChange);
  useEffect(() => { onTimeChangeRef.current = onTimeChange; });

  // Notify parent of initial time immediately on mount
  useEffect(() => {
    onTimeChangeRef.current?.(fmtTime(startSec));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown interval — only runs when clock is going and edit mode is closed
  useEffect(() => {
    if (running && !editMode) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setPeriodOver(true);
            onTimeChangeRef.current?.("0:00");
            return 0;
          }
          const next = prev - 1;
          onTimeChangeRef.current?.(fmtTime(next));
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, editMode]);

  // Flash effect when period ends
  useEffect(() => {
    if (periodOver) {
      flashRef.current = setInterval(() => setFlashOn(f => !f), 500);
    } else {
      clearInterval(flashRef.current);
      setFlashOn(true);
    }
    return () => clearInterval(flashRef.current);
  }, [periodOver]);

  const handleStartStop = () => {
    if (periodOver) setPeriodOver(false);
    setRunning(r => !r);
  };

  const openEdit = () => {
    setWasRunning(running);
    setRunning(false);
    setEditMode(true);
  };

  const closeEdit = () => {
    setEditMode(false);
    if (wasRunning) setRunning(true);
  };

  const nudge = (delta) => {
    setTimeLeft(prev => {
      const next = Math.max(0, Math.min(periodLengthSec ?? 480, prev + delta));
      onTimeChangeRef.current?.(fmtTime(next));
      if (next === 0) setPeriodOver(true);
      else if (periodOver) setPeriodOver(false);
      return next;
    });
  };

  const timeDisplay = fmtTime(timeLeft);
  // Flash the digits red when period is over
  const timeColor = periodOver ? (flashOn ? T.red : "rgba(0,0,0,0)") : "#fff";

  const mkBtn = (bg, border, color, onClick, label) => (
    <button
      onClick={onClick}
      style={{
        background: bg, border, color, borderRadius: 8,
        padding: "5px 10px", fontSize: 11, fontWeight: 800,
        cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px",
      background: "rgba(255,255,255,0.02)",
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    }}>
      {/* Period label — read-only display, matching the interactive pill one row below */}
      <span style={{
        fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 900,
        color: T.orange, letterSpacing: "0.04em", minWidth: 32, flexShrink: 0,
      }}>
        {periodLabel}
      </span>

      {/* Left nudge buttons (edit mode only) */}
      {editMode && (
        <>
          {mkBtn("rgba(255,255,255,0.08)", "1px solid rgba(255,255,255,0.15)", "#888", () => nudge(-10), "-10s")}
          {mkBtn("rgba(255,255,255,0.08)", "1px solid rgba(255,255,255,0.15)", "#888", () => nudge(-1), "-1s")}
        </>
      )}

      {/* Clock face */}
      <span style={{
        fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900,
        color: timeColor, letterSpacing: "0.05em",
        flex: 1, textAlign: "center", flexShrink: 0,
      }}>
        {timeDisplay}
      </span>

      {/* Right nudge buttons (edit mode only) */}
      {editMode && (
        <>
          {mkBtn("rgba(255,255,255,0.08)", "1px solid rgba(255,255,255,0.15)", "#888", () => nudge(1), "+1s")}
          {mkBtn("rgba(255,255,255,0.08)", "1px solid rgba(255,255,255,0.15)", "#888", () => nudge(10), "+10s")}
        </>
      )}

      {/* Period-ended badge — flashes when clock hits 0:00 (normal mode only) */}
      {periodOver && !editMode && (
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
          color: flashOn ? T.red : "rgba(0,0,0,0)",
          flexShrink: 0, userSelect: "none",
        }}>
          END
        </span>
      )}

      {/* Start / Stop toggle (normal mode only) */}
      {!editMode && mkBtn(
        running ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
        `1px solid ${running ? T.red : T.green}`,
        running ? T.red : T.green,
        handleStartStop,
        running ? "■ STOP" : "▶ START",
      )}

      {/* Edit / Done */}
      {editMode
        ? mkBtn("rgba(249,115,22,0.15)", `1px solid ${T.orange}`, T.orange, closeEdit, "DONE")
        : mkBtn("rgba(255,255,255,0.06)", "1px solid rgba(255,255,255,0.12)", "#555", openEdit, "EDIT")
      }
    </div>
  );
}
