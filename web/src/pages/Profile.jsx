import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { mediaUrl } from '../lib/api.js';
import * as sint from '../lib/sint.js';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { Empty } from '../components/Ui.jsx';
import { FeedSkeleton, ProfileSkeleton, UserListSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { accountTypeLabel } from '../lib/format.js';
import {
  CloseIcon,
  LinkIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
} from '../components/icons.jsx';

function UserListModal({ title, kind, userId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const request = kind === 'followers' ? sint.followers(userId) : sint.following(userId);

    request
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, userId]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{ maxHeight: '76vh', overflowY: 'auto' }}
      >
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {loading ? <UserListSkeleton count={5} /> : null}

        {!loading && items.length === 0 ? (
          <p className="small muted">Nobody here yet.</p>
        ) : null}

        {items.map((item) => (
          <Link
            key={item.id}
            to={`/u/${item.id}`}
            className="user-row"
            onClick={onClose}
          >
            <Avatar name={item.fullName} src={item.avatarUrl} size="sm" />
            <div className="user-row-main">
              <div className="user-row-name">
                {item.fullName}
                <VerifiedBadge show={item.isVerified} />
              </div>
              <div className="user-row-sub">{item.category || accountTypeLabel(item.accountType)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user: viewer } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listModal, setListModal] = useState(null);

  const isMe = viewer?.id === id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTab('posts');

    async function load() {
      try {
        const [profileData, postData] = await Promise.all([
          sint.profile(id),
          sint.userPosts(id),
        ]);
        if (cancelled) return;
        setProfile(profileData.user);
        setPosts(postData.items ?? []);
        setError('');
      } catch (problem) {
        if (!cancelled) setError(problem.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadTab = useCallback(
    async (next) => {
      setTab(next);
      if (next === 'posts') {
        setPostLoading(true);
        try {
          const data = await sint.userPosts(id);
          setPosts(data.items ?? []);
        } catch (problem) {
          toast.error(problem.message);
        } finally {
          setPostLoading(false);
        }
        return;
      }

      setPostLoading(true);
      try {
        const data = next === 'saved' ? await sint.savedPosts() : await sint.likedPosts();
        setPosts(data.items ?? []);
      } catch (problem) {
        toast.error(problem.message);
        setPosts([]);
      } finally {
        setPostLoading(false);
      }
    },
    [id, toast],
  );

  const toggleFollow = async () => {
    if (!viewer) {
      navigate('/signin', { state: { from: `/u/${id}` } });
      return;
    }

    setBusy(true);
    const following = !profile.isFollowing;
    setProfile((current) => ({
      ...current,
      isFollowing: following,
      followerCount: Math.max(0, current.followerCount + (following ? 1 : -1)),
    }));

    try {
      const data = await sint.setFollowing(id, following);
      setProfile((current) => ({ ...current, ...data.user }));
    } catch (problem) {
      setProfile((current) => ({ ...current, isFollowing: !following }));
      toast.error(problem.message);
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    if (!viewer) {
      navigate('/signin', { state: { from: `/u/${id}` } });
      return;
    }
    setBusy(true);
    try {
      const data = await sint.openConversation(id);
      navigate(`/messages/${data.conversation.id}`);
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-profile">
        <ProfileSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Empty title="Profile unavailable">
        <p className="small muted">{error}</p>
        <Link to="/" className="btn btn-outline btn-sm">
          Back to the feed
        </Link>
      </Empty>
    );
  }

  const links = profile.links ?? [];
  const cover = profile.coverUrl ? mediaUrl(profile.coverUrl) : '';

  return (
    <div className="page page-profile">
      <div
        className="cover"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        role="presentation"
      />

      <div className="profile-head">
        <Avatar name={profile.fullName} src={profile.avatarUrl} size="lg" />
        <div className="spacer" />
        {isMe ? (
          <Link to="/me/edit" className="btn btn-outline btn-sm">
            Edit profile
          </Link>
        ) : (
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={message} disabled={busy}>
              Message
            </button>
            <button
              type="button"
              className={profile.isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-sm'}
              onClick={toggleFollow}
              disabled={busy}
            >
              {profile.isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        )}
      </div>

      <div className="profile-body">
        <div className="profile-name">
          <span>{profile.fullName}</span>
          <VerifiedBadge show={profile.isVerified} />
        </div>

        <div className="profile-sub">
          {[accountTypeLabel(profile.accountType), profile.category, profile.location]
            .filter(Boolean)
            .join(' · ')}
        </div>

        {profile.bio ? (
          <p className="small" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
            {profile.bio}
          </p>
        ) : null}

        {isMe && profile.subscription ? (
          <div className="badge-row">
            <span className="pill">
              {profile.subscription.status === 'trialing'
                ? 'Free trial'
                : profile.subscription.status === 'active'
                  ? 'Subscribed'
                  : 'Plan ended'}
            </span>
            {profile.subscription.plan ? <span className="pill">{profile.subscription.plan}</span> : null}
            <Link to="/plans" className="pill">
              Manage plan
            </Link>
          </div>
        ) : null}

        <div className="profile-stats">
          <div className="stat">
            <b>{profile.postCount ?? 0}</b>
            <span>Posts</span>
          </div>
          <button
            type="button"
            className="stat"
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
            onClick={() => setListModal('followers')}
          >
            <b>{profile.followerCount ?? 0}</b>
            <span>Followers</span>
          </button>
          <button
            type="button"
            className="stat"
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
            onClick={() => setListModal('following')}
          >
            <b>{profile.followingCount ?? 0}</b>
            <span>Following</span>
          </button>
        </div>

        <div className="contact-list">
          {profile.email ? (
            <div className="contact-line">
              <MailIcon />
              <span>{profile.email}</span>
            </div>
          ) : null}
          {profile.contactEmail ? (
            <div className="contact-line">
              <MailIcon />
              <a href={`mailto:${profile.contactEmail}`}>{profile.contactEmail}</a>
            </div>
          ) : null}
          {profile.phone ? (
            <div className="contact-line">
              <PhoneIcon />
              <a href={`tel:${profile.phone.replace(/\s+/g, '')}`}>{profile.phone}</a>
            </div>
          ) : null}
          {profile.address ? (
            <div className="contact-line">
              <PinIcon />
              <span>{profile.address}</span>
            </div>
          ) : null}
          {links.map((link) => (
            <div key={link.url} className="contact-line">
              <LinkIcon />
              <a href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label || link.url}
              </a>
            </div>
          ))}
        </div>
      </div>

      <hr className="divider" />

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'posts'}
          className={tab === 'posts' ? 'tab active' : 'tab'}
          onClick={() => loadTab('posts')}
        >
          Posts
        </button>
        {isMe ? (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'saved'}
              className={tab === 'saved' ? 'tab active' : 'tab'}
              onClick={() => loadTab('saved')}
            >
              Saved
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'liked'}
              className={tab === 'liked' ? 'tab active' : 'tab'}
              onClick={() => loadTab('liked')}
            >
              Liked
            </button>
          </>
        ) : null}
      </div>

      {postLoading ? <FeedSkeleton count={2} /> : null}

      {!postLoading && posts.length === 0 ? (
        <Empty
          title={
            tab === 'posts' ? 'No posts yet' : tab === 'saved' ? 'Nothing saved' : 'Nothing liked'
          }
        >
          {tab === 'posts'
            ? isMe
              ? 'Your published posts will appear here.'
              : 'This account has not published anything yet.'
            : 'Tap Save on a post to keep it here.'}
        </Empty>
      ) : null}

      {!postLoading
        ? posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onChange={(updated) =>
                setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
              }
              onDelete={(postId) =>
                setPosts((current) => current.filter((item) => item.id !== postId))
              }
            />
          ))
        : null}

      {listModal ? (
        <UserListModal
          title={listModal === 'followers' ? 'Followers' : 'Following'}
          kind={listModal}
          userId={id}
          onClose={() => setListModal(null)}
        />
      ) : null}
    </div>
  );
}
