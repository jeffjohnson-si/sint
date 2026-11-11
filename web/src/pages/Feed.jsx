import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { PostCard } from '../components/PostCard.jsx';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { Empty, Spinner } from '../components/Ui.jsx';
import { FeedSkeleton, ChipsSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';

const PAGE_SIZE = 12;

function mergePosts(existing, incoming) {
  const seen = new Set(existing.map((post) => post.id));
  return [...existing, ...incoming.filter((post) => !seen.has(post.id))];
}

function BusinessRow({ business }) {
  return (
    <Link to={`/u/${business.id}`} className="rail-row">
      <Avatar name={business.fullName} src={business.avatarUrl} size="sm" />
      <span className="rail-row-main">
        <span className="rail-row-name">
          {business.fullName}
          <VerifiedBadge show={business.isVerified} />
        </span>
        <span className="rail-row-sub">{business.category || 'Business'}</span>
      </span>
    </Link>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('for-you');
  const [category, setCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [suggested, setSuggested] = useState([]);

  const requestId = useRef(0);
  const sentinel = useRef(null);

  useEffect(() => {
    sint
      .categories()
      .then((data) => setCategories((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesReady(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    sint
      .suggestions(8)
      .then((data) => {
        if (!cancelled) setSuggested(data.items ?? []);
      })
      .catch(() => setSuggested([]));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const load = useCallback(
    async (nextPage) => {
      const ticket = ++requestId.current;

      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const data = await sint.feed({ tab, category, page: nextPage, limit: PAGE_SIZE });
        if (ticket !== requestId.current) return;

        setItems((current) =>
          nextPage === 1 ? data.items : mergePosts(current, data.items),
        );
        setPage(data.page);
        setHasMore(data.hasMore);
        setError('');
      } catch (problem) {
        if (ticket !== requestId.current) return;
        if (nextPage === 1) {
          setItems([]);
          setError(problem.message);
        } else {
          toast.error(problem.message);
        }
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [tab, category, toast],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // Infinite scroll, with a "Load more" button as the keyboard fallback.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load(page + 1);
      },
      { rootMargin: '320px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  const chooseTab = (next) => {
    setItems([]);
    setTab(next);
  };

  const replacePost = (updated) =>
    setItems((current) => current.map((post) => (post.id === updated.id ? updated : post)));

  const dropPost = (id) => setItems((current) => current.filter((post) => post.id !== id));

  return (
    <div className="page page-feed">
      <div className="feed-layout">
        <div className="feed-main">
          <div className="page-head">
            <h1>Feed</h1>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => load(1)}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {suggested.length > 0 && tab === 'for-you' && category === 'All' ? (
            <section className="suggested-strip" style={{ marginBottom: 18 }}>
              <div className="panel-title">Suggested for you</div>
              <div className="suggested">
                {suggested.map((business) => (
                  <Link key={business.id} to={`/u/${business.id}`} className="suggested-card">
                    <Avatar name={business.fullName} src={business.avatarUrl} />
                    <span className="suggested-name">
                      {business.fullName}
                      <VerifiedBadge show={business.isVerified} />
                    </span>
                    <span className="suggested-cat">{business.category || 'Business'}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="sticky-head">
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'for-you'}
                className={tab === 'for-you' ? 'tab active' : 'tab'}
                onClick={() => chooseTab('for-you')}
              >
                For You
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'following'}
                className={tab === 'following' ? 'tab active' : 'tab'}
                onClick={() => chooseTab('following')}
              >
                Following
              </button>
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
          </div>

          {loading ? <FeedSkeleton count={3} /> : null}

          {!loading && error ? (
            <div className="card card-pad">
              <div className="empty-title">Could not load the feed</div>
              <p className="small muted">{error}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => load(1)}>
                Try again
              </button>
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <Empty title={tab === 'following' ? 'No posts from who you follow' : 'No posts yet'}>
              {tab === 'following'
                ? 'Follow a few businesses and their posts will show up here.'
                : user.isPublisher
                  ? 'Publish the first post from your business.'
                  : 'Businesses will appear here as soon as they post.'}
              {user.isPublisher ? (
                <div style={{ marginTop: 14 }}>
                  <Link to="/new" className="btn btn-sm">
                    Create a post
                  </Link>
                </div>
              ) : null}
            </Empty>
          ) : null}

          {items.map((post) => (
            <PostCard key={post.id} post={post} onChange={replacePost} onDelete={dropPost} />
          ))}

          {loadingMore ? <Spinner /> : null}

          {hasMore && !loading && !loadingMore ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => load(page + 1)}
              >
                Load more
              </button>
            </div>
          ) : null}

          <div ref={sentinel} style={{ height: 1 }} />
        </div>

        {/* Desktop only; the cards stack under the feed on narrow screens. */}
        <aside className="feed-aside">
          {suggested.length > 0 ? (
            <section className="rail-card">
              <div className="panel-title">Suggested businesses</div>
              {suggested.slice(0, 5).map((business) => (
                <BusinessRow key={business.id} business={business} />
              ))}
              <Link to="/search" className="rail-more">
                Find more businesses
              </Link>
            </section>
          ) : null}

          {user.isPublisher ? (
            <section className="rail-card">
              <div className="panel-title">Your plan</div>
              <p className="small" style={{ marginBottom: 10 }}>
                {user.subscription?.status === 'trialing'
                  ? 'You are on the free trial. Everything in the monthly plan is unlocked.'
                  : user.subscription?.status === 'active'
                    ? 'Active plan. Your posts are boosted in the For You feed.'
                    : 'Your plan has ended, so publishing is paused.'}
              </p>
              <Link to="/plans" className="btn btn-outline btn-sm btn-block">
                Manage subscription
              </Link>
            </section>
          ) : null}

          <section className="rail-card">
            <div className="panel-title">Browse</div>
            <div className="rail-tags">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setCategory(item);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <p className="rail-foot">
            SINT — Solomon Islands Net Trade. Every business, one place.
          </p>
        </aside>
      </div>
    </div>
  );
}
