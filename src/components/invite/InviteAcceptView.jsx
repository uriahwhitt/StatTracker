// ── Invite Acceptance — Phase 2 Gate 3 ───────────────────────────────────────
// Standalone view rendered when URL is /invite/{token}.
// Does not depend on db state — reads directly from Firestore.

import { useState, useEffect } from 'react';
import { T } from '../../utils/constants';
import { db as firestoreDb } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getInvite, markInviteUsed } from '../../utils/invites';
import { writeRoleDoc, getOrgMembers } from '../../utils/roles';
import { signInWithGoogle, signInWithExistingAccount, useAuthUser } from '../../utils/auth';
import { setPendingOrgPath } from '../../utils/storage';

const ROLE_LABELS = {
  headcoach: 'Head Coach',
  assistantcoach: 'Assistant Coach',
  parent: 'Parent',
};

export default function InviteAcceptView({ token }) {
  const user = useAuthUser();

  const [invite, setInvite] = useState(null);
  // State machine: loading → invalid | expired | sign_in_required | ready | accepting | conflict | accepted | error
  const [state, setState] = useState('loading');
  const [conflictName, setConflictName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [pendingCredential, setPendingCredential] = useState(null);

  // Step 1 — load the invite document
  useEffect(() => {
    getInvite(token).then(inv => {
      if (!inv || inv.usedAt) { setState('invalid'); return; }
      if (new Date(inv.expiresAt) < new Date()) { setState('expired'); return; }
      setInvite(inv);
      // Step 2 handled by the auth effect below
    }).catch(() => setState('invalid'));
  }, [token]);

  // Step 2 — once invite is loaded and auth resolves, determine whether sign-in is needed
  useEffect(() => {
    if (!invite) return;
    if (state === 'invalid' || state === 'expired' || state === 'accepted' || state === 'conflict') return;
    if (user === undefined) return; // auth not yet resolved
    if (!user || user.isAnonymous) {
      setState('sign_in_required');
    } else if (state === 'loading' || state === 'sign_in_required') {
      setState('ready');
    }
  }, [invite, user, state]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setErrorMsg('');
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) {
        // no-op
      } else if (result.conflict) {
        setPendingCredential(result.credential);
      }
      // On success: useAuthUser updates → useEffect above advances state to 'ready'
    } catch (err) {
      setErrorMsg(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignInInstead = async () => {
    if (!pendingCredential) return;
    setSigningIn(true);
    setErrorMsg('');
    try {
      await signInWithExistingAccount(pendingCredential);
      setPendingCredential(null);
    } catch (err) {
      setErrorMsg(err.message || 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleAccept = async () => {
    if (!invite || !user || user.isAnonymous) return;
    setState('accepting');
    setErrorMsg('');
    try {
      const uid = user.uid;
      const now = new Date().toISOString();

      // Check for Head Coach conflict
      if (invite.role === 'headcoach') {
        const members = await getOrgMembers(invite.orgId);
        const existingHC = members.find(m =>
          m.role === 'headcoach' &&
          m.teamId === invite.teamId &&
          !m.removedAt &&
          m.uid !== uid
        );
        if (existingHC) {
          const hcName = existingHC.displayName || existingHC.email || 'Existing Head Coach';
          setConflictName(hcName);

          // Write role with pending_conflict status
          await writeRoleDoc(uid, invite.orgId, {
            role: invite.role,
            teamId: invite.teamId,
            grantedByUid: invite.createdByUid,
            grantedAt: now,
            status: 'pending_conflict',
          }, {
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || null,
          });
          await markInviteUsed(token, uid);

          // Notify org owner
          const owner = members.find(m => m.role === 'owner' && !m.removedAt);
          if (owner) {
            await setDoc(doc(firestoreDb, `users/${owner.uid}/notifications/${crypto.randomUUID()}`), {
              type: 'role_conflict',
              message: `${user.displayName || user.email} accepted a Head Coach invite for ${invite.teamName}, but ${hcName} is already Head Coach. Resolve in Manage → Team → Members.`,
              orgId: invite.orgId,
              teamId: invite.teamId,
              createdAt: now,
              read: false,
            }).catch(() => {});
          }

          // Prime org path so the app loads correctly after redirect
          setPendingOrgPath(`orgs/${invite.orgId}/data/db`);
          setState('conflict');
          return;
        }
      }

      // No conflict — write active role
      await writeRoleDoc(uid, invite.orgId, {
        role: invite.role,
        teamId: invite.teamId,
        grantedByUid: invite.createdByUid,
        grantedAt: now,
        status: 'active',
      }, {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || null,
      });
      await markInviteUsed(token, uid);

      // Prime the org path cache so loadDb() routes correctly after page reload
      setPendingOrgPath(`orgs/${invite.orgId}/data/db`);
      setState('accepted');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to accept invite. Please try again.');
      setState('ready');
    }
  };

  const goToApp = () => {
    window.location.href = window.location.origin;
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const containerStyle = {
    minHeight: '100vh',
    background: T.bg,
    color: '#fff',
    fontFamily: "'DM Sans',sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
  };
  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 16,
    padding: '28px 24px',
    maxWidth: 420,
    width: '100%',
  };

  // ── Static states ──────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#444', fontSize: 14 }}>Loading invite…</div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Invalid Invite</div>
          <div style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>
            This invite link is invalid or has already been used.
          </div>
          <PrimaryBtn onClick={goToApp} style={{ marginTop: 20 }}>Go to App</PrimaryBtn>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Invite Expired</div>
          <div style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>
            This invite link has expired. Ask your coach to generate a new one.
          </div>
          <PrimaryBtn onClick={goToApp} style={{ marginTop: 20 }}>Go to App</PrimaryBtn>
        </div>
      </div>
    );
  }

  if (state === 'accepted') {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: T.green }}>
            You're all set!
          </div>
          <div style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Welcome to <strong style={{ color: '#fff' }}>{invite?.orgName}</strong>.
            You're set up as{' '}
            <strong style={{ color: T.orange }}>
              {ROLE_LABELS[invite?.role] || invite?.role}
            </strong>{' '}
            for <strong style={{ color: '#fff' }}>{invite?.teamName}</strong>.
          </div>
          <PrimaryBtn onClick={goToApp}>Open App</PrimaryBtn>
        </div>
      </div>
    );
  }

  if (state === 'conflict') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Role Conflict</div>
          <div style={{
            background: 'rgba(249,115,22,0.08)', border: `1px solid rgba(249,115,22,0.25)`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, lineHeight: 1.6,
          }}>
            This team already has a Head Coach (<strong>{conflictName}</strong>).
            The org owner has been notified to resolve the role assignment.
          </div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
            Your access is pending. You'll be able to use the app once the conflict is resolved.
          </div>
          <PrimaryBtn onClick={goToApp}>Go to App</PrimaryBtn>
        </div>
      </div>
    );
  }

  // ── sign_in_required | ready | accepting ──────────────────────────────────
  const isAccepting = state === 'accepting';

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{
          fontSize: 10, color: '#555', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
        }}>
          Team Invitation
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          {invite?.orgName}
        </div>
        <div style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          You've been invited to join as{' '}
          <strong style={{ color: T.orange }}>
            {ROLE_LABELS[invite?.role] || invite?.role}
          </strong>{' '}
          for <strong style={{ color: '#fff' }}>{invite?.teamName}</strong>.
        </div>

        {errorMsg && (
          <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{errorMsg}</div>
        )}

        {/* Conflict resolution — switch to existing Google account */}
        {pendingCredential ? (
          <div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
              This Google account is already linked to an existing account.
              Sign in with that account instead?
            </div>
            <PrimaryBtn onClick={handleSignInInstead} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in with existing account'}
            </PrimaryBtn>
            <SecondaryBtn onClick={() => setPendingCredential(null)} style={{ marginTop: 8 }}>
              Cancel
            </SecondaryBtn>
          </div>
        ) : state === 'sign_in_required' ? (
          <>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Sign in with Google to accept this invitation.
            </div>
            <PrimaryBtn onClick={handleSignIn} disabled={signingIn}>
              {signingIn ? 'Signing in…' : 'Sign in with Google'}
            </PrimaryBtn>
          </>
        ) : (
          <>
            {user && (
              <div style={{ color: '#555', fontSize: 12, marginBottom: 14 }}>
                Signed in as <strong style={{ color: '#777' }}>{user.email}</strong>
              </div>
            )}
            <PrimaryBtn onClick={handleAccept} disabled={isAccepting}>
              {isAccepting ? 'Setting up your access…' : 'Accept Invitation'}
            </PrimaryBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function PrimaryBtn({ onClick, disabled, children, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '13px', borderRadius: 10, fontSize: 14,
        fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(249,115,22,0.15)',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : T.orange}`,
        color: disabled ? '#444' : T.orange,
        display: 'block',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '11px', borderRadius: 10, fontSize: 13,
        fontWeight: 600, cursor: 'pointer',
        background: 'transparent',
        border: `1px solid rgba(255,255,255,0.1)`,
        color: '#555',
        display: 'block',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
