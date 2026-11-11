import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword, verifyResetCode } from '../lib/sint.js';
import { useToast } from '../components/Toast.jsx';

/**
 * Three steps, matching the API: request a code, verify it for a short-lived
 * token, then set the new password with that token.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await forgotPassword(email.trim());
      setDevCode(data.devCode ?? '');
      setStep('code');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await verifyResetCode(email.trim(), code.trim());
      setResetToken(data.accessToken);
      setStep('password');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await resetPassword(password, resetToken);
      toast.success('Password updated. Sign in with your new password.');
      navigate('/signin', { replace: true });
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <div>
            <div className="auth-title">Reset your password</div>
            <div className="muted small">
              {step === 'email' ? 'We will send a 6-digit code' : null}
              {step === 'code' ? `Enter the code sent to ${email}` : null}
              {step === 'password' ? 'Choose a new password' : null}
            </div>
          </div>
        </div>

        {step === 'email' ? (
          <form className="stack" onSubmit={requestCode}>
            {error ? <div className="form-error">{error}</div> : null}
            <label className="field">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : null}

        {step === 'code' ? (
          <form className="stack" onSubmit={checkCode}>
            {error ? <div className="form-error">{error}</div> : null}
            {devCode ? (
              <div className="notice">
                Development build — no email was sent. Your code is <b>{devCode}</b>.
              </div>
            ) : null}
            <label className="field">
              <span className="label">6-digit code</span>
              <input
                className="input"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                required
                pattern="\d{6}"
              />
            </label>
            <button type="submit" className="btn btn-block" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setStep('email')}
            >
              Use a different email
            </button>
          </form>
        ) : null}

        {step === 'password' ? (
          <form className="stack" onSubmit={savePassword}>
            {error ? <div className="form-error">{error}</div> : null}
            <label className="field">
              <span className="label">New password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </label>
            <button type="submit" className="btn btn-block" disabled={busy}>
              {busy ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        ) : null}

        <p className="auth-switch">
          <Link to="/signin">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
