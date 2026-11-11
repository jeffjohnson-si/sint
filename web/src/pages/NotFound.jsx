import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty page page-form" style={{ paddingTop: 70 }}>
      <div className="empty-title">Nothing here</div>
      <p className="small">That page does not exist, or it was removed.</p>
      <Link to="/" className="btn btn-outline btn-sm" style={{ marginTop: 16 }}>
        Back to the feed
      </Link>
    </div>
  );
}
