import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { mediaUrl } from '../lib/api.js';
import * as sint from '../lib/sint.js';
import { compressImages } from '../lib/images.js';
import { Avatar, VerifiedBadge } from '../components/Avatar.jsx';
import { BackIcon, ImageIcon, SendIcon } from '../components/icons.jsx';
import { ChatSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { clockTime } from '../lib/format.js';

const POLL_MS = 8000;

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [conversation, setConversation] = useState(null);
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const scrollRef = useRef(null);
  const fileInput = useRef(null);
  const lastId = useRef('');

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        const data = await sint.messages(id);
        setConversation(data.conversation);
        setItems(data.items ?? []);
        setError('');
      } catch (problem) {
        if (!quiet) setError(problem.message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    setItems([]);
    lastId.current = '';
    load();
  }, [load]);

  // Poll for the other side's replies. The API has no socket layer.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) load({ quiet: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!items.length) return;
    const newest = items[items.length - 1];
    if (newest.id === lastId.current) return;
    lastId.current = newest.id;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [items]);

  // Opening the thread clears the unread counter and read receipts.
  useEffect(() => {
    if (!conversation?.id) return;
    sint.markConversationRead(conversation.id).catch(() => {});
  }, [conversation?.id]);

  const attach = (event) => {
    const picked = Array.from(event.target.files ?? []).slice(0, 4);
    const withPreviews = picked.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setFiles((current) => [...current, ...withPreviews].slice(0, 4));
    event.target.value = '';
  };

  const removeFile = (preview) => {
    setFiles((current) => {
      const target = current.find((item) => item.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.preview !== preview);
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() && files.length === 0) return;

    setSending(true);
    try {
      let media = [];
      if (files.length) {
        const uploaded = await sint.upload({
          images: await compressImages(files.map((item) => item.file)),
        });
        media = uploaded.images ?? [];
      }

      const data = await sint.sendMessage(id, {
        text: text.trim(),
        ...(media.length ? { media } : {}),
      });

      setItems((current) => [...current, data.message]);
      setText('');
      files.forEach((item) => URL.revokeObjectURL(item.preview));
      setFiles([]);
    } catch (problem) {
      toast.error(problem.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-chat">
        <ChatSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-chat">
        <div className="page-title-row">
          <button type="button" className="back-btn" onClick={() => navigate('/messages')} aria-label="Back">
            <BackIcon />
          </button>
          <h1>Messages</h1>
        </div>
        <div className="notice">{error}</div>
      </div>
    );
  }

  const other = conversation?.otherUser ?? {};

  return (
    <div className="page page-chat">
      <div className="page-title-row" style={{ marginBottom: 6 }}>
        <button type="button" className="back-btn" onClick={() => navigate('/messages')} aria-label="Back">
          <BackIcon />
        </button>
        <Link to={`/u/${other.id}`} className="row" style={{ gap: 9 }}>
          <Avatar name={other.fullName} src={other.avatarUrl} size="sm" />
          <span className="row" style={{ gap: 4, fontWeight: 600 }}>
            {other.fullName}
            <VerifiedBadge show={other.isVerified} />
          </span>
        </Link>
      </div>

      <div className="chat">
        <div className="chat-scroll" ref={scrollRef}>
          {items.length === 0 ? (
            <p className="muted small" style={{ textAlign: 'center', padding: '24px 0' }}>
              Say hello to {other.fullName ?? 'them'}. Messages here are private.
            </p>
          ) : null}

          {items.map((message) => (
            <div
              key={message.id}
              className={message.isMine ? 'bubble bubble-mine' : 'bubble'}
            >
              {message.text}
              {message.media?.length ? (
                <div>
                  {message.media.map((item) =>
                    item.type === 'video' ? (
                      <video key={item.url} src={mediaUrl(item.url)} controls playsInline />
                    ) : (
                      <a key={item.url} href={mediaUrl(item.url)} target="_blank" rel="noreferrer">
                        <img src={mediaUrl(item.url)} alt="" loading="lazy" />
                      </a>
                    ),
                  )}
                </div>
              ) : null}
              <span className="bubble-time">{clockTime(message.createdAt)}</span>
            </div>
          ))}
        </div>

        {files.length ? (
          <div className="upload-grid" style={{ paddingTop: 8 }}>
            {files.map((item) => (
              <div key={item.preview} className="upload-thumb">
                <img src={item.preview} alt="" />
                <button
                  type="button"
                  className="upload-remove"
                  onClick={() => removeFile(item.preview)}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form className="composer" onSubmit={submit}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach photos"
          >
            <ImageIcon />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={attach}
          />

          <textarea
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
          />

          <button
            type="submit"
            className="icon-btn"
            disabled={sending || (!text.trim() && files.length === 0)}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
