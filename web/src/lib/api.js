/**
 * Thin fetch wrapper around the SINT API.
 *
 * Everything goes through `/api` on the same origin in development (the Vite
 * proxy forwards it to localhost:4000). A production build sets
 * `VITE_API_BASE_URL` and talks to the API host directly.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const ACCESS_KEY = 'sint.access';
const REFRESH_KEY = 'sint.refresh';

export const tokens = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  save(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  saveAccess(accessToken) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details ?? null;
  }

  /** `subscription_required` comes back on a 402 so the UI can open the plans. */
  get code() {
    return this.details?.code ?? null;
  }
}

/** Uploads are served as absolute URLs by the API; relative ones get the base. */
export function mediaUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function send(path, { method = 'GET', json, form, auth = true, token } = {}) {
  const headers = {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  const accessToken = token ?? (auth ? tokens.access() : null);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
    });
  } catch {
    throw new ApiError('Cannot reach SINT. Check your connection and try again.', 0, null);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? `Request failed (${response.status})`,
      response.status,
      data?.details,
    );
  }

  return data;
}

/** Only one refresh may be in flight, or two would race and invalidate each other. */
let refreshing = null;

function refreshSession() {
  if (!refreshing) {
    const refreshToken = tokens.refresh();
    if (!refreshToken) return Promise.reject(new ApiError('Please sign in again', 401, null));

    refreshing = send('/auth/refresh', {
      method: 'POST',
      json: { refreshToken },
      auth: false,
    })
      .then((data) => {
        tokens.save(data.accessToken, data.refreshToken);
        return data;
      })
      .catch((error) => {
        tokens.clear();
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path, options = {}) {
  try {
    return await send(path, options);
  } catch (error) {
    const canRefresh = error.status === 401 && options.auth !== false && !options.token;
    if (!canRefresh) throw error;

    await refreshSession();
    return send(path, options);
  }
}
