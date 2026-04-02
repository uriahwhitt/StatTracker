// ── Join Code Panel — Phase 2 Gate 4 ─────────────────────────────────────────
// Sheet modal for displaying and regenerating a team's parent join code.

import { useState, useEffect } from 'react';
import { T } from '../../utils/constants';
import { createJoinCode, getActiveJoinCode } from '../../utils/joinCode';

export default function JoinCodePanel({ orgId, teamId, teamName, orgName, user, onClose }) {
  const [codeDoc, setCodeDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveJoinCode(orgId, teamId).then(doc => {
      setCodeDoc(doc);
      setLoading(false);
    });
  }, [orgId, teamId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const code = await createJoinCode({
        orgId, teamId, teamName, orgName,
        createdByUid: user?.uid || '',
      });
      setCodeDoc({ code, orgId, teamId, teamName, orgName, active: true });
    } catch (err) {
      setError(err.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!codeDoc?.code) return;
    navigator.clipboard.writeText(codeDoc.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#0f0f18', borderTop: `1px solid ${T.border}`,
        borderRadius: '16px 16px 0 0', width: '100%',
        padding: '20px 16px 40px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Parent Join Code</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 2 }}>{teamName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Loading…</div>
        ) : codeDoc ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Share this code with parents
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 44, fontWeight: 900,
                color: T.orange, letterSpacing: '0.2em',
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 12, padding: '16px 24px', display: 'inline-block',
              }}>
                {codeDoc.code}
              </div>
              <div style={{ fontSize: 12, color: '#444', marginTop: 10 }}>
                Reusable · Expires when regenerated
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={handleCopy} style={{
                flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                border: `1px solid ${copied ? T.green : T.orange}`,
                color: copied ? T.green : T.orange,
              }}>{copied ? 'Copied!' : 'Copy Code'}</button>
              <button onClick={handleGenerate} disabled={generating} style={{
                flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: generating ? 'default' : 'pointer',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: '#555',
              }}>{generating ? 'Generating…' : 'New Code'}</button>
            </div>
            <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5, textAlign: 'center' }}>
              Generating a new code invalidates the current one.
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16, lineHeight: 1.5, textAlign: 'center' }}>
              No join code yet. Generate one to let parents join this team.
            </div>
            <button onClick={handleGenerate} disabled={generating} style={{
              width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: generating ? 'default' : 'pointer',
              background: generating ? 'rgba(255,255,255,0.04)' : 'rgba(249,115,22,0.12)',
              border: `1px solid ${generating ? T.border : T.orange}`,
              color: generating ? '#444' : T.orange,
            }}>{generating ? 'Generating…' : 'Generate Join Code'}</button>
          </>
        )}
      </div>
    </div>
  );
}
