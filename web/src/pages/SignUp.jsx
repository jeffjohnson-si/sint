import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { categories as fetchCategories } from '../lib/sint.js';
import { StoreIcon, UserIcon } from '../components/icons.jsx';

const BUSINESS_TYPES = [
  { value: 'business', label: 'Business' },
  { value: 'company', label: 'Company' },
  { value: 'freelancer', label: 'Freelancer / self-employed' },
];

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState('user');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    businessType: 'business',
    category: '',
    location: '',
    phone: '',
    bio: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then((data) => setOptions((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setOptions([]));
  }, []);

  const isBusiness = kind === 'business';
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await signUp({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        accountType: isBusiness ? form.businessType : 'user',
        acceptedTerms,
        ...(isBusiness
          ? {
              category: form.category,
              location: form.location.trim(),
              ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
              ...(form.bio.trim() ? { bio: form.bio.trim() } : {}),
            }
          : {}),
      });
      // The address has to be confirmed before the feed opens. The dev code is
      // kept in sessionStorage because the redirect below can race GuestOnly's
      // own redirect, which would drop the router state.
      if (data.devCode) sessionStorage.setItem('sint.devCode', data.devCode);
      navigate('/verify-email', { replace: true, state: { devCode: data.devCode } });
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
            <div className="auth-title">Create your account</div>
            <div className="muted small">Start with what kind of account you need</div>
          </div>
        </div>

        <div className="choice-grid" role="radiogroup" aria-label="Account type">
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'user'}
            className={kind === 'user' ? 'choice active' : 'choice'}
            onClick={() => setKind('user')}
          >
            <UserIcon />
            <span className="choice-title">Normal user</span>
            <span className="choice-sub">Follow, like, comment and message</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={kind === 'business'}
            className={kind === 'business' ? 'choice active' : 'choice'}
            onClick={() => setKind('business')}
          >
            <StoreIcon />
            <span className="choice-title">Business</span>
            <span className="choice-sub">Post, get found, be messaged</span>
          </button>
        </div>

        <form className="stack" onSubmit={submit}>
          {error ? <div className="form-error">{error}</div> : null}

          <label className="field">
            <span className="label">{isBusiness ? 'Business name' : 'Full name'}</span>
            <input
              className="input"
              value={form.fullName}
              onChange={set('fullName')}
              autoComplete={isBusiness ? 'organization' : 'name'}
              placeholder={isBusiness ? 'Lime Lounge' : 'Peter Maelanga'}
              required
              minLength={2}
            />
          </label>

          {isBusiness ? (
            <>
              <label className="field">
                <span className="label">Business type</span>
                <select className="select" value={form.businessType} onChange={set('businessType')}>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Category</span>
                <select className="select" value={form.category} onChange={set('category')} required>
                  <option value="">Choose a category</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">Based in</span>
                <input
                  className="input"
                  value={form.location}
                  onChange={set('location')}
                  placeholder="Honiara"
                  required
                />
              </label>

              <label className="field">
                <span className="label">
                  Phone <span className="muted tiny">optional</span>
                </span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={set('phone')}
                  inputMode="tel"
                  placeholder="+677 1234"
                />
              </label>

              <label className="field">
                <span className="label">
                  Short description <span className="muted tiny">optional</span>
                </span>
                <textarea
                  className="textarea"
                  value={form.bio}
                  onChange={set('bio')}
                  maxLength={1000}
                  placeholder="What do you sell or do?"
                />
              </label>
            </>
          ) : null}

          <label className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set('email')}
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
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <span>I agree to the SINT Terms &amp; Conditions.</span>
          </label>

          {isBusiness ? (
            <p className="hint">
              Businesses start on a 14 day free trial. You can post straight away — no card needed.
            </p>
          ) : null}

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
