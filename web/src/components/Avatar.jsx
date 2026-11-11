import { mediaUrl } from '../lib/api.js';
import { initials } from '../lib/format.js';
import { VerifiedIcon } from './icons.jsx';

/** Round avatar with an initials fallback, since most accounts have no photo. */
export function Avatar({ name, src, size = 'md', className = '' }) {
  const url = src ? mediaUrl(src) : '';
  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : '';
  const classes = ['avatar', sizeClass, className].filter(Boolean).join(' ');

  if (url) {
    return (
      <span className={classes}>
        <img src={url} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}

export function UserAvatar({ user, size, className }) {
  return <Avatar name={user?.fullName} src={user?.avatarUrl} size={size} className={className} />;
}

export function VerifiedBadge({ show }) {
  if (!show) return null;
  return (
    <span className="verified" title="Verified business">
      <VerifiedIcon />
    </span>
  );
}

export function UserLink({ user, children, className = '' }) {
  if (!user?.id) return <span className={className}>{children}</span>;
  return (
    <a href={`/u/${user.id}`} className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  );
}
