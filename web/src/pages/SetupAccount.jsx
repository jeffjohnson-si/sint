import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { mediaUrl } from '../lib/api.js';
import * as sint from '../lib/sint.js';
import { compressImage } from '../lib/images.js';
import { Avatar } from '../components/Avatar.jsx';
import { useToast } from '../components/Toast.jsx';

/**
 * Step 2 of 2: the optional profile set up. Everything here can be skipped and
 * changed later from the profile page, so the skip button is not a dead end.
 */
export default function SetupAccount() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [coverUrl, setCoverUrl] = useState(user.coverUrl ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [location, setLocation] = useState(user.location ?? '');
  const [uploading, setUploading] = useState('');
  const [saving, setSaving] = useState(false);

  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  const pick = async (file, kind) => {
    if (!file) return;
    setUploading(kind);
    try {
      const prepared = await compressImage(file);
      const data = await sint.upload(kind === 'avatar' ? { avatar: prepared } : { cover: prepared });
      if (kind === 'avatar') setAvatarUrl(data.avatar ?? '');
      else setCoverUrl(data.cover ?? '');
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setUploading('');
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await sint.updateProfile({ bio, location, avatarUrl, coverUrl });
      updateUser(data.user);
      toast.success('Profile saved');
      navigate('/', { replace: true });
    } catch (problem) {
      toast.error(problem.message);
      setSaving(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">S</span>
          <div>
            <div className="auth-title">Set up your profile</div>
            <div className="muted small">Step 2 of 2</div>
          </div>
        </div>

        <p className="small muted" style={{ marginBottom: 18 }}>
          This is optional. You can skip it and add photos or a description any time from your
          profile.
        </p>

        <form className="stack" onSubmit={save}>
          <div>
            <button
              type="button"
              className="setup-cover"
              style={coverUrl ? { backgroundImage: `url(${mediaUrl(coverUrl)})` } : undefined}
              onClick={() => coverInput.current?.click()}
            >
              <span className="setup-cover-label">
                {uploading === 'cover'
                  ? 'Uploading…'
                  : coverUrl
                    ? 'Change cover photo'
                    : 'Add cover photo'}
              </span>
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(event) => {
                pick(event.target.files?.[0], 'cover');
                event.target.value = '';
              }}
            />
          </div>

          <div className="setup-avatar-row">
            <Avatar name={user.fullName} src={avatarUrl} size="lg" />
            <div className="stack" style={{ gap: 5 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading === 'avatar'}
              >
                {uploading === 'avatar'
                  ? 'Uploading…'
                  : avatarUrl
                    ? 'Change profile photo'
                    : 'Add profile photo'}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setAvatarUrl('')}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={avatarInput}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={(event) => {
                pick(event.target.files?.[0], 'avatar');
                event.target.value = '';
              }}
            />
          </div>

          <label className="field">
            <span className="label">
              About {user.isPublisher ? 'your business' : 'you'}{' '}
              <span className="muted tiny">optional</span>
            </span>
            <textarea
              className="textarea"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={1000}
              placeholder={
                user.isPublisher
                  ? 'What do you sell or do? Where can people find you?'
                  : 'A line or two about yourself.'
              }
            />
          </label>

          <label className="field">
            <span className="label">
              Location <span className="muted tiny">optional</span>
            </span>
            <input
              className="input"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Honiara"
              maxLength={200}
            />
          </label>

          <button type="submit" className="btn btn-block" disabled={saving || Boolean(uploading)}>
            {saving ? 'Saving…' : 'Save and continue'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => navigate('/', { replace: true })}
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
