import { mediaUrl } from '../lib/api.js';
import { PlayIcon } from './icons.jsx';

/**
 * Feed media. One image or video gets a large frame; anything else becomes a
 * compact grid, with a "+N" overlay when a post carries more than four items.
 */
export function MediaGrid({ media = [], onOpen }) {
  if (!media.length) return null;

  if (media.length === 1) {
    const item = media[0];
    const src = mediaUrl(item.url);

    if (item.type === 'video') {
      return (
        <div className="media-grid" data-count="1">
          <div className="media-cell video-cell" style={{ cursor: 'default' }}>
            <video
              src={src}
              controls
              playsInline
              preload="metadata"
              poster={item.thumbnailUrl ? mediaUrl(item.thumbnailUrl) : undefined}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="media-grid" data-count="1">
        <button type="button" className="media-cell" onClick={() => onOpen?.(0)}>
          <img src={src} alt="" loading="lazy" decoding="async" />
        </button>
      </div>
    );
  }

  const visible = media.slice(0, 4);
  const hidden = media.length - visible.length;

  return (
    <div className="media-grid" data-count={visible.length}>
      {visible.map((item, index) => {
        const isLast = index === visible.length - 1;
        return (
          <button
            key={`${item.url}-${index}`}
            type="button"
            className="media-cell"
            onClick={() => onOpen?.(index)}
          >
            {item.type === 'video' ? (
              <>
                <video
                  src={mediaUrl(item.url)}
                  muted
                  playsInline
                  preload="metadata"
                  poster={item.thumbnailUrl ? mediaUrl(item.thumbnailUrl) : undefined}
                />
                <span className="play-badge">
                  <PlayIcon />
                </span>
              </>
            ) : (
              <img src={mediaUrl(item.url)} alt="" loading="lazy" decoding="async" />
            )}
            {isLast && hidden > 0 ? <span className="media-more">+{hidden}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
