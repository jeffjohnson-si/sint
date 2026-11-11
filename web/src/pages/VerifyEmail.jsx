import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { resendVerification, verifyEmail } from '../lib/sint.js';
import { useToast } from '../components/Toast.jsx';

/**
 * Step 1 of 2 after signing up: confirm the email address with the 6-digit
 * code. Development has no SMTP, so the API echoes the code and it is shown in
 * the notice below.
 */
export default function VerifyEmail() {
  const { user, signOut, reloadUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(
    location.state?.devCode || sessionStorage.getItem('sint.devCode') || '',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  // Already confirmed (a returning tab, or straight after submitting below):
  // this screen has nothing left to do, so move on to the profile set up.
  if (user?.emailVerified) return <Navigate to="/setup" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await verifyEmail(user.email, code.trim());
      sessionStorage.removeItem('sint.devCode');
      await reloadUser();
      // Step 2 of 2: the optional profile set up.
      navigate('/setup', { replace: true });
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const data = await resendVerification(user.email);
      if (data.devCode) {
        setDevCode(data.devCode);
        sessionStorage.setItem('sint.devCode', data.devCode);
      }
      toast.success('New code sent');
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <div>
            <div className="auth-title">Confirm your email</div>
            <div className="muted small">Step 1 of 2</div>
          </div>
        </div>

        <p className="small" style={{ marginBottom: 18 }}>
          We sent a 6-digit code to <b>{user?.email}</b>. Enter it to activate your account.
        </p>

        <form className="stack" onSubmit={submit}>
          {error ? <div className="form-error">{error}</div> : null}

          {devCode ? (
            <div className="notice">
              <div>
                Development build — no email is sent. Your code is <b>{devCode}</b>.
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCode(devCode)}
                style={{ paddingLeft: 0, marginTop: 4 }}
              >
                Fill it in
              </button>
            </div>
          ) : null}

          <label className="field">
            <span className="label">6-digit code</span>
            <input
              className="input code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              required
            />
          </label>

          <button type="submit" className="btn btn-block" disabled={busy || code.length !== 6}>
            {busy ? 'Confirming…' : 'Confirm email'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={resend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Send a new code'}
          </button>
        </form>

        <p className="auth-switch">
          Wrong address?{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              signOut();
              navigate('/signin', { replace: true });
            }}
          >
            Use another account
          </button>
        </p>
      </div>
    </div>
  );
}
