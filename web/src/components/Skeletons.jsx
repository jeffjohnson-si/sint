/**
 * Loading placeholders that mirror each screen's real layout, so content does
 * not jump when it arrives. Every block is decorative: the wrapper carries
 * aria-busy and a single label, the shapes are aria-hidden.
 *
 * The shimmer is CSS (`styles.css`) and stops under prefers-reduced-motion.
 */

export function Skeleton({ width = '100%', height = 12, radius = 6, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

function PostCardSkeleton({ withMedia = true }) {
  return (
    <article className="card card-pad" style={{ marginBottom: 12 }}>
      <div className="sk-head" style={{ marginBottom: 12 }}>
        <Skeleton width={40} height={40} radius="50%" />
        <div className="sk-head-text">
          <Skeleton width="44%" height={12} />
          <Skeleton width="26%" height={10} />
        </div>
      </div>

      <div className="sk-stack">
        <Skeleton height={12} />
        <Skeleton width="78%" height={12} />
      </div>

      {withMedia ? (
        <>
          <div style={{ height: 12 }} />
          <Skeleton height={170} radius={12} />
        </>
      ) : null}

      <div className="sk-actions">
        <Skeleton width={52} height={12} />
        <Skeleton width={62} height={12} />
        <Skeleton width={48} height={12} />
      </div>
    </article>
  );
}

export function FeedSkeleton({ count = 3 }) {
  return (
    <div aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} withMedia={index !== 1} />
      ))}
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="sk-row">
      <Skeleton width={30} height={30} radius="50%" />
      <div className="sk-row-text">
        <Skeleton width="34%" height={11} />
        <Skeleton height={11} />
        <Skeleton width="62%" height={11} />
      </div>
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading post">
      <PostCardSkeleton />
      <div style={{ marginTop: 18 }}>
        <Skeleton width={110} height={11} />
        <div style={{ height: 6 }} />
        <CommentSkeleton />
        <CommentSkeleton />
        <CommentSkeleton />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <Skeleton height={168} radius={14} />

      <div className="sk-profile-head">
        <Skeleton width={84} height={84} radius="50%" />
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <Skeleton width="48%" height={18} />
        <div style={{ height: 8 }} />
        <Skeleton width="34%" height={12} />
        <div style={{ height: 18 }} />
        <div className="row" style={{ gap: 24 }}>
          <Skeleton width={56} height={32} />
          <Skeleton width={64} height={32} />
          <Skeleton width={66} height={32} />
        </div>
        <div style={{ height: 18 }} />
        <Skeleton width="56%" height={11} />
        <div style={{ height: 8 }} />
        <Skeleton width="40%" height={11} />
      </div>

      <div style={{ marginTop: 18 }}>
        <FeedSkeleton count={2} />
      </div>
    </div>
  );
}

export function InboxSkeleton({ count = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: count }, (_, index) => (
        <div className="sk-row" key={index}>
          <Skeleton width={40} height={40} radius="50%" />
          <div className="sk-row-text">
            <Skeleton width="38%" height={12} />
            <Skeleton width="66%" height={11} />
          </div>
          <Skeleton width={34} height={10} />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="chat sk-chat">
      <div className="sk-head">
        <Skeleton width={30} height={30} radius="50%" />
        <Skeleton width={150} height={13} />
      </div>

      {/* Bubbles hug the bottom of the thread, like a real conversation. */}
      <div className="sk-chat-body">
        <Skeleton width="34%" height={34} radius={16} />
        <Skeleton className="sk-bubble-mine" width="27%" height={34} radius={16} />
        <Skeleton width="41%" height={48} radius={16} />
        <Skeleton className="sk-bubble-mine" width="22%" height={30} radius={16} />
        <Skeleton width="30%" height={34} radius={16} />
      </div>

      <Skeleton height={44} radius={22} />
    </div>
  );
}

export function NotificationsSkeleton({ count = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: count }, (_, index) => (
        <div className="sk-row" key={index}>
          <Skeleton width={8} height={8} radius="50%" />
          <Skeleton width={30} height={30} radius="50%" />
          <div className="sk-row-text">
            <Skeleton width="52%" height={12} />
            <Skeleton width="22%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading plans">
      <div className="card card-pad">
        <div className="row between">
          <Skeleton width={110} height={11} />
          <Skeleton width={64} height={22} radius={999} />
        </div>
        <div style={{ height: 12 }} />
        <Skeleton width="72%" height={11} />
      </div>

      <div className="plan-grid" style={{ marginTop: 16 }}>
        {[0, 1].map((index) => (
          <div className="plan" key={index}>
            <Skeleton width="42%" height={16} />
            <div style={{ height: 10 }} />
            <Skeleton width="58%" height={22} />
            <div style={{ height: 14 }} />
            <div className="sk-stack">
              <Skeleton height={11} />
              <Skeleton width="86%" height={11} />
              <Skeleton width="72%" height={11} />
              <Skeleton width="80%" height={11} />
            </div>
            <div style={{ height: 16 }} />
            <Skeleton height={38} radius={999} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchSkeleton({ count = 4 }) {
  return (
    <div aria-busy="true" aria-label="Searching">
      {Array.from({ length: count }, (_, index) => (
        <div className="sk-row" key={index}>
          <Skeleton width={40} height={40} radius="50%" />
          <div className="sk-row-text">
            <Skeleton width="42%" height={12} />
            <Skeleton width="30%" height={11} />
          </div>
          <Skeleton width={72} height={28} radius={999} />
        </div>
      ))}
    </div>
  );
}

export function ChipsSkeleton({ count = 7 }) {
  return (
    <div className="chips" aria-busy="true" aria-label="Loading categories">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={96 + (index % 3) * 26} height={30} radius={999} />
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form" className="sk-stack">
      <Skeleton width="30%" height={11} />
      <Skeleton height={120} radius={10} />
      <div className="row" style={{ gap: 8 }}>
        <Skeleton width={76} height={76} radius={10} />
        <Skeleton width={76} height={76} radius={10} />
        <Skeleton width={76} height={76} radius={10} />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <Skeleton height={44} radius={10} />
        <Skeleton height={44} radius={10} />
      </div>
      <Skeleton height={44} radius={999} />
    </div>
  );
}

export function UserListSkeleton({ count = 5 }) {
  return (
    <div aria-busy="true" aria-label="Loading people">
      {Array.from({ length: count }, (_, index) => (
        <div className="sk-row" key={index}>
          <Skeleton width={30} height={30} radius="50%" />
          <div className="sk-row-text">
            <Skeleton width="46%" height={12} />
            <Skeleton width="28%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
