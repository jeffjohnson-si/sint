import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as sint from '../lib/sint.js';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { Empty } from '../components/Ui.jsx';
import { InboxSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { timeAgo } from '../lib/format.js';

export default function Conversations() {
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await sint.conversations(query.trim() || undefined);
        if (cancelled) return;
        setItems(data.items ?? []);
        setError('');
      } catch (problem) {
        if (!cancelled) setError(problem.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [query]);

  return (
    <div className="page page-inbox">
      <h1 style={{ marginBottom: 12 }}>Messages</h1>

      <input
        className="input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search conversations"
        style={{ marginBottom: 12 }}
      />

      {loading ? <InboxSkeleton count={5} /> : null}

      {!loading && error ? (
        <div className="notice">
          {error}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLoading(true)}
            style={{ marginLeft: 8 }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <Empty title="No messages yet">
          Open a business profile and tap Message to start a conversation.
          <div style={{ marginTop: 14 }}>
            <Link to="/search" className="btn btn-outline btn-sm">
              Find a business
            </Link>
          </div>
        </Empty>
      ) : null}

      {items.map((conversation) => {
        const other = conversation.otherUser ?? {};
        const last = conversation.lastMessage;

        return (
          <div
            key={conversation.id}
            className="conv-row"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/messages/${conversation.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/messages/${conversation.id}`);
            }}
          >
            <Avatar name={other.fullName} src={other.avatarUrl} />

            <div className="user-row-main">
              <div className="user-row-name">
                {other.fullName}
                <VerifiedBadge show={other.isVerified} />
              </div>
              <div className="user-row-sub">
                {last?.text ? (
                  <>
                    {last.senderId === other.id ? '' : 'You: '}
                    {last.text}
                  </>
                ) : (
                  'No messages yet'
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="tiny muted">{timeAgo(last?.at ?? conversation.updatedAt)}</div>
              {conversation.unreadCount > 0 ? (
                <div className="unread-pill" style={{ marginTop: 4, marginLeft: 'auto' }}>
                  {conversation.unreadCount}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
