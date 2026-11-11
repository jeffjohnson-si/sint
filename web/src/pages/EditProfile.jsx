import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { mediaUrl } from '../lib/api.js';
import * as sint from '../lib/sint.js';
import { compressImage } from '../lib/images.js';
import { Avatar } from '../components/Avatar.jsx';
import { BackIcon, CloseIcon, ImageIcon } from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';

const MAX_LINKS = 5;

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    fullName: '',
    bio: '',
    location: '',
    phone: '',
    address: '',
    contactEmail: '',
    category: '',
  });
  const [links, setLinks] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');

  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName ?? '',
      bio: user.bio ?? '',
      location: user.location ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      contactEmail: user.contactEmail ?? '',
      category: user.category ?? '',
    });
    setLinks(user.links ?? []);
    setAvatarUrl(user.avatarUrl ?? '');
    setCoverUrl(user.coverUrl ?? '');
  }, [user]);

  useEffect(() => {
    sint
      .categories()
      .then((data) => setCategories((data.items ?? []).filter((item) => item !== 'All')))
      .catch(() => setCategories([]));
  }, []);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickImage = async (file, kind) => {
    if (!file) return;
    setUploading(kind);
    try {
      const prepared = await compressImage(file);
      const data = await sint.upload(kind === 'avatar' ? { avatar: prepared } : { cover: prepared });
      if (kind === 'avatar') setAvatarUrl(data.avatar ?? '');
      else setCoverUrl(data.cover ?? '');
      toast.success('Photo uploaded — save to apply');
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setUploading('');
    }
  };

  const updateLink = (index, field, value) => {
    setLinks((current) =>
      current.map((link, position) => (position === index ? { ...link, [field]: value } : link)),
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      const data = await sint.updateProfile({
        ...form,
        ...(user?.isPublisher ? { category: form.category } : {}),
        avatarUrl,
        coverUrl,
        links: links.filter((link) => link.url.trim()),
      });
      updateUser(data.user);
      toast.success('Profile saved');
      navigate(`/u/${data.user.id}`, { replace: true });
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-form">
      <div className="page-title-row">
        <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h1>Edit profile</h1>
      </div>

      <form className="stack" onSubmit={submit}>
        <div>
          <div className="panel-title">Cover</div>
          <div
            className="cover"
            style={coverUrl ? { backgroundImage: `url(${mediaUrl(coverUrl)})` } : undefined}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => coverInput.current?.click()}
              disabled={uploading === 'cover'}
            >
              <ImageIcon />
              {uploading === 'cover' ? 'Uploading…' : 'Change cover'}
            </button>
            {coverUrl ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCoverUrl('')}>
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              pickImage(event.target.files?.[0], 'cover');
              event.target.value = '';
            }}
          />
        </div>

        <div>
          <div className="panel-title">Photo</div>
          <div className="row">
            <Avatar name={form.fullName} src={avatarUrl} size="lg" />
            <div className="stack" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading === 'avatar'}
              >
                {uploading === 'avatar' ? 'Uploading…' : 'Change photo'}
              </button>
              {avatarUrl ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatarUrl('')}>
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(event) => {
              pickImage(event.target.files?.[0], 'avatar');
              event.target.value = '';
            }}
          />
        </div>

        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={form.fullName} onChange={set('fullName')} required />
        </label>

        {user?.isPublisher ? (
          <label className="field">
            <span className="label">Category</span>
            <select className="select" value={form.category} onChange={set('category')}>
              <option value="">No category</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span className="label">Bio</span>
          <textarea className="textarea" value={form.bio} onChange={set('bio')} maxLength={1000} />
        </label>

        <div className="row wrap" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1, minWidth: 180 }}>
            <span className="label">Location</span>
            <input className="input" value={form.location} onChange={set('location')} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 180 }}>
            <span className="label">Phone</span>
            <input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" />
          </label>
        </div>

        <label className="field">
          <span className="label">Address</span>
          <input className="input" value={form.address} onChange={set('address')} />
        </label>

        <label className="field">
          <span className="label">Contact email</span>
          <input
            className="input"
            type="email"
            value={form.contactEmail}
            onChange={set('contactEmail')}
            placeholder="hello@yourbusiness.sb"
          />
        </label>

        <div>
          <div className="panel-title">Links</div>
          <div className="stack" style={{ gap: 8 }}>
            {links.map((link, index) => (
              <div key={index} className="link-row">
                <input
                  className="input"
                  value={link.label ?? ''}
                  onChange={(event) => updateLink(index, 'label', event.target.value)}
                  placeholder="Facebook"
                  maxLength={40}
                />
                <input
                  className="input"
                  value={link.url ?? ''}
                  onChange={(event) => updateLink(index, 'url', event.target.value)}
                  placeholder="https://facebook.com/yourbusiness"
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove link"
                  onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>

          {links.length < MAX_LINKS ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => setLinks((current) => [...current, { label: '', url: '' }])}
            >
              + Add a link
            </button>
          ) : null}
          <p className="hint">
            Website, Facebook, Instagram — up to {MAX_LINKS}. A blank label shows the domain.
          </p>
        </div>

        <button type="submit" className="btn btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
