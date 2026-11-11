import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import * as sint from '../lib/sint.js';
import { PostForm } from '../components/PostForm.jsx';
import { useToast } from '../components/Toast.jsx';

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    sint
      .categories()
      .then((data) => setCategories((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setCategories([]));
  }, []);

  if (!user?.isPublisher) {
    return (
      <div className="page page-form">
        <h1 style={{ marginBottom: 12 }}>Create a post</h1>
        <div className="card card-pad">
          <div className="empty-title">Only businesses can post</div>
          <p className="small muted">
            SINT accounts for personal use browse, follow, like, comment and message. Publishing is
            for business, company and freelancer accounts.
          </p>
          <div style={{ marginTop: 14 }}>
            <Link to="/" className="btn btn-outline btn-sm">
              Back to the feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canPublish = user.subscription?.canPublish;

  const submit = async (payload) => {
    try {
      const data = await sint.createPost({
        content: payload.content,
        media: payload.media,
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.location ? { location: payload.location } : {}),
      });
      toast.success('Post published');
      navigate(`/post/${data.post.id}`, { replace: true });
    } catch (error) {
      if (error.status === 402) {
        toast.error(error.message);
        navigate('/plans');
        return;
      }
      throw error;
    }
  };

  return (
    <div className="page page-form">
      <div className="page-head">
        <h1>New post</h1>
      </div>

      {!canPublish ? (
        <div className="notice notice-strong" style={{ marginBottom: 14 }}>
          Your subscription has ended, so publishing is paused. Your profile and existing posts
          stay visible.{' '}
          <Link to="/plans" className="bold">
            Renew to post again
          </Link>
          .
        </div>
      ) : null}

      <PostForm
        categories={categories}
        defaultCategory={user.category}
        submitLabel="Publish post"
        onSubmit={submit}
      />
    </div>
  );
}
