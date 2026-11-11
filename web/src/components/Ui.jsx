import { useEffect } from 'react';

export function Spinner({ center = true }) {
  const spinner = <span className="spinner" role="progressbar" aria-label="Loading" />;
  return center ? <div className="spinner-center">{spinner}</div> : spinner;
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      {title ? <div className="empty-title">{title}</div> : null}
      {children}
    </div>
  );
}

export function Pill({ children, dark = false }) {
  return <span className={dark ? 'pill pill-dark' : 'pill'}>{children}</span>;
}

/** Confirmation dialog used before anything destructive or hard to undo. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy = false,
  danger = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        {body ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            {body}
          </p>
        ) : null}
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
