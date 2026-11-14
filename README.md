# SINT — Solomon Islands Net Trade

Every business in the Solomon Islands in one place: a business directory with a
social feed. Businesses, companies and freelancers publish posts; everyone can
browse, follow, like, comment and message.

- `backend/` — Node.js + Express + MongoDB (Mongoose) REST API with JWT auth
- `mobile/` — Flutter app (web, Android, iOS) using Provider
- `web/` — React + Vite browser client (the web app)

Design is deliberately plain: white background, black text, grey accents, Inter
from Google Fonts.

## Prerequisites

- Node.js 20+ and a running MongoDB (local `mongodb://127.0.0.1:27017` or Atlas)
- Flutter 3.35+ with the web target enabled

## Run the API

```powershell
cd backend
npm install
copy .env.example .env   # then edit if needed
npm run seed             # optional demo data
npm run dev              # http://localhost:4000
```

`npm test` runs the end-to-end API suite against a throwaway `sint_test`
database (a local MongoDB must be reachable).

### Database

`MONGO_URI` is the only database setting. Point it at a managed replica set for
production (`mongodb+srv://...`) — nothing else in the code changes.

Development builds any missing index when the API connects. Production sets
`autoIndex: false` so a deploy never turns into an index build, so after a schema
change run:

```powershell
npm run sync-indexes            # create missing indexes, drop nothing
npm run sync-indexes -- --prune # also drop indexes no longer in the schemas
```

`--prune` removes any index that is not declared in a schema, including ones
added by hand. Leave it off unless an old index really needs to go.


Demo accounts created by the seed (password `password123` for all):

- `demo@sint.sb` — business on the yearly plan, for testing the whole flow
- `lime@sint.sb` — restaurant (business, yearly plan, verified)
- `coral@sint.sb` — hotel (company, yearly plan, verified)
- `tours@sint.sb` — travel (business)
- `joyce@sint.sb` — freelance designer
- `glow@sint.sb` — business still on its free trial
- `wantok@sint.sb` — business whose plan lapsed (hits the paywall)
- `peter@sint.sb` / `mary@sint.sb` — normal users

## Run the app

```powershell
cd mobile
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4000
```

For Android emulators the host machine is `10.0.2.2`:

```powershell
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

Release web build: `flutter build web --release --dart-define=API_BASE_URL=https://api.yourdomain`

## Run the web app

`web/` is the browser client: React + Vite, no UI framework, ~105 KB gzipped.
It is deliberately light — most Solomon Islands traffic is a phone browser on
metered mobile data, where a Flutter web bundle (CanvasKit, WebGL) is a poor fit.

```powershell
cd backend
npm run dev                      # API on http://localhost:4000

cd ..\web
npm install
npm run dev                      # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `localhost:4000`, so the
browser only ever talks to one origin and CORS never comes into play.

For a production build, point the app at the API host and serve `dist/`:

```powershell
$env:VITE_API_BASE_URL = "https://api.yourdomain"
npm run build
```

Sign in with any demo account from the seed (`peter@sint.sb`, `lime@sint.sb`, …,
password `password123`).

**The web client has no public pages.** A visitor lands on `/welcome` and must
sign in or create an account before the feed, profiles, search or messaging
render; a signed-out deep link is bounced to `/signin` and returned to the
original URL after signing in.

**Development shortcut.** `/welcome` and `/signin` show a "Development only"
panel with one-click buttons for `demo@sint.sb` (business, yearly plan, can
publish) and `peter@sint.sb` (normal user). It calls `POST /auth/dev-login`,
which returns **404 when NODE_ENV=production**, and the panel itself is compiled
out of production builds — the strings do not appear in `dist/`. No credentials
are held in the browser bundle. The verify screen also offers "Fill it in" next
to the development code, so sign up can be walked end to end without leaving
the page.

Sign up offers two choices — normal user, or business (business / company /
freelancer) — then:

1. `/verify-email` — confirm the address with the 6-digit code that was emailed
   (development shows it on screen, since there is no SMTP server)
2. `/setup` — optional profile set up: cover photo, profile photo, description,
   location. **Skip for now** goes straight to the feed; everything here is
   editable later from the profile page

A session is issued at sign up so the verify screen works, which means the
verification gate is enforced by the web client. To make it a hard boundary,
reject unverified accounts in the API (`user.emailVerified === false`) — do that
together with adding a verification screen to the Flutter app, or new mobile
sign ups would be locked out. The Flutter app also still browses without an
account.

What the web client covers:

- Sign in, sign up (all four account types), and the three-step password reset
- For You / Following feed, category rail, suggested businesses, infinite scroll
- Posts: like, save, share, create with photos and video, edit, delete
- Comments and one level of replies, with likes
- Profiles: follow, message, followers/following lists, edit profile and links
- Search with live results and the keyword → category mapping
- Chat with image attachments, polled every 8s; unread badges polled every 15s
- Notifications, the plans screen, and the interests onboarding form

The web client reuses the same API, subscription and paywall logic as the Flutter
app; publishing a post from either client behaves identically.

## API surface

All routes are prefixed with `/api`. Protected routes need
`Authorization: Bearer <accessToken>`.

- Auth — `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`,
  `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/verify-code`,
  `POST /auth/reset-password`, `POST /auth/verify-email`,
  `POST /auth/resend-verification`.
  Sign up creates the account unverified and emails a 6-digit code; in
  development the code is returned as `devCode` because SMTP is not configured.
  `/verify-email` consumes it and returns a full session, `/resend-verification`
  sends a fresh one (same answer either way, so accounts cannot be enumerated).
  Codes carry a `purpose` (`email_verify` or `password_reset`), so a reset code
  can never be replayed to confirm an address. `emailVerified` is on the user
  JSON; accounts created outside sign up (seed, direct inserts) default to true
  so they are not locked out.
  Forgot password takes an email address and sends a 6-digit code. The code is
  verified with `/verify-code`, which returns a short-lived token scoped to
  `/reset-password`. In development the code is echoed as `devCode`.
  Signing up as a `business`, `company` or `freelancer` must include `category`
  and `location`, and may include `bio`, `phone`, `address`, `contactEmail` and
  `links` — they go straight onto the public profile.
- Feed and posts — `GET /posts?tab=for-you|following&category=&q=&page=`,
  `POST /posts` (publishers only), `GET|PATCH|DELETE /posts/:id`,
  `POST|DELETE /posts/:id/like`, `POST|DELETE /posts/:id/save`
- Comments — `GET|POST /posts/:id/comments`, `PATCH|DELETE /comments/:id`,
  `POST|DELETE /comments/:id/like`, `GET /comments/:id/replies`. A comment needs
  text, up to 4 images (`media`), or both.
- Profiles — `GET /users/:id`, `PATCH /users/me`, `GET /users/:id/posts`,
  `GET /users/me/saved`, `GET /users/me/liked`,
  `POST /users/me/interests` (categories picked at onboarding),
  `POST|DELETE /users/:id/follow`, `GET /users/:id/followers|following`.
  Every account type can list up to 5 `links` (`{ label, url }`); a blank label
  falls back to the host name.
- Messaging — `GET|POST /conversations`, `GET|POST /conversations/:id/messages`,
  `POST /conversations/:id/read`. A message can carry text, up to 4 images and
  1 video (`media`), or any combination.
- Notifications — `GET /notifications`, `GET /notifications/unread-count`,
  `POST /notifications/read-all`, `POST /notifications/:id/read`
- Search — `GET /search?q=`, `GET /search/categories`
- Suggestions — `GET /suggestions?limit=` returns businesses ranked by the
  categories the viewer searches, follows, likes, saves and comments on, topped
  up with popular publishers. Subscribed businesses come first.
- Subscriptions — `GET /subscription` (plans, trial length, current state),
  `POST /subscription/checkout` (returns a Dodo Payments checkout URL),
  `POST /subscription/cancel`, `POST /subscription/refresh`,
  `POST /subscription/webhook` (Dodo, raw body). With no Dodo credentials
  checkout returns a clear 400 and the plans screen disables its buttons; plans,
  trials and the paywall keep working.
- Uploads — `POST /uploads` (multipart: `images[]` max 10, `video` max 1,
  `avatar`, `cover`); files are served from `/uploads/...`

Search maps everyday words to categories, so "food" also returns Food & Drinks,
"travel" returns Travel & Transportation and Accommodations, and "health"
returns Health Care businesses.
See `backend/src/config/constants.js` for the full mapping.

## Subscriptions

Only publishers (business, company, freelancer) pay. Normal users never see a
plan. Every new publisher gets a **14 day free trial**, then:

- **SBD 150 / month** — publish, stay listed, feed boost, Suggested strip,
  cancel any time
- **SBD 1,500 / year** — everything monthly has, plus a **verified badge** on
  the profile and every post, two months free and a price locked for 12 months

Each plan carries its own "what you get" list in
`backend/src/config/constants.js` (`SUBSCRIPTION_PLANS[*].benefits`), and the
app renders the list of whichever plan is selected. `verified: true` on a plan
is what grants the badge, exposed as `isVerified` on users and on the author
refs embedded in posts, comments and conversations.

What a paid plan does:

- Publishing: a trialing or active plan can post. Once it lapses, `POST /posts`
  returns **402** and the app sends the owner to the plans screen. Existing
  posts, the profile and messaging stay visible.
- Boost: **active** plans (not trials) are pushed in the For You feed — their
  posts are ranked as if they were up to `BOOST_WINDOW_MS` (3 days) newer — and
  they are listed first in `GET /suggestions`.

Set these to take real payments (see `backend/.env.example`):

- `DODO_API_KEY` — leave blank to run without card payments; plans, trials and
  the paywall still work, checkout returns a clear error
- `DODO_PRODUCT_MONTHLY`, `DODO_PRODUCT_YEARLY` — the two subscription products
  from the Dodo dashboard. The amount charged is whatever those products are
  priced at; the SBD figures above are what the app displays
- `DODO_WEBHOOK_KEY` — signing secret for `POST /api/subscription/webhook`,
  which is mounted before the JSON parser so the raw body can be verified
- `DODO_MODE` — `test` or `live`
- `APP_BASE_URL` — where checkout returns the customer (`http://localhost:8123`)
- `BILLING_ENFORCED` — leave `false` while payments are not on sale: a lapsed
  plan does not block publishing, and the plans screen says so. Set `true` when
  Dodo goes live, and `/api/subscription` reports the flag so the client adapts.

The webhook handles `subscription.active`, `.renewed`, `.updated`,
`.plan_changed`, `.unpaused`, `.cancelled`, `.expired`, `.failed`, `.on_hold`,
`.past_due` and `.paused`. A cancellation keeps access until the paid period
ends. Trial length lives in `backend/src/config/constants.js`.

### Offline payments

None. Bank-transfer/cash activation was removed along with the `Payment` model
and the admin middleware when the card flow replaced it: `POST
/subscription/payments` returns 404, and a test keeps it that way. If a Solomon
Islands business cannot pay by card, that flow has to be built again from
scratch.



## Deploying

See **[docs/deployment.md](docs/deployment.md)** for the full runbook: Atlas,
SMTP, a Sydney server, Caddy, backups and updates. The short version is one
hostname serving the web build and proxying `/api` and `/uploads` to Node.

Before starting the API anywhere real:

```powershell
cd backend
npm run check-env        # fails loudly on anything unsafe for production
npm run sync-indexes     # production does not build indexes on boot
npm run smoke -- https://sint.yourdomain   # run against the live deploy
```

`npm run check-env` verifies the secrets, database URI, CORS origins, public
base URL, SMTP credentials and upload directory, and tells you which of them are
missing or still pointing at localhost. `npm run smoke` checks the live API:
reachable, reads working, auth enforced, and the development shortcut returning
404.

## Security

- **No secrets in the browser.** The web client only reads `VITE_API_BASE_URL`.
  Every key (`DODO_*`, `SMTP_*`, `JWT_*`, `MONGO_URI`) stays in the API's `.env`.
  `dist/` is scanned for key-shaped strings before shipping.
- **Sign-in throttling.** Five failed attempts per 15 minutes, keyed by email
  *and* IP. Successful sign-ins are not counted. The 429 carries the wait time
  in the message and in `Retry-After`. `LOGIN_MAX_ATTEMPTS` overrides the five.
- **Uploads are restricted.** JPG and PNG only, `MAX_IMAGE_MB` (5 MB) each, up
  to 10 per post; video is MP4/MOV/WebM. The API also checks the first bytes of
  every file, so a script or PDF renamed to `.jpg` is refused and deleted.
- **Errors say nothing useful.** Failures return one friendly sentence; schema
  names, duplicate keys, stack traces and driver messages are logged on the
  server only. A 500 also returns a short `errorId` to quote in a bug report.
- **Headers.** `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy`, plus
  `Cache-Control: no-store` on `/api` so no shared cache keeps private data.
  HSTS is added in production. The web app's CSP belongs in Caddy — see
  `docs/deployment.md`.
- **Auth cannot be forged with a header.** Identity comes only from a signed
  bearer token; `X-User-Id`, `X-Forwarded-User` and similar are ignored.
- **Database and storage stay private.** MongoDB listens on `127.0.0.1` in
  development; in production use Atlas with auth + an IP allowlist, and never
  open 27017. Uploads are served by the API (no directory listing, no traversal).
  Bind the API to `127.0.0.1` behind the reverse proxy so `X-Forwarded-For`
  cannot be spoofed to dodge the rate limits.

## Notes and limits

- New shoppers pick categories in `InterestsScreen` (Flutter) or `/interests`
  (web, from the account menu). Those picks seed the same interest scores that
  likes, follows, saves, comments and searches feed, and posts in them rank as
  `INTEREST_WINDOW_MS` (2 days) newer. It is a nudge, not a filter: skipping the
  form, or being outside someone's interests, still shows every business post.

- Account types: `user`, `business`, `company`, `freelancer`. Only the last
  three can publish posts; the Create Post tab is hidden for normal users, and
  publishers whose plan lapsed keep the tab but land on the plans screen.
- Badges are polled, not pushed: the web client polls notification and message
  counts every 15s and an open chat every 8s. There are no websockets.
- Uploads are stored on the API server's local disk under `backend/uploads`.
  Point a volume at it, or swap in S3/R2, before production. Deleting a post
  does not delete its files yet.
- Email is only logged in development (`jsonTransport`); set `SMTP_*` or a
  provider before going live, otherwise nobody receives a verification or reset
  code. The API echoes `devCode` so the flow is testable without SMTP.
- Verification is enforced by the web client. The API still issues a session at
  sign up, and the Flutter app has no verification screen, so making it a hard
  server-side rule needs both clients updated together.
- Password reset codes issue a 15 minute token scoped to `password_reset`; a
  normal access token is refused by `/auth/reset-password` and a reset token is
  refused everywhere else. Access tokens cannot be revoked before they expire —
  there is no server-side sign out or refresh rotation yet.
- Before deploying, set `NODE_ENV=production`, a real `JWT_SECRET`,
  `JWT_REFRESH_SECRET` and `CORS_ORIGINS` — the server refuses to boot with the
  development defaults in production.
