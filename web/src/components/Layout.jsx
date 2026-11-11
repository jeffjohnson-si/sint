import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { Avatar } from './Avatar.jsx';
import { ConfirmDialog } from './Ui.jsx';
import { accountTypeLabel } from '../lib/format.js';
import {
  BellIcon,
  ChatIcon,
  HomeIcon,
  LogoutIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from './icons.jsx';

const POLL_MS = 15000;

/**
 * The signed-in shell. Everything inside is gated by <RequireAuth>, so there is
 * no signed-out variant to render here.
 */
export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState({ notifications: 0, messages: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const menuRef = useRef(null);

  // Badges are polled, not pushed: the API has no websocket layer, and two
  // small requests every 15s is cheaper than keeping a socket open on 3G.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const [notificationData, conversationData] = await Promise.all([
          sint.unreadCount(),
          sint.conversations(),
        ]);
        if (cancelled) return;
        setUnread({
          notifications: notificationData.unreadCount ?? 0,
          messages: conversationData.unreadTotal ?? 0,
        });
      } catch {
        // A dropped poll is not worth a toast; the next tick retries.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const isPublisher = Boolean(user.isPublisher);

  // Nothing in the shell is reachable until the email has been confirmed.
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;

  const navItems = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/search', label: 'Search', icon: SearchIcon },
    { to: '/messages', label: 'Messages', icon: ChatIcon, badge: unread.messages },
    { to: '/notifications', label: 'Notifications', icon: BellIcon, badge: unread.notifications },
    { to: `/u/${user.id}`, label: 'Profile', icon: UserIcon },
  ];

  const signOutNow = () => {
    signOut();
    navigate('/welcome', { replace: true });
  };

  const askToSignOut = () => {
    setMenuOpen(false);
    setConfirmSignOut(true);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="SINT home">
            <span className="brand-mark">S</span>
            <span>SINT</span>
          </Link>

          <div className="topbar-spacer" />

          <div className="topbar-actions">
            <Link to="/notifications" className="icon-btn" aria-label="Notifications">
              <BellIcon />
              {unread.notifications > 0 ? (
                <span className="badge-dot">
                  {unread.notifications > 99 ? '99+' : unread.notifications}
                </span>
              ) : null}
            </Link>

            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              </button>

              {menuOpen ? (
                <div className="menu-panel" role="menu">
                  <Link to={`/u/${user.id}`} className="menu-item" role="menuitem">
                    <UserIcon />
                    View profile
                  </Link>
                  <Link to="/interests" className="menu-item" role="menuitem">
                    Tune your feed
                  </Link>
                  {isPublisher ? (
                    <Link to="/plans" className="menu-item" role="menuitem">
                      Subscription
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={askToSignOut}
                  >
                    <LogoutIcon />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="shell-grid">
        <aside className="side-rail" aria-label="Sidebar">
          <Link to="/" className="brand side-brand" aria-label="SINT home">
            <span className="brand-mark">S</span>
            <span>SINT</span>
          </Link>

          <nav className="side-nav">
            {navItems.map(({ to, label, icon: Icon, badge, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
              >
                <span className="side-link-icon">
                  <Icon />
                  {badge > 0 ? (
                    <span className="side-badge">{badge > 99 ? '99+' : badge}</span>
                  ) : null}
                </span>
                <span>{label}</span>
              </NavLink>
            ))}

            {isPublisher ? (
              <NavLink
                to="/plans"
                className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
              >
                <span className="side-link-icon">
                  <span className="side-glyph">SBD</span>
                </span>
                <span>Subscription</span>
              </NavLink>
            ) : null}
          </nav>

          {isPublisher ? (
            <Link to="/new" className="btn btn-block" style={{ marginTop: 14 }}>
              <PlusIcon />
              Create post
            </Link>
          ) : null}

          <div className="spacer" />

          <div className="side-account">
            <Link to={`/u/${user.id}`} className="side-account-main">
              <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
              <span className="side-account-text">
                <span className="side-account-name">{user.fullName}</span>
                <span className="side-account-type">{accountTypeLabel(user.accountType)}</span>
              </span>
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={askToSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogoutIcon />
            </button>
          </div>

          <p className="side-foot">
            Solomon Islands Net Trade
            <br />
            Every business, one place.
          </p>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {navItems.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? 'bottom-nav-item active' : 'bottom-nav-item'
            }
          >
            <Icon />
            {badge > 0 ? <span className="badge-dot">{badge > 99 ? '99+' : badge}</span> : null}
            <span>{label === 'Notifications' ? 'Alerts' : label}</span>
          </NavLink>
        ))}
      </nav>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out of SINT?"
        body="You will need your email and password to sign back in."
        confirmLabel="Sign out"
        danger={false}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          signOutNow();
        }}
      />
    </div>
  );
}
