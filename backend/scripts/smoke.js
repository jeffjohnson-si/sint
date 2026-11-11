/**
 * Post-deploy smoke test.
 *
 *   npm run smoke -- https://sint.yourdomain
 *
 * Checks the things that are easy to get wrong on a fresh deploy: the API is
 * reachable, reads work, auth is enforced, and — most importantly — the
 * development shortcut is switched off. If `dev-login` answers 200, the server
 * is running with NODE_ENV unset and needs fixing immediately.
 */

const base = (process.argv[2] ?? 'http://localhost:4000').replace(/\/$/, '');

const results = [];
const record = (label, ok, detail) => results.push({ label, ok, detail });

async function get(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

async function main() {
  // 1. The API answers at all.
  try {
    const response = await get('/api/health');
    record(
      'API reachable',
      response.status === 200 && response.body?.status === 'ok',
      `${response.status} ${response.body ? JSON.stringify(response.body) : ''}`,
    );
  } catch (error) {
    record('API reachable', false, error.message);
  }

  // 2. Public reads work (the feed is readable without a token).
  try {
    const response = await get('/api/posts?limit=1');
    record(
      'Feed reads',
      response.status === 200 && Array.isArray(response.body?.items),
      `${response.status}, ${response.body?.items?.length ?? 0} item(s)`,
    );
  } catch (error) {
    record('Feed reads', false, error.message);
  }

  // 3. Protected routes reject anonymous callers.
  try {
    const response = await get('/api/auth/me');
    record('Auth enforced', response.status === 401, `${response.status}`);
  } catch (error) {
    record('Auth enforced', false, error.message);
  }

  // 4. The development shortcut must be gone.
  try {
    const response = await get('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'business' }),
    });
    record(
      'Dev shortcut disabled',
      response.status === 404,
      response.status === 404
        ? '404 as expected'
        : `${response.status} — NODE_ENV is not production, fix this before inviting anyone`,
    );
  } catch (error) {
    record('Dev shortcut disabled', false, error.message);
  }

  // 5. Uploaded media is served from the same host.
  try {
    const response = await get('/api/search/categories');
    record(
      'Search categories',
      response.status === 200 && Array.isArray(response.body?.items),
      `${response.status}`,
    );
  } catch (error) {
    record('Search categories', false, error.message);
  }

  const width = Math.max(...results.map((result) => result.label.length)) + 2;
  console.log(`\nSmoke test against ${base}\n`);
  for (const result of results) {
    console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.label.padEnd(width)} ${result.detail}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.log(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll checks passed.');
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
