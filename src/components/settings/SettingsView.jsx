import { useState, useEffect, useRef } from "react";
import { T } from "../../utils/constants";
import { auth } from "../../firebase";
import { getCurrentUid } from "../../utils/storage";
import {
  createTransferCode,
  deleteTransferCode,
  redeemTransferCode,
  formatCode,
} from "../../utils/transferCode";
import { version } from "../../../package.json";

const EXPIRY_SECS = 10 * 60; // 10 minutes

// ── Shared sub-components ─────────────────────────────────────────────────────
function SectionLabel({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#555",
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: 8, marginTop: 24,
    }}>{label}</div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "14px 16px",
      ...style,
    }}>{children}</div>
  );
}

function ActionBtn({ label, color = T.orange, onClick, destructive }) {
  const bg = destructive ? "rgba(239,68,68,0.1)" : `rgba(249,115,22,0.12)`;
  const border = destructive ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.35)";
  const col = destructive ? T.red : color;
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "12px", borderRadius: 10, fontSize: 13,
      fontWeight: 700, cursor: "pointer", textAlign: "left",
      background: bg, border: `1px solid ${border}`, color: col,
    }}>{label}</button>
  );
}

// ── Device linking modal ──────────────────────────────────────────────────────
function LinkingModal({ onClose }) {
  const [step, setStep] = useState("choice"); // choice | share | enter
  const [code, setCode]           = useState(null);   // raw 6-char
  const [countdown, setCountdown] = useState(EXPIRY_SECS);
  const [enteredCode, setEnteredCode] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);
  const timerRef = useRef(null);

  // Start countdown when share step begins
  useEffect(() => {
    if (step !== "share" || !code) return;
    setCountdown(EXPIRY_SECS);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          // Code expired — close
          onClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, code]);

  const handleShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = getCurrentUid() || auth.currentUser?.uid;
      if (!uid) throw new Error("Not signed in. Please restart the app.");
      const newCode = await createTransferCode(uid);
      setCode(newCode);
      setStep("share");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    clearInterval(timerRef.current);
    if (code) await deleteTransferCode(code).catch(() => {});
    onClose();
  };

  const handleRedeem = async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = getCurrentUid() || auth.currentUser?.uid;
      if (!uid) throw new Error("Not signed in. Please restart the app.");
      await redeemTransferCode(enteredCode, uid);
      setSuccess(true);
      // Short delay so user sees success message, then reload
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const fmtCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div style={{
        background: "#12121f", borderRadius: "16px 16px 0 0",
        width: "100%", maxWidth: 500,
        padding: "24px 20px env(safe-area-inset-bottom, 20px)",
        border: `1px solid ${T.border}`, borderBottom: "none",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Link a Device</div>
          <button onClick={handleCancel} style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Step: choice */}
        {step === "choice" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 8, lineHeight: 1.5 }}>
              Choose which device has the data you want to keep.
            </p>
            <button onClick={handleShare} disabled={loading} style={{
              padding: "16px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.4)`,
              color: T.orange, cursor: "pointer",
            }}>
              📤 Share my data
              <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 4 }}>
                This device has the data. Generate a code for the other device to use.
              </div>
            </button>
            <button onClick={() => setStep("enter")} style={{
              padding: "16px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
              color: "#ccc", cursor: "pointer",
            }}>
              📥 Use another device's data
              <div style={{ fontSize: 11, color: "#666", fontWeight: 400, marginTop: 4 }}>
                Enter the code from the other device to copy its data here.
              </div>
            </button>
            {error && <div style={{ fontSize: 12, color: T.red, marginTop: 4 }}>{error}</div>}
          </div>
        )}

        {/* Step: share — show code + countdown */}
        {step === "share" && code && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
              Enter this code on the other device within the time limit.
            </p>
            <div style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 42, fontWeight: 900, letterSpacing: "0.2em",
              color: T.orange, marginBottom: 12,
            }}>
              {formatCode(code)}
            </div>
            <div style={{
              fontSize: 13, color: countdown < 60 ? T.red : "#555",
              fontFamily: "'DM Mono',monospace", marginBottom: 24,
              fontWeight: countdown < 60 ? 700 : 400,
            }}>
              {fmtCountdown(countdown)} remaining
            </div>
            <button onClick={handleCancel} style={{
              width: "100%", padding: "12px", borderRadius: 10, fontSize: 13,
              fontWeight: 700, background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`, color: "#555", cursor: "pointer",
            }}>Cancel</button>
          </div>
        )}

        {/* Step: enter — input code */}
        {step === "enter" && (
          <div>
            {success ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>Linked! Reloading…</div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
                  Enter the 6-character code shown on the other device.
                </p>
                <input
                  type="text"
                  value={enteredCode}
                  onChange={e => {
                    setError(null);
                    setEnteredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 7));
                  }}
                  placeholder="XXX-XXX"
                  maxLength={7}
                  style={{
                    textAlign: "center", fontSize: 24, fontFamily: "'DM Mono',monospace",
                    fontWeight: 900, letterSpacing: "0.15em", marginBottom: 12,
                  }}
                />
                {error && (
                  <div style={{ fontSize: 12, color: T.red, marginBottom: 12, lineHeight: 1.4 }}>{error}</div>
                )}
                <button onClick={handleRedeem} disabled={loading || enteredCode.replace(/-/g, "").length < 6} style={{
                  width: "100%", padding: "13px", borderRadius: 10, fontSize: 14,
                  fontWeight: 700, cursor: "pointer", marginBottom: 8,
                  background: loading ? "rgba(255,255,255,0.04)" : "rgba(249,115,22,0.15)",
                  border: `1px solid ${loading ? T.border : "rgba(249,115,22,0.4)"}`,
                  color: loading ? "#444" : T.orange,
                }}>{loading ? "Linking…" : "Link"}</button>
                <button onClick={() => { setStep("choice"); setError(null); setEnteredCode(""); }} style={{
                  width: "100%", padding: "11px", borderRadius: 10, fontSize: 13,
                  fontWeight: 700, background: "none", border: "none", color: "#444", cursor: "pointer",
                }}>← Back</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main SettingsView ─────────────────────────────────────────────────────────
export default function SettingsView({ db }) {
  const [linkModalOpen, setLinkModalOpen]       = useState(false);
  const [confirmClear, setConfirmClear]         = useState(false);

  const uid = getCurrentUid() || auth.currentUser?.uid || "";
  const shortUid = uid ? `${uid.slice(0, 8)}…` : "—";

  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `we-track-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearCache = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div style={{ marginTop: 16, paddingBottom: 32 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Settings</div>

      {/* ── Device & Sync ──────────────────────────────────────────────────── */}
      <SectionLabel label="Device & Sync" />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Device ID</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#444" }}>{shortUid}</div>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.green,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 20, padding: "3px 10px", textTransform: "uppercase",
          }}>Active</div>
        </div>
        <button onClick={() => setLinkModalOpen(true)} style={{
          width: "100%", padding: "11px", borderRadius: 10, fontSize: 13,
          fontWeight: 700, cursor: "pointer",
          background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.35)`,
          color: T.orange,
        }}>Link a device</button>
      </Card>

      {/* ── Account (Phase 2 placeholder) ─────────────────────────────────── */}
      <SectionLabel label="Account" />
      <Card style={{ opacity: 0.5, pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ccc" }}>Google Sign-in coming soon</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3, lineHeight: 1.4 }}>
              Sign in with your Google account to access your data from any device without transfer codes.
            </div>
          </div>
        </div>
      </Card>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <SectionLabel label="About" />
      <Card>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 4 }}>WE TRACK</div>
        <div style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>v{version}</div>
        <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
          Part of the WE CLUTCH platform by{" "}
          <a
            href="https://whittsend.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.orange, textDecoration: "none", fontWeight: 600 }}
          >
            Whitt's End LLC
          </a>
        </div>
      </Card>

      {/* ── Data ──────────────────────────────────────────────────────────── */}
      <SectionLabel label="Data" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ActionBtn label="Export all data" onClick={handleExportAll} />

        {confirmClear ? (
          <Card style={{ border: `1px solid rgba(239,68,68,0.3)` }}>
            <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 12 }}>
              This clears your local cache. Your data in the cloud is safe and will reload automatically.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleClearCache} style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                color: T.red, cursor: "pointer",
              }}>Clear cache</button>
              <button onClick={() => setConfirmClear(false)} style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                color: "#555", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </Card>
        ) : (
          <ActionBtn label="Clear local cache" destructive onClick={() => setConfirmClear(true)} />
        )}
      </div>

      {linkModalOpen && <LinkingModal onClose={() => setLinkModalOpen(false)} />}
    </div>
  );
}
