import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as sint from '../lib/sint.js';
import { PostForm } from '../components/PostForm.jsx';
import { BackIcon } from '../components/icons.jsx';
import { Empty } from '../components/Ui.jsx';
import { FormSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [postData, categoryData] = await Promise.all([
          sint.getPost(id),
          sint.categories(),
        ]);
        if (cancelled) return;
        if (!postData.post.isOwner) {
          setError('You can only edit your own posts');
        } else {
          setPost(postData.post);
        }
        setCategories((categoryData.items ?? []).filter((item) => item !== 'All'));
      } catch (problem) {
        if (!cancelled) setError(problem.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async (payload) => {
    setSaving(true);
    try {
      await sint.updatePost(id, {
        content: payload.content,
        media: payload.media,
        category: payload.category ?? '',
        location: payload.location,
      });
      toast.success('Post updated');
      navigate(`/post/${id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-form">
        <FormSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Empty title="Cannot edit this post">
        <p className="small muted">{error}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/post/${id}`)}>
          Back to the post
        </button>
      </Empty>
    );
  }

  return (
    <div className="page page-form">
      <div className="page-title-row">
        <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Edit post</h1>
      </div>

      <PostForm
        initial={post}
        categories={categories}
        submitLabel="Save changes"
        busy={saving}
        onSubmit={submit}
      />
    </div>
  );
}
