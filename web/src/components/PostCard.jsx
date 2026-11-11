import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { compactNumber, timeAgo } from '../lib/format.js';
import { setLiked, setSaved, deletePost } from '../lib/sint.js';
import { Avatar, VerifiedBadge } from './Avatar.jsx';
import { MediaGrid } from './MediaGrid.jsx';
import { MediaViewer } from './MediaViewer.jsx';
import { ConfirmDialog } from './Ui.jsx';
import { useToast } from './Toast.jsx';
import { BookmarkIcon, CommentIcon, EditIcon, HeartIcon, ShareIcon, TrashIcon } from './icons.jsx';

export function PostCard({ post, onChange, onDelete }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const requireSignIn = () => {
    if (user) return true;
    navigate('/signin', { state: { from: `${location.pathname}${location.search}` } });
    return false;
  };

  const toggleLike = async () => {
    if (!requireSignIn() || busy) return;
    const next = !post.isLiked;
    setBusy(true);
    onChange({
      ...post,
      isLiked: next,
      likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)),
    });

    try {
      const data = await setLiked(post.id, next);
      onChange(data.post);
    } catch (error) {
      onChange(post);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    if (!requireSignIn() || busy) return;
    const next = !post.isSaved;
    setBusy(true);
    onChange({ ...post, isSaved: next });

    try {
      const data = await setSaved(post.id, next);
      onChange(data.post);
      toast.success(next ? 'Saved' : 'Removed from saved');
    } catch (error) {
      onChange(post);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const share = async (event) => {
    event.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    const title = post.author?.fullName ? `${post.author.fullName} on SINT` : 'SINT';

    if (navigator.share) {
      try {
        await navigator.share({ title, text: post.content?.slice(0, 120), url });
        return;
      } catch {
        // User dismissed the sheet; fall through to the clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      setConfirming(false);
      onDelete?.(post.id);
      toast.success('Post deleted');
    } catch (error) {
      toast.error(error.message);
      setDeleting(false);
    }
  };

  const author = post.author ?? {};

  return (
    <article className="post-card" onClick={() => navigate(`/post/${post.id}`)}>
      <header className="post-head">
        <Link
          to={`/u/${author.id}`}
          onClick={(event) => event.stopPropagation()}
          aria-label={author.fullName}
        >
          <Avatar name={author.fullName} src={author.avatarUrl} />
        </Link>

        <div className="post-author">
          <Link to={`/u/${author.id}`} className="post-name" onClick={(e) => e.stopPropagation()}>
            <span>{author.fullName}</span>
            <VerifiedBadge show={author.isVerified} />
          </Link>
          <div className="post-meta">
            {[author.category, timeAgo(post.createdAt)].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="spacer" />
        {post.category ? <span className="pill">{post.category}</span> : null}
      </header>

      {post.content ? <p className="post-body">{post.content}</p> : null}

      <div onClick={(event) => event.stopPropagation()}>
        <MediaGrid media={post.media} onOpen={setViewerIndex} />
      </div>

      {post.location ? (
        <div className="tiny muted" style={{ marginTop: 8 }}>
          {post.location}
        </div>
      ) : null}

      <footer className="post-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={post.isLiked ? 'post-action liked' : 'post-action'}
          onClick={toggleLike}
          aria-pressed={post.isLiked}
          aria-label={post.isLiked ? 'Unlike post' : 'Like post'}
        >
          <HeartIcon />
          {post.likeCount > 0 ? compactNumber(post.likeCount) : 'Like'}
        </button>

        <button
          type="button"
          className="post-action"
          onClick={() => navigate(`/post/${post.id}`)}
        >
          <CommentIcon />
          {post.commentCount > 0 ? compactNumber(post.commentCount) : 'Comment'}
        </button>

        <button
          type="button"
          className={post.isSaved ? 'post-action on' : 'post-action'}
          onClick={toggleSave}
          aria-pressed={post.isSaved}
        >
          <BookmarkIcon />
          {post.isSaved ? 'Saved' : 'Save'}
        </button>

        <button type="button" className="post-action" onClick={share}>
          <ShareIcon />
          Share
        </button>

        {post.isOwner ? (
          <>
            <div className="spacer" />
            <button
              type="button"
              className="post-action"
              onClick={() => navigate(`/post/${post.id}/edit`)}
              aria-label="Edit post"
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="post-action"
              onClick={() => setConfirming(true)}
              aria-label="Delete post"
            >
              <TrashIcon />
            </button>
          </>
        ) : null}
      </footer>

      {viewerIndex >= 0 ? (
        <MediaViewer
          media={post.media}
          index={viewerIndex}
          onClose={() => setViewerIndex(-1)}
        />
      ) : null}

      <div onClick={(event) => event.stopPropagation()}>
        <ConfirmDialog
          open={confirming}
          title="Delete this post?"
          body="The post and its comments are removed for everyone. This cannot be undone."
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        />
      </div>
    </article>
  );
}
