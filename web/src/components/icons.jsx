/**
 * Inline SVG icons. Stroke colour and width come from CSS so a button can
 * restyle its icon without touching this file.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ children, size, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} {...rest}>
      {children}
    </svg>
  );
}

export const HomeIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle {...stroke} cx="11" cy="11" r="7" />
    <path {...stroke} d="m16.5 16.5 4 4" />
  </Icon>
);

export const PlusIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChatIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M21 11.5a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.2A7.5 7.5 0 1 1 21 11.5Z" />
  </Icon>
);

export const BellIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" />
    <path {...stroke} d="M10.5 20a2 2 0 0 0 3 0" />
  </Icon>
);

export const UserIcon = (props) => (
  <Icon {...props}>
    <circle {...stroke} cx="12" cy="8" r="4" />
    <path {...stroke} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const HeartIcon = (props) => (
  <Icon {...props}>
    <path
      {...stroke}
      d="M12 20s-7.5-4.7-7.5-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3.5C19.5 15.3 12 20 12 20Z"
    />
  </Icon>
);

export const CommentIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12Z" />
  </Icon>
);

export const BookmarkIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" />
  </Icon>
);

export const ShareIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path {...stroke} d="M12 16V4M8 8l4-4 4 4" />
  </Icon>
);

export const VerifiedIcon = (props) => (
  <Icon viewBox="0 0 24 24" {...props}>
    <path
      fill="currentColor"
      d="M12 2.6 14.4 5l3.4-.3.6 3.4 2.8 1.9-1.7 3 1.7 3-2.8 1.9-.6 3.4-3.4-.3L12 21.4 9.6 19l-3.4.3-.6-3.4L2.8 14l1.7-3-1.7-3 2.8-1.9.6-3.4L9.6 5Z"
    />
    <path
      fill="#fff"
      d="m8.6 12.1 2.2 2.2 4.6-4.6"
      stroke="#fff"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Icon>
);

export const PlayIcon = (props) => (
  <Icon {...props}>
    <path fill="currentColor" d="M8 5.5v13l11-6.5Z" />
  </Icon>
);

export const CloseIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const BackIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M15 5l-7 7 7 7" />
  </Icon>
);

export const MailIcon = (props) => (
  <Icon {...props}>
    <rect {...stroke} x="3" y="5" width="18" height="14" rx="2" />
    <path {...stroke} d="m4 7 8 6 8-6" />
  </Icon>
);

export const PhoneIcon = (props) => (
  <Icon {...props}>
    <path
      {...stroke}
      d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5L16 11.5 20 13v3a2 2 0 0 1-2.2 2A16 16 0 0 1 5 5.2 2 2 0 0 1 7 3Z"
    />
  </Icon>
);

export const PinIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle {...stroke} cx="12" cy="10" r="2.5" />
  </Icon>
);

export const LinkIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M10 13a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11 6.3" />
    <path {...stroke} d="M14 11a4 4 0 0 0-5.7 0L6 13.3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const ImageIcon = (props) => (
  <Icon {...props}>
    <rect {...stroke} x="3" y="4" width="18" height="16" rx="2" />
    <circle {...stroke} cx="8.5" cy="9.5" r="1.5" />
    <path {...stroke} d="m4 17 4.5-4.5 3.5 3.5 3-3L20 18" />
  </Icon>
);

export const SendIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M4 12 20 4l-7 16-2.5-6.5Z" />
  </Icon>
);

export const EditIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z" />
    <path {...stroke} d="m13.5 7 3.5 3.5" />
  </Icon>
);

export const TrashIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12" />
  </Icon>
);

export const LogoutIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M14 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
    <path {...stroke} d="M9 12h11M17 8.5 20.5 12 17 15.5" />
  </Icon>
);

export const MoreIcon = (props) => (
  <Icon {...props}>
    <circle fill="currentColor" cx="6" cy="12" r="1.6" />
    <circle fill="currentColor" cx="12" cy="12" r="1.6" />
    <circle fill="currentColor" cx="18" cy="12" r="1.6" />
  </Icon>
);

export const StoreIcon = (props) => (
  <Icon {...props}>
    <path {...stroke} d="M4 10v10h16V10" />
    <path {...stroke} d="M3 10 4.6 4h14.8L21 10a3 3 0 0 1-5.4 1.6 3 3 0 0 1-7.2 0A3 3 0 0 1 3 10Z" />
    <path {...stroke} d="M9.5 20v-5h5v5" />
  </Icon>
);
