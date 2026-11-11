import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { Empty } from '../components/Ui.jsx';
import { SearchSkeleton, ChipsSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { SearchIcon } from '../components/icons.jsx';
import { accountTypeLabel } from '../lib/format.js';

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [items, setItems] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followingId, setFollowingId] = useState('');

  useEffect(() => {
    sint
      .categories()
      .then((data) => setCategories((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesReady(true));
  }, []);

  useEffect(() => {
    sint
      .suggestions(10)
      .then((data) => setSuggested(data.items ?? []))
      .catch(() => setSuggested([]));
  }, []);

  // Live search: wait for a pause in typing so a slow connection is not hit on
  // every keystroke.
  useEffect(() => {
    const term = query.trim();
    const browsingCategory = category !== 'All';

    if (!term && !browsingCategory) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await sint.searchBusinesses({ query: term, category });
        setItems(data.items ?? []);
        setSearched(true);
      } catch (problem) {
        toast.error(problem.message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query, category, toast]);

  const toggleFollow = async (business) => {
    if (!user) {
      navigate('/signin', { state: { from: '/search' } });
      return;
    }

    setFollowingId(business.id);
    try {
      const data = await sint.setFollowing(business.id, !business.isFollowing);
      const patch = (list) =>
        list.map((item) =>
          item.id === business.id ? { ...item, isFollowing: data.user.isFollowing } : item,
        );
      setItems(patch);
      setSuggested(patch);
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setFollowingId('');
    }
  };

  const results = searched ? items : [];
  const showEmpty = searched && !loading && results.length === 0;

  return (
    <div className="page page-search">
      <h1 style={{ marginBottom: 12 }}>Search</h1>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'grid',
          }}
        >
          <SearchIcon width={18} height={18} style={{ stroke: 'var(--grey-400)', fill: 'none' }} />
        </span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search businesses, food, tours, health…"
          style={{ paddingLeft: 38 }}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ position: 'absolute', right: 4, top: 4 }}
            onClick={() => setQuery('')}
          >
            Clear
          </button>
        ) : null}
      </div>

      {categoriesReady ? (
        <div className="chips">
          {['All', ...categories].map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? 'chip active' : 'chip'}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : (
        <ChipsSkeleton count={7} />
      )}

      {loading && results.length === 0 ? <SearchSkeleton count={4} /> : null}

      {showEmpty ? (
        <Empty title="No businesses found">
          Try a different word — “food”, “travel”, “health”, “shop” — or browse a category.
        </Empty>
      ) : null}

      {!loading && results.length > 0 ? (
        <div>
          <div className="panel-title">
            {results.length} {results.length === 1 ? 'business' : 'businesses'}
          </div>
          {results.map((business) => (
            <div key={business.id} className="user-row">
              <Link to={`/u/${business.id}`}>
                <Avatar name={business.fullName} src={business.avatarUrl} />
              </Link>

              <div className="user-row-main">
                <Link to={`/u/${business.id}`} className="user-row-name">
                  {business.fullName}
                  <VerifiedBadge show={business.isVerified} />
                </Link>
                <div className="user-row-sub">
                  {[business.category || accountTypeLabel(business.accountType), business.location]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <button
                type="button"
                className={business.isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-sm'}
                onClick={() => toggleFollow(business)}
                disabled={followingId === business.id}
              >
                {business.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {!searched && !loading ? (
        <section style={{ marginTop: 20 }}>
          <div className="panel-title">Suggested businesses</div>
          {suggested.length === 0 ? (
            <p className="small muted">
              {user
                ? 'Search for something to get suggestions based on what you look for.'
                : 'Sign in to get suggestions based on what you search and follow.'}
            </p>
          ) : (
            suggested.map((business) => (
              <div key={business.id} className="user-row">
                <Link to={`/u/${business.id}`}>
                  <Avatar name={business.fullName} src={business.avatarUrl} />
                </Link>
                <div className="user-row-main">
                  <Link to={`/u/${business.id}`} className="user-row-name">
                    {business.fullName}
                    <VerifiedBadge show={business.isVerified} />
                  </Link>
                  <div className="user-row-sub">{business.category || 'Business'}</div>
                </div>
                <button
                  type="button"
                  className={business.isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-sm'}
                  onClick={() => toggleFollow(business)}
                  disabled={followingId === business.id}
                >
                  {business.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}
