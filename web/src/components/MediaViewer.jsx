import { useEffect } from 'react';
import { mediaUrl } from '../lib/api.js';
import { CloseIcon } from './icons.jsx';

/** Full screen media viewer. Escape or a tap on the backdrop closes it. */
export function MediaViewer({ media, index = 0, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const item = media?.[index];
  if (!item) return null;

  return (
    <div className="viewer" onClick={onClose} role="dialog" aria-modal="true">
      <button
        type="button"
        className="icon-btn viewer-close"
        onClick={onClose}
        aria-label="Close"
      >
        <CloseIcon />
      </button>
      {item.type === 'video' ? (
        <video src={mediaUrl(item.url)} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={mediaUrl(item.url)} alt="" onClick={(e) => e.stopPropagation()} />
      )}
    </div>
  );
}
