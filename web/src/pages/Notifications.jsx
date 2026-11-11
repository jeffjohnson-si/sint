import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as sint from '../lib/sint.js';
import { Avatar } from '../components/Avatar.jsx';
import { Empty } from '../components/Ui.jsx';
import { NotificationsSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { timeAgo } from '../lib/format.js';

const TYPE_COLOUR = {
  like: '#c2185b',
  comment: '#1565c0',
  follow: '#1c7c3c',
  message: '#b26a00',
};

export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await sint.notifications();
        if (cancelled) return;
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
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
  }, []);

  const markAll = async () => {
    try {
      await sint.markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (problem) {
      toast.error(problem.message);
    }
  };

  const open = async (notification) => {
    if (!notification.read) {
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      setUnread((current) => Math.max(0, current - 1));
      sint.markNotificationRead(notification.id).catch(() => {});
    }

    if (notification.type === 'message' && notification.conversationId) {
      navigate(`/messages/${notification.conversationId}`);
      return;
    }
    if (notification.postId) {
      navigate(`/post/${notification.postId}`);
      return;
    }
    if (notification.actor?.id) {
      navigate(`/u/${notification.actor.id}`);
    }
  };

  return (
    <div className="page page-list">
      <div className="page-head">
        <h1>Notifications</h1>
        {unread > 0 ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={markAll}>
            Mark all read
          </button>
        ) : null}
      </div>

      {loading ? <NotificationsSkeleton count={6} /> : null}

      {!loading && error ? <div className="notice">{error}</div> : null}

      {!loading && !error && items.length === 0 ? (
        <Empty title="Nothing yet">
          Likes, comments, follows and messages will show up here.
        </Empty>
      ) : null}

      {items.map((notification) => (
        <div
          key={notification.id}
          className="notif"
          role="button"
          tabIndex={0}
          onClick={() => open(notification)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') open(notification);
          }}
        >
          <div className={notification.read ? 'notif-dot read' : 'notif-dot'} />

          <Avatar name={notification.actor?.fullName} src={notification.actor?.avatarUrl} size="sm" />

          <div className="user-row-main">
            <div style={{ fontSize: 14 }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  marginRight: 7,
                  verticalAlign: 'middle',
                  background: TYPE_COLOUR[notification.type] ?? 'var(--grey-400)',
                }}
              />
              {notification.text}
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {timeAgo(notification.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
