# Deploying SINT

The short version: **one small server in Sydney, MongoDB on Atlas, one domain,
Caddy in front**. The API and the web app live on the same hostname, so there is
no cross-origin setup to get wrong.

```
browser
   │  https://sint.yourdomain
   ▼
 Caddy ──── /            → /var/www/sint/web   (static React build)
   │    ├── /api/*       → 127.0.0.1:4000      (Node API)
   │    └── /uploads/*   → 127.0.0.1:4000      (uploaded media)
   ▼
 Node (Express) ──► MongoDB Atlas (Sydney) ──► SMTP provider (verification mail)
```

## 0. What you need to create yourself

| What | Where | Cost |
| --- | --- | --- |
| MongoDB Atlas cluster | cloud.mongodb.com, M0 free, region **Sydney** | free to ~$9/mo |
| SMTP credentials | Zoho Mail / Brevo / Mailgun / Resend (see §2) | free tier is enough |
| A server | DigitalOcean/Hetzner/Vultr, 1 vCPU / 1 GB, **Sydney** | ~$6–12/mo |
| A domain | any registrar, then Cloudflare for DNS | ~$10–20/yr |
| Dodo Payments (later) | dashboard.dodopayments.com | free to start |

Nothing below can happen without those.

## 1. Database — MongoDB Atlas

1. Create a project, then **Build a database → M0 (free)**.
2. Region: **AWS / ap-southeast-2 (Sydney)** — closest to Honiara.
3. **Database Access → Add New Database User**: username `sint`, generate a
   password (save it).
4. **Network Access → Add IP Address**: the server's public IP (or `0.0.0.0/0`
   while testing, then tighten it).
5. **Connect → Drivers** and copy the string. Add the database name:

```
mongodb+srv://sint:<password>@cluster0.xxxxx.mongodb.net/sint?retryWrites=true&w=majority
```

The free tier is plenty: photos and videos live in `backend/uploads`, not in the
database.

## 2. Email — SMTP

Sign up sends a 6-digit code, so **the API refuses to start in production
without SMTP** (clear error, not a silent failure).

Options, cheapest first:

- **Brevo** — 300 emails/day free. SMTP: `smtp-relay.brevo.com:587`.
- **Zoho Mail** — free mailbox on your own domain. `smtp.zoho.com:587`.
- **Mailgun / Resend** — pay-as-you-go, best deliverability.

You need: host, port (usually 587), a login, a password/API key, and a From
address the provider has authorised.

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<the SMTP login Brevo shows next to the key>
SMTP_PASS=<the SMTP key>
SMTP_FROM=SINT <noreply@yourdomain>
```

Test it before touching anything else:

```bash
cd backend
npm run test-email -- you@yourdomain
```

It sends a real verification email through the same code path sign up uses, and
prints the provider's error verbatim if it fails (`535` = bad key, `550` =
unverified sender, timeouts = wrong host/port).

### Brevo specifics

- Free plan: 300 emails/day, enough for a private beta.
- **The SMTP login is not your account email.** Brevo shows a login like
  `8f2c1a001@smtp-brevo.com` next to the SMTP key — use that as `SMTP_USER`.
- Sending from a domain you do not own yet? In Brevo add a **sender** address
  (Senders, Domains & Dedicated IPs → Senders → Add a sender) and click the
  confirmation link. That is enough to send, but the From will be your personal
  address.
- For production: add the **domain**, publish the SPF and DKIM records Brevo
  gives you (plus a DMARC record, `v=DMARC1; p=none; rua=mailto:you@yourdomain`),
  then switch `SMTP_FROM` to `noreply@yourdomain`. Without those records the
  codes will land in spam or be refused.

## 3. Server

Ubuntu 24.04, 1 vCPU / 1 GB is enough to start.

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs caddy git

# Run the app as its own user
sudo useradd --system --create-home --shell /usr/sbin/nologin sint
sudo mkdir -p /srv/sint /var/www/sint
sudo chown -R sint:sint /srv/sint /var/www/sint
```

## 4. API

```bash
sudo -u sint git clone <your-repo> /srv/sint   # or rsync the sint/ folder
cd /srv/sint/backend
sudo -u sint npm ci --omit=dev
sudo -u sint cp .env.example .env
sudo -u sint nano .env          # fill it in (below)
sudo -u sint npm run check-env  # must pass before going further
sudo -u sint npm run sync-indexes
```

`.env` for production — the values that matter:

```
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb+srv://sint:<password>@cluster0.xxxxx.mongodb.net/sint?retryWrites=true&w=majority
JWT_SECRET=<64 random chars>
JWT_REFRESH_SECRET=<different 64 random chars>
CORS_ORIGINS=https://sint.yourdomain
PUBLIC_BASE_URL=https://sint.yourdomain
APP_BASE_URL=https://sint.yourdomain
UPLOAD_DIR=/srv/sint/uploads
SMTP_* ...
# v1: no card payments yet, so nothing may block a lapsed plan. Flip to true
# when Dodo goes live.
BILLING_ENFORCED=false
```

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`npm run check-env` checks every one of these and prints what is wrong. The API
also refuses to boot in production with development defaults, no `CORS_ORIGINS`,
or no SMTP.

systemd unit `/etc/systemd/system/sint-api.service`:

```ini
[Unit]
Description=SINT API
After=network.target

[Service]
Type=simple
User=sint
WorkingDirectory=/srv/sint/backend
EnvironmentFile=/srv/sint/backend/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sint-api
curl localhost:4000/api/health   # {"status":"ok","env":"production"}
```

## 5. Web app

```bash
cd /srv/sint/web
sudo -u sint npm ci
sudo -u sint npm run build
sudo rsync -a --delete dist/ /var/www/sint/web/
```

Leave `VITE_API_BASE_URL` empty: the build then calls `/api` on its own origin,
which Caddy proxies. That also means no CORS in the browser.

## 6. Caddy (TLS + routing)

`/etc/caddy/Caddyfile`:

```
sint.yourdomain {
    encode gzip zstd

    handle /api/* {
        reverse_proxy 127.0.0.1:4000
    }

    handle /uploads/* {
        reverse_proxy 127.0.0.1:4000
    }

    handle {
        root * /var/www/sint/web
        try_files {path} /index.html
        file_server
    }
}
```

```bash
sudo systemctl reload caddy
```

Caddy fetches the TLS certificate automatically. Point the domain's DNS at the
server first, ideally through Cloudflare (proxy on, SSL mode "Full (strict)").

## 7. Verify the deploy

Run the smoke test from the server — it checks the API is reachable, reads work,
auth is enforced, and that the development shortcut is switched off:

```bash
cd /srv/sint/backend
npm run smoke -- https://sint.yourdomain
```

```
PASS  API reachable           200 {"status":"ok","env":"production"}
PASS  Feed reads              200, 1 item(s)
PASS  Auth enforced           401
PASS  Dev shortcut disabled   404 as expected
PASS  Search categories       200
```

If `Dev shortcut disabled` fails, the server is running without
`NODE_ENV=production` and anyone can sign in as a demo account. Fix that before
going any further.

Then, by hand:

1. `https://sint.yourdomain` → welcome screen
2. Sign up with a real address → the code email arrives → confirm → feed
3. Post a photo → the image loads from `https://sint.yourdomain/uploads/...`
4. Restart the server and confirm the session survives (it lives in localStorage)

## 8. Backups

```bash
# nightly database dump (run as a cron job on the server)
mongodump --uri="$MONGO_URI" --archive=/var/backups/sint-$(date +%F).gz --gzip

# uploads are plain files
sudo rsync -a /srv/sint/uploads/ /var/backups/uploads/
```

Keep a week of dumps off the box (S3/R2/Backblaze). Atlas paid tiers also do
point-in-time recovery.

## 9. Updating

```bash
cd /srv/sint && sudo -u sint git pull
cd backend && sudo -u sint npm ci --omit=dev && sudo -u sint npm run sync-indexes
sudo systemctl restart sint-api
cd ../web && sudo -u sint npm ci && sudo -u sint npm run build && sudo rsync -a --delete dist/ /var/www/sint/web/
```

Run `npm run sync-indexes` whenever a model changes: production disables
automatic index builds on boot.

## 10. Dodo Payments, when you are ready for real money

1. **Products** — dashboard.dodopayments.com → Products → create two subscription
   products, monthly and yearly, priced in USD. Copy both product ids.
2. **API key** — Developer → API keys → create one (live mode).
3. **Webhook** — Developer → Webhooks → `https://sint.yourdomain/api/subscription/webhook`,
   subscribe to `subscription.*` and `payment.*`, then copy the signing secret.
4. Set `DODO_MODE=live`, `DODO_API_KEY`, `DODO_WEBHOOK_KEY`,
   `DODO_PRODUCT_MONTHLY` and `DODO_PRODUCT_YEARLY`, restart, re-run `check-env`.

The amount charged is whatever each product is priced at; the SBD prices in
`src/config/constants.js` are only what the app displays, so keep the two in
step by hand.

Until then the plans screen shows "card payments are not switched on" and the
trial/paywall logic still works.

## Still true after deploy

- Uploads sit on that one server's disk. Back them up, and plan to move to
  S3/R2 when you outgrow it — the code only needs a storage layer swapped in
  `backend/src/middleware/upload.js`.
- No websockets: badges poll, an open chat polls every 8s.
- Access tokens cannot be revoked before they expire (no server-side sign out).
- Sign-up verification is enforced by the web client; the Flutter app has no
  verification screen yet.
