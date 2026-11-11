import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { PostCard } from '../components/PostCard.jsx';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { BackIcon, HeartIcon, TrashIcon } from '../components/icons.jsx';
import { Empty } from '../components/Ui.jsx';
import { PostDetailSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { timeAgo } from '../lib/format.js';

function mapTree(list, commentId, update) {
  return list.map((comment) => {
    if (comment.id === commentId) return update(comment);
    if (comment.replies?.length) {
      return { ...comment, replies: mapTree(comment.replies, commentId, update) };
    }
    return comment;
  });
}

function removeFromTree(list, commentId) {
  return list
    .filter((comment) => comment.id !== commentId)
    .map((comment) =>
      comment.replies?.length
        ? { ...comment, replies: removeFromTree(comment.replies, commentId) }
        : comment,
    );
}

function CommentRow({ comment, postId, onChanged, onDeleted, onReply, depth = 0 }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (!user) {
      navigate('/signin', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      const data = await sint.setCommentLiked(comment.id, !comment.isLiked);
      onChanged(data.comment);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await sint.deleteComment(comment.id);
      onDeleted(comment.id);
      toast.success('Comment deleted');
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="comment" style={depth ? { paddingLeft: 8 } : undefined}>
      <Link to={`/u/${comment.author?.id}`} aria-label={comment.author?.fullName}>
        <Avatar name={comment.author?.fullName} src={comment.author?.avatarUrl} size="sm" />
      </Link>

      <div className="comment-main">
        <div className="comment-head">
          <Link to={`/u/${comment.author?.id}`}>
            {comment.author?.fullName}
            <VerifiedBadge show={comment.author?.isVerified} />
          </Link>
          <span className="comment-time">{timeAgo(comment.createdAt)}</span>
        </div>

        {comment.text ? <div className="comment-text">{comment.text}</div> : null}

        {comment.media?.length ? (
          <div className="upload-grid" style={{ marginTop: 8 }}>
            {comment.media.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="upload-thumb"
              >
                <img src={item.url} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="comment-actions">
          <button
            type="button"
            className={comment.isLiked ? 'post-action liked' : 'post-action'}
            onClick={toggleLike}
            disabled={busy}
            aria-pressed={comment.isLiked}
            aria-label={comment.isLiked ? 'Unlike comment' : 'Like comment'}
          >
            <HeartIcon />
            {comment.likeCount > 0 ? comment.likeCount : 'Like'}
          </button>

          {depth === 0 ? (
            <button type="button" className="post-action" onClick={() => onReply(comment)}>
              Reply
            </button>
          ) : null}

          {comment.isOwner ? (
            <button type="button" className="post-action" onClick={remove} disabled={busy}>
              <TrashIcon />
            </button>
          ) : null}
        </div>

        {comment.replies?.length ? (
          <div className="replies">
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                postId={postId}
                onChanged={onChanged}
                onDeleted={onDeleted}
                onReply={onReply}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postData, commentData] = await Promise.all([
        sint.getPost(id),
        sint.comments(id),
      ]);
      setPost(postData.post);
      setItems(commentData.items ?? []);
      setError('');
    } catch (problem) {
      setError(problem.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const replaceComment = (updated) =>
    setItems((current) => mapTree(current, updated.id, () => updated));

  const dropComment = (commentId) => {
    setItems((current) => removeFromTree(current, commentId));
    setPost((current) =>
      current ? { ...current, commentCount: Math.max(0, current.commentCount - 1) } : current,
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    if (!user) {
      navigate('/signin', { state: { from: location.pathname } });
      return;
    }

    setSending(true);
    try {
      const data = await sint.addComment(id, {
        text: text.trim(),
        parentId: replyTo?.id,
      });

      if (replyTo) {
        setItems((current) =>
          mapTree(current, replyTo.id, (comment) => ({
            ...comment,
            replyCount: (comment.replyCount ?? 0) + 1,
            replies: [...(comment.replies ?? []), data.comment],
          })),
        );
      } else {
        setItems((current) => [...current, data.comment]);
      }

      setPost((current) =>
        current ? { ...current, commentCount: current.commentCount + 1 } : current,
      );
      setText('');
      setReplyTo(null);
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-post">
        <PostDetailSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Empty title="Post unavailable">
        <p className="small muted">{error}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/')}>
          Back to the feed
        </button>
      </Empty>
    );
  }

  return (
    <div className="page page-post">
      <div className="page-title-row">
        <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Post</h1>
      </div>

      {post ? (
        <PostCard
          post={post}
          onChange={setPost}
          onDelete={() => navigate('/', { replace: true })}
        />
      ) : null}

      <section style={{ marginTop: 18 }}>
        <div className="panel-title">
          {post?.commentCount ? `${post.commentCount} comments` : 'Comments'}
        </div>

        {items.length === 0 ? (
          <p className="muted small" style={{ padding: '8px 0 14px' }}>
            No comments yet. Be the first to say something.
          </p>
        ) : (
          items.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              postId={id}
              onChanged={replaceComment}
              onDeleted={dropComment}
              onReply={(target) => {
                setReplyTo({ id: target.id, name: target.author?.fullName });
                document.getElementById('comment-box')?.focus();
              }}
            />
          ))
        )}

        <form className="stack" onSubmit={submit} style={{ marginTop: 16 }}>
          {replyTo ? (
            <div className="row between notice">
              <span>
                Replying to <b>{replyTo.name}</b>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          ) : null}

          <textarea
            id="comment-box"
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={user ? 'Write a comment…' : 'Sign in to comment'}
            maxLength={1000}
            style={{ minHeight: 84 }}
          />

          <div className="row between">
            <span className="hint">{text.length}/1000</span>
            <button
              type="submit"
              className="btn btn-sm"
              disabled={sending || !text.trim()}
            >
              {sending ? 'Posting…' : replyTo ? 'Reply' : 'Comment'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
