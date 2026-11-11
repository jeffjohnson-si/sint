import { useEffect, useRef, useState } from 'react';
import * as sint from '../lib/sint.js';
import { compressImages } from '../lib/images.js';
import { useToast } from './Toast.jsx';
import { CloseIcon, ImageIcon } from './icons.jsx';

const MAX_IMAGES = 10;

/**
 * Shared composer for creating and editing a post. New files are uploaded on
 * submit, then merged with media that was already attached to the post.
 */
export function PostForm({
  initial,
  categories,
  defaultCategory,
  submitLabel = 'Publish',
  onSubmit,
  busy = false,
}) {
  const toast = useToast();

  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState(initial?.category || defaultCategory || '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [existing, setExisting] = useState(initial?.media ?? []);
  const [picked, setPicked] = useState([]);
  const [working, setWorking] = useState(false);

  const imageInput = useRef(null);
  const videoInput = useRef(null);
  const previews = useRef([]);

  // Object URLs are only placeholders and have to be released. Tracking them in
  // a ref means adding a second file does not revoke the first one's preview.
  useEffect(() => {
    previews.current = picked.map((item) => item.preview);
  }, [picked]);

  useEffect(
    () => () => {
      previews.current.forEach((preview) => URL.revokeObjectURL(preview));
    },
    [],
  );

  const addFiles = (files, type) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;

    if (type === 'video') {
      const alreadyHasVideo =
        picked.some((item) => item.type === 'video') ||
        existing.some((item) => item.type === 'video');
      if (alreadyHasVideo) {
        toast.error('A post can hold one video');
        return;
      }
      setPicked((current) => [
        ...current,
        { key: `v-${Date.now()}`, file: list[0], type: 'video', preview: URL.createObjectURL(list[0]) },
      ]);
      return;
    }

    const imageCount =
      picked.filter((item) => item.type === 'image').length +
      existing.filter((item) => item.type === 'image').length;
    const room = MAX_IMAGES - imageCount;
    if (room <= 0) {
      toast.error(`A post can hold at most ${MAX_IMAGES} images`);
      return;
    }
    if (list.length > room) toast.error(`Only ${room} more image${room === 1 ? '' : 's'} can be added`);

    setPicked((current) => [
      ...current,
      ...list.slice(0, room).map((file, index) => ({
        key: `i-${Date.now()}-${index}`,
        file,
        type: 'image',
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePicked = (key) => {
    setPicked((current) => {
      const target = current.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.key !== key);
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!content.trim() && picked.length === 0 && existing.length === 0) {
      toast.error('Add some text or media to your post');
      return;
    }

    setWorking(true);
    try {
      const images = picked.filter((item) => item.type === 'image').map((item) => item.file);
      const video = picked.find((item) => item.type === 'video')?.file ?? null;

      let uploaded = { images: [], video: null };
      if (images.length || video) {
        // Shrink before sending: a 4 MB phone photo becomes a few hundred KB.
        uploaded = await sint.upload({ images: await compressImages(images), video });
      }

      const media = [
        ...existing,
        ...(uploaded.images ?? []),
        ...(uploaded.video ? [uploaded.video] : []),
      ];

      await onSubmit({
        content: content.trim(),
        category,
        location: location.trim(),
        media,
      });
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setWorking(false);
    }
  };

  const disabled = busy || working;

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="label">What is happening?</span>
        <textarea
          className="textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Tell people about a special, a new service, or something worth visiting…"
          maxLength={2000}
          style={{ minHeight: 132 }}
        />
        <span className="hint">{content.length}/2000</span>
      </label>

      <div className="upload-grid">
        {existing.map((item, index) => (
          <div key={`${item.url}-${index}`} className="upload-thumb">
            {item.type === 'video' ? (
              <video src={item.url} muted playsInline preload="metadata" />
            ) : (
              <img src={item.url} alt="" />
            )}
            <button
              type="button"
              className="upload-remove"
              aria-label="Remove media"
              onClick={() => setExisting((current) => current.filter((_, i) => i !== index))}
            >
              <CloseIcon width={11} height={11} />
            </button>
          </div>
        ))}

        {picked.map((item) => (
          <div key={item.key} className="upload-thumb">
            {item.type === 'video' ? (
              <video src={item.preview} muted playsInline preload="metadata" />
            ) : (
              <img src={item.preview} alt="" />
            )}
            <button
              type="button"
              className="upload-remove"
              aria-label="Remove media"
              onClick={() => removePicked(item.key)}
            >
              <CloseIcon width={11} height={11} />
            </button>
          </div>
        ))}

        <button
          type="button"
          className="upload-add"
          onClick={() => imageInput.current?.click()}
          aria-label="Add photos"
        >
          <ImageIcon />
        </button>

        <button
          type="button"
          className="upload-add"
          onClick={() => videoInput.current?.click()}
          aria-label="Add a video"
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-500)' }}
        >
          Video
        </button>

        <input
          ref={imageInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files, 'image');
            event.target.value = '';
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          hidden
          onChange={(event) => {
            addFiles(event.target.files, 'video');
            event.target.value = '';
          }}
        />
      </div>
      <span className="hint">Up to {MAX_IMAGES} photos or one video. 10 MB per photo, 50 MB per video.</span>

      <div className="row wrap" style={{ gap: 10 }}>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          <span className="label">Category</span>
          <select
            className="select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Use my business category</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          <span className="label">Location</span>
          <input
            className="input"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Honiara"
            maxLength={200}
          />
        </label>
      </div>

      <button type="submit" className="btn btn-block" disabled={disabled}>
        {working ? 'Uploading…' : busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
