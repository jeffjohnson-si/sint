import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { devLogin } from '../lib/sint.js';

const ACCOUNTS = [
  { key: 'business', label: 'Demo business', note: 'yearly plan · verified · can publish' },
  { key: 'customer', label: 'Demo customer', note: 'normal user · follows, chats, likes' },
];

/**
 * Development shortcut so reloading does not mean retyping credentials. The
 * API side is a 404 once NODE_ENV=production, and this branch is compiled out
 * of production builds (import.meta.env.DEV is a literal false there).
 */
export function DevLogin() {
  const { acceptSession } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (!import.meta.env.DEV) return null;

  const enter = async (account) => {
    setBusy(account);
    setError('');
    try {
      acceptSession(await devLogin(account));
      navigate('/', { replace: true });
    } catch (problem) {
      setError(problem.message);
      setBusy('');
    }
  };

  return (
    <section className="dev-panel">
      <div className="dev-panel-head">Development only</div>
      <p className="tiny muted" style={{ marginBottom: 10 }}>
        Skip the forms with a seeded demo account.
      </p>

      <div className="stack" style={{ gap: 6 }}>
        {ACCOUNTS.map((account) => (
          <button
            key={account.key}
            type="button"
            className="dev-account"
            onClick={() => enter(account.key)}
            disabled={Boolean(busy)}
          >
            <span className="dev-account-label">
              {busy === account.key ? 'Signing in…' : account.label}
            </span>
            <span className="dev-account-note">{account.note}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="error-text" style={{ marginTop: 9 }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
