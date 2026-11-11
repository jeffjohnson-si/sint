import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { BackIcon } from '../components/icons.jsx';
import { DevLogin } from '../components/DevLogin.jsx';

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await signIn(email.trim(), password);
      navigate(data.user.emailVerified ? from : '/verify-email', { replace: true });
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link to="/welcome" className="auth-back">
          <BackIcon /> Back
        </Link>

        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <div>
            <div className="auth-title">Welcome back</div>
            <div className="muted small">Sign in to SINT — Solomon Islands Net Trade</div>
          </div>
        </div>

        <form className="stack" onSubmit={submit}>
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

          <label className="field">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          <div className="row between">
            <span />
            <Link to="/forgot" className="small bold">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          New to SINT? <Link to="/signup">Create an account</Link>
        </p>

        <DevLogin />
      </div>
    </div>
  );
}
