import { useState, useEffect, useRef } from "react";
import { T } from "../../utils/constants";
import { auth } from "../../firebase";
import { getCurrentUid, invalidatePathCache } from "../../utils/storage";
import {
  signInWithGoogle,
  signInWithExistingAccount,
  signOutUser,
  useAuthUser,
} from "../../utils/auth";
import {
  createTransferCode,
  deleteTransferCode,
  redeemTransferCode,
  refreshFromSource,
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

// ── Google sign-in button ─────────────────────────────────────────────────────
function GoogleSignInButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", padding: "13px 16px", borderRadius: 10,
        fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: loading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${loading ? T.border : "rgba(255,255,255,0.2)"}`,
        color: loading ? "#444" : "#fff",
        transition: "background 0.15s",
      }}
    >
      {!loading && (
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {loading ? "Signing in…" : "Sign in with Google"}
    </button>
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

// ── Sync timestamp formatter — "Mar 22 at 9:41 AM" ───────────────────────────
const fmtSyncTime = (isoStr) => {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
};

// ── Main SettingsView ─────────────────────────────────────────────────────────
export default function SettingsView({ db }) {
  const user = useAuthUser();
  const isAuthenticated = user && !user.isAnonymous;

  const [linkModalOpen, setLinkModalOpen]   = useState(false);
  const [confirmClear, setConfirmClear]     = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Sign-in state
  const [signingIn, setSigningIn]           = useState(false);
  const [signInError, setSignInError]       = useState(null);
  const [pendingCredential, setPendingCredential] = useState(null); // conflict case

  // Linked device state (anonymous only)
  const linkedFromUid                       = localStorage.getItem('linked_from_uid');
  const [lastSyncAt, setLastSyncAt]         = useState(() => localStorage.getItem('last_sync_at'));
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [syncError, setSyncError]           = useState(null);
  const [syncSuccess, setSyncSuccess]       = useState(false);

  const uid = getCurrentUid() || auth.currentUser?.uid || "";
  const shortUid = uid ? `${uid.slice(0, 8)}…` : "—";

  const handleRefresh = async () => {
    setSyncing(true);
    setSyncError(null);
    setConfirmRefresh(false);
    try {
      await refreshFromSource(uid);
      setLastSyncAt(localStorage.getItem('last_sync_at'));
      setSyncSuccess(true);
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setSyncError("Sync failed — make sure the source device has been used recently.");
      setSyncing(false);
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    setPendingCredential(null);
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) {
        // User closed popup — no action needed
      } else if (result.conflict) {
        // Google account belongs to a different Firebase UID
        setPendingCredential(result.credential);
      }
      // On success (result.user), the auth state listener in useAuthUser
      // will update automatically — no extra action needed
    } catch (err) {
      setSignInError(err.message || "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignInInstead = async () => {
    if (!pendingCredential) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      invalidatePathCache();
      await signInWithExistingAccount(pendingCredential);
      setPendingCredential(null);
      // Reload so Firestore data from the existing account loads
      window.location.reload();
    } catch (err) {
      setSignInError(err.message || "Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    invalidatePathCache();
    await signOutUser();
    setConfirmSignOut(false);
    window.location.reload();
  };

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

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <SectionLabel label="Account" />

      {isAuthenticated ? (
        /* ── Authenticated state ─── */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Profile card */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || ""}
                  style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, border: `2px solid ${T.border}` }}
                />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(249,115,22,0.2)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 20, fontWeight: 900, color: T.orange,
                }}>
                  {(user.displayName || "?")[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.displayName || "Google Account"}
                </div>
                <div style={{ fontSize: 12, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
            </div>
          </Card>

          {/* My Teams (placeholder) */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#ccc", marginBottom: 8 }}>My Teams</div>
            <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5 }}>
              No team memberships yet. Ask your coach for a join code to get started.
            </div>
          </Card>

          {/* Sign out */}
          {confirmSignOut ? (
            <Card style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 12 }}>
                Sign out of your Google account? You'll continue as an anonymous user on this device.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSignOut} style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                  color: T.red, cursor: "pointer",
                }}>Sign out</button>
                <button onClick={() => setConfirmSignOut(false)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                  color: "#555", cursor: "pointer",
                }}>Cancel</button>
              </div>
            </Card>
          ) : (
            <ActionBtn label="Sign out" destructive onClick={() => setConfirmSignOut(true)} />
          )}
        </div>
      ) : (
        /* ── Anonymous state ─── */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* CTA banner */}
          <Card style={{ border: "1px solid rgba(249,115,22,0.2)", background: "rgba(249,115,22,0.06)" }}>
            <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55 }}>
              Sign in with Google to join teams, sync across devices, and access live game feeds.
            </div>
          </Card>

          {/* Conflict resolution */}
          {pendingCredential && (
            <Card style={{ border: "1px solid rgba(59,130,246,0.3)" }}>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5, marginBottom: 12 }}>
                This Google account is already linked to another device. Sign in with that account instead? Your data on this device will be replaced.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSignInInstead} disabled={signingIn} style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)",
                  color: T.blue, cursor: "pointer",
                }}>{signingIn ? "Signing in…" : "Sign in instead"}</button>
                <button onClick={() => setPendingCredential(null)} style={{
                  flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                  color: "#555", cursor: "pointer",
                }}>Cancel</button>
              </div>
            </Card>
          )}

          {signInError && (
            <div style={{ fontSize: 12, color: T.red, lineHeight: 1.4 }}>{signInError}</div>
          )}

          <GoogleSignInButton onClick={handleSignIn} loading={signingIn} />
        </div>
      )}

      {/* ── Device & Sync (anonymous only — authenticated users don't need transfer codes) */}
      {!isAuthenticated && (
        <>
          <SectionLabel label="Device & Sync" />
          <Card>
            {/* Device ID row + status badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Device ID</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#444" }}>{shortUid}</div>
                {linkedFromUid && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                    {lastSyncAt
                      ? `Last synced: ${fmtSyncTime(lastSyncAt)}`
                      : "Synced at link time"}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: linkedFromUid ? T.blue : T.green,
                background: linkedFromUid ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)",
                border: `1px solid ${linkedFromUid ? "rgba(59,130,246,0.25)" : "rgba(34,197,94,0.25)"}`,
                borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", flexShrink: 0,
              }}>{linkedFromUid ? "Linked" : "Active"}</div>
            </div>

            {/* Feedback messages */}
            {syncSuccess && (
              <div style={{ fontSize: 12, color: T.green, marginBottom: 10, fontWeight: 600 }}>
                Synced successfully — reloading…
              </div>
            )}
            {syncError && (
              <div style={{ fontSize: 12, color: T.red, marginBottom: 10, lineHeight: 1.4 }}>
                {syncError}
              </div>
            )}

            {/* Confirm refresh prompt */}
            {confirmRefresh && (
              <div style={{
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 10, padding: "12px", marginBottom: 10,
              }}>
                <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.5, marginBottom: 10 }}>
                  This will overwrite your local data with the latest from the source device. Your current data will be replaced. Continue?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleRefresh} style={{
                    flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)",
                    color: T.blue, cursor: "pointer",
                  }}>Yes, sync now</button>
                  <button onClick={() => setConfirmRefresh(false)} style={{
                    flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                    color: "#555", cursor: "pointer",
                  }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLinkModalOpen(true)} style={{
                flex: 1, padding: "11px", borderRadius: 10, fontSize: 13,
                fontWeight: 700, cursor: "pointer",
                background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.35)`,
                color: T.orange,
              }}>Link a device</button>

              {linkedFromUid && (
                <button
                  onClick={() => { setSyncError(null); setConfirmRefresh(true); }}
                  disabled={syncing || syncSuccess}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 10, fontSize: 13,
                    fontWeight: 700, cursor: syncing || syncSuccess ? "default" : "pointer",
                    background: syncing || syncSuccess ? "rgba(255,255,255,0.04)" : "rgba(59,130,246,0.15)",
                    border: `1px solid ${syncing || syncSuccess ? T.border : "rgba(59,130,246,0.35)"}`,
                    color: syncing || syncSuccess ? "#333" : T.blue,
                  }}
                >{syncing ? "Syncing…" : "Refresh from source"}</button>
              )}
            </div>
          </Card>
        </>
      )}

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
