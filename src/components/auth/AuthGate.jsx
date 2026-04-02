// ── Auth Gate — Phase 2 Gate 4 ────────────────────────────────────────────────
// Shown to anonymous users. Only entry point to the app for unauthenticated users.
// Two paths: Sign in with Google, or Join a Team with a code.

import { useState } from 'react';
import { T } from '../../utils/constants';
import { signInWithGoogle, signInWithExistingAccount } from '../../utils/auth';
import { lookupJoinCode, redeemJoinCode } from '../../utils/joinCode';
import { setPendingOrgPath } from '../../utils/storage';

export default function AuthGate() {
  const [mode, setMode] = useState('home'); // 'home' | 'join'
  const [code, setCode] = useState('');
  const [codeInfo, setCodeInfo] = useState(null);   // { orgName, teamName, orgId, teamId }
  const [lookingUp, setLookingUp] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [pendingCredential, setPendingCredential] = useState(null);
  const [error, setError] = useState('');

  // ── Step 1: look up the code ──────────────────────────────────────────────
  const handleLookup = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) { setError('Enter the 6-character team code.'); return; }
    setLookingUp(true);
    setError('');
    const result = await lookupJoinCode(trimmed);
    setLookingUp(false);
    if (!result) { setError('Code not found or no longer active. Check with your coach.'); return; }
    setCodeInfo(result);
  };

  // ── Step 2: sign in and redeem ────────────────────────────────────────────
  const handleSignInAndJoin = async () => {
    if (!codeInfo) return;
    setSigningIn(true);
    setError('');
    try {
      // Store join intent so the redirect handler in App.jsx can complete it
      sessionStorage.setItem('_auth_intent', JSON.stringify({
        type: 'join',
        code: codeInfo.code,
        orgId: codeInfo.orgId,
        teamId: codeInfo.teamId,
      }));
      const result = await signInWithGoogle();
      if (result.redirecting) return; // browser navigates away
      if (result.cancelled) { sessionStorage.removeItem('_auth_intent'); setSigningIn(false); return; }
      if (result.conflict) {
        sessionStorage.removeItem('_auth_intent');
        setPendingCredential(result.credential);
        setSigningIn(false);
        return;
      }
      // Popup flow — redeem immediately
      const { user } = result;
      await redeemJoinCode(codeInfo.code, user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      setPendingOrgPath(`orgs/${codeInfo.orgId}/data/db`);
      window.location.reload();
    } catch (err) {
      sessionStorage.removeItem('_auth_intent');
      setError(err.message || 'Sign-in failed. Please try again.');
      setSigningIn(false);
    }
  };

  const handleSignInInstead = async () => {
    if (!pendingCredential) return;
    setSigningIn(true);
    setError('');
    try {
      const user = await signInWithExistingAccount(pendingCredential);
      await redeemJoinCode(codeInfo.code, user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      setPendingOrgPath(`orgs/${codeInfo.orgId}/data/db`);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
      setSigningIn(false);
    }
  };

  // ── Plain Google sign-in (from home) ─────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      sessionStorage.setItem('_auth_intent', JSON.stringify({ type: 'signin' }));
      const result = await signInWithGoogle();
      if (result.redirecting) return; // browser navigates away
      sessionStorage.removeItem('_auth_intent');
      if (result.cancelled) { setSigningIn(false); return; }
      if (result.conflict) {
        setPendingCredential(result.credential);
        setMode('conflict');
        setSigningIn(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      sessionStorage.removeItem('_auth_intent');
      setError(err.message || 'Sign-in failed.');
      setSigningIn(false);
    }
  };

  const handleSignInConflict = async () => {
    if (!pendingCredential) return;
    setSigningIn(true);
    try {
      await signInWithExistingAccount(pendingCredential);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
      setSigningIn(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: T.bg, color: '#fff',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input { outline: none; color: #fff; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
          padding: 12px 14px; font-size: 16px; width: 100%;
          font-family: 'DM Sans', sans-serif; letter-spacing: 0.08em; }
        input::placeholder { color: #444; letter-spacing: 0; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div style={{ maxWidth: 400, width: '100%' }}>

        {/* Logo / wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>WE TRACK</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Basketball</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.orange, lineHeight: 1.1 }}>Stat Tracker</div>
        </div>

        {/* ── Home ── */}
        {mode === 'home' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Welcome</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
              Sign in to access your team's stats, game history, and live game feed.
            </div>

            {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

            {mode === 'conflict' ? null : (
              <>
                <GoogleBtn onClick={handleGoogleSignIn} loading={signingIn} label="Sign in with Google" />
                <div style={{ textAlign: 'center', color: '#444', fontSize: 12, margin: '16px 0' }}>— or —</div>
                <OutlineBtn onClick={() => { setMode('join'); setError(''); }}>
                  Join a Team with a Code
                </OutlineBtn>
              </>
            )}
          </div>
        )}

        {/* ── Conflict resolution from home sign-in ── */}
        {mode === 'conflict' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px' }}>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 16, lineHeight: 1.6 }}>
              This Google account is linked to an existing account. Sign in with that account instead?
            </div>
            {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <GoogleBtn onClick={handleSignInConflict} loading={signingIn} label={signingIn ? 'Signing in…' : 'Sign in with existing account'} />
            <OutlineBtn onClick={() => { setMode('home'); setPendingCredential(null); setError(''); }} style={{ marginTop: 8 }}>Cancel</OutlineBtn>
          </div>
        )}

        {/* ── Join a team ── */}
        {mode === 'join' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px' }}>

            {!codeInfo ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Join a Team</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
                  Enter the 6-character code your coach shared with you.
                </div>
                {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <input
                  placeholder="XXXXXX"
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 12 }}
                />
                <OrangeBtn onClick={handleLookup} disabled={lookingUp || code.length !== 6}>
                  {lookingUp ? 'Looking up…' : 'Find Team'}
                </OrangeBtn>
                <OutlineBtn onClick={() => { setMode('home'); setCode(''); setError(''); }} style={{ marginTop: 8 }}>Back</OutlineBtn>
              </>
            ) : !pendingCredential ? (
              <>
                <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Team Found</div>
                <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{codeInfo.orgName}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{codeInfo.teamName}</div>
                  <div style={{ fontSize: 11, color: T.orange, fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Parent</div>
                </div>
                {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
                  Sign in with Google to join this team.
                </div>
                <GoogleBtn onClick={handleSignInAndJoin} loading={signingIn} label={signingIn ? 'Signing in…' : 'Sign in & Join Team'} />
                <OutlineBtn onClick={() => { setCodeInfo(null); setCode(''); setError(''); }} style={{ marginTop: 8 }}>Back</OutlineBtn>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 1.6 }}>
                  This Google account is linked to an existing account. Sign in with that account instead?
                </div>
                {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <GoogleBtn onClick={handleSignInInstead} loading={signingIn} label={signingIn ? 'Signing in…' : 'Sign in with existing account'} />
                <OutlineBtn onClick={() => setPendingCredential(null)} style={{ marginTop: 8 }}>Cancel</OutlineBtn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function GoogleBtn({ onClick, loading, label }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
      cursor: loading ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
      border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)'}`,
      color: loading ? '#444' : '#fff',
    }}>
      {!loading && (
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {label}
    </button>
  );
}

function OrangeBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(249,115,22,0.15)',
      border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : T.orange}`,
      color: disabled ? '#444' : T.orange,
    }}>{children}</button>
  );
}

function OutlineBtn({ onClick, children, style }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', background: 'transparent',
      border: '1px solid rgba(255,255,255,0.1)', color: '#555',
      ...style,
    }}>{children}</button>
  );
}
