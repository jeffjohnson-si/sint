import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as sint from '../lib/sint.js';
import { ChipsSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';

/**
 * Shown once after sign up. The picks seed the same interest scores that likes,
 * follows and searches build up later, so the For You feed has a starting point.
 */
export default function Interests() {
  const navigate = useNavigate();
  const toast = useToast();

  const [options, setOptions] = useState([]);
  const [picked, setPicked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sint
      .categories()
      .then((data) => setOptions((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (category) => {
    setPicked((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      if (picked.length) await sint.saveInterests(picked);
      navigate('/', { replace: true });
    } catch (problem) {
      toast.error(problem.message);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-form">
        <ChipsSkeleton count={8} />
      </div>
    );
  }

  return (
    <div className="page page-form">
      <h1 style={{ marginBottom: 6 }}>What are you into?</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Pick a few categories and your feed will lean towards them. You can skip this — it is a
        nudge, not a filter, so everything still shows up.
      </p>

      <div className="row wrap" style={{ gap: 8, marginBottom: 24 }}>
        {options.map((category) => (
          <button
            key={category}
            type="button"
            className={picked.includes(category) ? 'chip active' : 'chip'}
            onClick={() => toggle(category)}
            aria-pressed={picked.includes(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <button type="button" className="btn btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : picked.length ? `Show me ${picked.length} categories` : 'Skip for now'}
      </button>
    </div>
  );
}
