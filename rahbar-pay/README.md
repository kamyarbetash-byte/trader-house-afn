# Rahbar Pay — راهبر پی

A digital financial services web app (working prototype), designed for people who rarely use websites. It works in the browser with no app install, and it is meant to be as easy as sending a WhatsApp message while still keeping professional order management, security and an audit trail. Rahbar Pay is a separate product from the nirkh.com site in the root of this repository. It has its own Worker, database and code, and shares nothing with it.

> **Demo environment.** No real money moves. Every request is marked *demo*. Do not connect real payment accounts, and do not enable crypto services, until you have the required legal and provider authorization.

## Customer experience rules

1. **Home screen = four big buttons:** پرداخت بل (pay a bill), کریدت موبایل (mobile top-up), خدمات حساب (account services) and درخواست‌های من (my requests). There are no charts, no jargon and no menus.
2. **Plain words:** "شماره رسید" instead of "transaction reference", "پول تأیید شد" instead of "payment verified". Crypto services stay hidden from customers and locked on the server.
3. **Three steps at most:** معلومات (details) → پرداخت (payment) → ارسال (send). Services without a payment take two steps. Choices are large tap tiles with icons, and top-up has quick amount buttons.
4. **Easy to read and tap:** large buttons and text, clear Dari, recognizable icons, one short sentence of instruction per field.
5. **Tracking is a conversation:** each request opens a WhatsApp-style chat.
   - Status updates arrive as messages from "راهبر پی".
   - A progress bar shows "مرحله ۲ از ۵" and what comes next.
   - The customer and staff can write to each other, and ✓✓ marks a message as read by staff.
   - Quick-reply chips are offered, such as "پول را فرستادم".
   - The request list looks like a chat list, with unread counts.

Also:

- **Language:** Dari is the default and the layout is right-to-left. English is one tap away.
- **Mobile first:** on a desktop screen the app stays phone-width.
- **No passwords for customers:** they sign in with mobile number → 6-digit code. The name is asked once, the first time. The code field submits by itself when 6 digits are typed.
- **Support:** a support button is always visible, and support itself is one ongoing chat.
- **Error messages** say exactly what to do, for example "شماره درست نیست. ۱۰ رقم بنویسید که با ۰۷ شروع شود، مثل ۰۷۹۹۱۲۳۴۵۶".
- **Digits:** receipt numbers, phone numbers and tracking numbers always show Latin digits, so they match the paper receipt or SMS. Dari and Arabic digits typed by the customer are accepted everywhere.
- **Slow connections:**
  - No third-party requests. The font is self-hosted Vazirmatn, about 100 KB, cached for a year.
  - Receipt photos are resized in the browser (max 1600 px, JPEG) before upload.
  - Badges and chats are polled with small JSON requests, and polling pauses when the tab is hidden.
  - Requests time out after 25 seconds with a clear "slow internet" message instead of spinning forever.
- **No install needed:** the app has a web manifest, so customers can add it to the home screen if they want.

## Pages

| Customer (`/`) | Admin (`/admin`) |
|---|---|
| Home — four buttons `/` | Admin login + 2FA `/admin/login` (first admin: `/admin/setup`) |
| Sign in / sign up `/login` | Overview `/admin` |
| Request in 3 steps `/new/bill_payment`, `/new/mobile_topup`, `/account` → `/new/…` | Request management, including the customer chat `/admin/requests` |
| My requests (chat list) `/requests` | Customer management `/admin/customers` |
| Request conversation + progress `/requests/RP-…` | Payment reconciliation `/admin/reconciliation` |
| Support chat `/support` | Reports (daily / monthly + CSV) `/admin/reports` |
| My account `/me` · Payments `/payments` · Alerts `/alerts` | Support, notifications, audit log, settings |

## Payment methods

| Method | Status in the prototype |
|---|---|
| **ATOMA Pay** | Manual verification (API after the provider agreement) |
| **Hesap Pay (حساب پی)** | Manual verification (API after the provider agreement) |
| **Bank transfer** | Manual verification, company account only |
| **Authorized card gateway** | Disabled until a gateway is integrated |

An admin can switch each method between *manual* and *disabled* under **System settings → Payment methods**. The *API* status only becomes available once a real provider integration is deployed.

## Rules the server enforces

- **Payment Verified needs an independent record.** A request can only move to *Payment Verified* (or to *Processing*, for paid services) once an operator has recorded a verification from one of three sources: a provider API, a verified bank transaction record, or an independently checked official statement. The operator must also confirm it was checked independently of the customer's receipt. A receipt upload never verifies a payment.
- **Verified amount must match.** The verified amount has to equal the requested amount. If it doesn't, the operator records a *mismatch* instead.
- **Duplicate transaction detection.**
  - The same customer can't reuse a payment reference. References are compared after normalizing case and punctuation.
  - If a different customer submits the same reference, the request is accepted but flagged for operators.
  - A reference can only be *verified* once (enforced by a unique database index).
- **Status order:** Pending → Under Review → Payment Verified → Processing → Completed. A request can be Rejected at any step, and a rejection needs a reason that the customer sees.
- **Crypto services:** Buy and Sell Crypto have the status `legal_pending` and can't receive requests. An admin can activate them only after explicitly confirming that legal authorization was obtained, and that confirmation is written to the audit log.
- **Audit log:** every admin action is recorded with the operator ID, timestamp, IP address and details. This covers status changes, verifications, notes, assignments, views of customers and files, settings, staff, reports and announcements.
- **Roles:** customers, operators and admins.
  - Only admins can change settings, services, payment methods or staff, suspend customers, or broadcast announcements.
  - Admin functions are never sent to customer sessions. The two use separate cookies, and the staff cookie is limited to the path `/api/admin`.
- **Telegram:** messages contain only a status line, never amounts, names, account details or tracking numbers.

## Security

- **Customer sign-in:** no password. A 6-digit one-time code is sent to the phone, stored hashed, valid for 10 minutes, with at most 5 attempts.
- **Staff passwords:** hashed with PBKDF2-SHA256 (100k iterations, a salt per user).
- **Sessions:** random tokens in an HttpOnly, Secure, SameSite=Strict cookie. Only the SHA-256 of each token is stored. Customer sessions last 7 days and staff sessions 8 hours.
- **Staff two-factor authentication:** TOTP (RFC 6238), set up at first sign-in. An admin can reset another staff member's 2FA.
- **Rate limits:** on sign-in, codes, chat messages, submissions, uploads and tickets.
- **Account lockout:** staff accounts lock for 30 minutes after 5 failed logins. A customer code stops working after 5 wrong tries.
- **CSRF protection:** an Origin check on every POST/PATCH request, plus SameSite=Strict cookies.
- **Uploads:** JPG, PNG or PDF only, checked by file signature (magic bytes). Files are served only to their owner or to staff, with `nosniff` and a sandbox CSP.
- **Response headers:** strict CSP (scripts from the site only), HSTS, `frame-ancestors 'none'`, a referrer policy and a permissions policy.
- **Input handling:** every value is validated on the server, and all SQL is parameterized.
- **Output escaping:** HTML is escaped by a tagged-template helper (`public/assets/js/core/html.js`).

## Project layout

```
rahbar-pay/
├── wrangler.toml            Worker, static assets, D1 and (optional) R2 configuration
├── migrations/0001_init.sql Schema + seed services and payment methods
├── migrations/0002_simple_ux.sql  Code sign-in, request conversations, plain-Dari services
├── src/
│   ├── worker.js            Router, security headers, Telegram webhook, cron cleanup
│   ├── lib/util.js          Validation, IDs, PBKDF2, TOTP
│   ├── lib/auth.js          Sessions, roles, rate limits, audit log
│   ├── lib/notify.js        In-app + Telegram notifications
│   └── routes/customer.js   Public + customer API
│       routes/admin.js      Admin API
├── styles/app.css           Tailwind v4 theme (design tokens + components)
└── public/
    ├── index.html           Customer single-page app
    ├── admin.html           Admin single-page app
    └── assets/
        ├── app.css          Built CSS (committed, so a deploy needs no build step)
        ├── img/             Logo mark + wordmark (SVG)
        └── js/core|app|admin
```

To add a new service, insert a row into `services`. The `fields` JSON column defines the form fields the customer fills in, so no frontend code changes.

## Run locally

```bash
cd rahbar-pay
npm install
npx wrangler d1 migrations apply rahbar-pay --local
echo 'ADMIN_SETUP_KEY=choose-a-long-random-key' > .dev.vars
npm run dev            # builds CSS, starts http://localhost:8787
```

1. Open `/`, tap a button and enter any 07… number. In demo mode the one-time code is shown on screen, and the name is asked once.
2. Open `/admin/setup` and create the first administrator with your `ADMIN_SETUP_KEY`.
3. Sign in at `/admin`. Add the secret key shown to an authenticator app (Google or Microsoft Authenticator) and enter the 6-digit code.

## Deploy to Cloudflare (Workers + D1)

```bash
cd rahbar-pay
npx wrangler login
npx wrangler d1 create rahbar-pay            # copy the database_id into wrangler.toml
npx wrangler d1 migrations apply rahbar-pay --remote
npx wrangler secret put ADMIN_SETUP_KEY      # long random string
npm run deploy
```

Then open `https://rahbar-pay.<your-subdomain>.workers.dev/admin/setup` once to create the first admin.

To use your own domain, add `routes = [{ pattern = "pay.example.com", custom_domain = true }]` to `wrangler.toml`.

To deploy automatically from GitHub, create a Workers Builds project in the Cloudflare dashboard with **root directory `rahbar-pay`** and deploy command `npx wrangler deploy`. The existing site at the repository root keeps its own Worker and is not affected.

### Optional: R2 storage for receipts

```bash
npx wrangler r2 bucket create rahbar-pay-files
```

Then uncomment the `[[r2_buckets]]` block in `wrangler.toml`. Without R2, receipts are stored in D1 with a 2 MB limit, which is meant for the demo only.

### Optional: Telegram notifications

1. Create a bot with @BotFather.
2. Run `npx wrangler secret put TELEGRAM_BOT_TOKEN`, then `npx wrangler secret put TELEGRAM_WEBHOOK_SECRET` with any random string.
3. Set the webhook:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>"
   ```

4. Enter the bot username under **Admin → System settings → General**.
5. Customers link Telegram under **Profile → Telegram**.
6. Optional: run `npx wrangler secret put TELEGRAM_ADMIN_CHAT` to send operator alerts, which carry counts only.

### Optional: daily cleanup

Add the following to `wrangler.toml` to delete expired sessions, codes and rate-limit rows every day:

```toml
[triggers]
crons = ["17 2 * * *"]
```

### Before going live

1. Get legal authorization and sign provider agreements, for example with ATOMA Pay and Hesap Pay.
2. Connect an SMS provider in `issueOtp()` (`src/routes/customer.js`), then set `DEMO_MODE = "false"`.
3. Put the company bank account details in each payment method's instructions. Never use a personal account.
4. Build the provider API verification, which records `payments` rows with `source = 'provider_api'`, and only then allow the `api` method status.
5. Have the system security-reviewed before any real customer uses it.

## Screenshots

| Home | Step 1 | Step 2 (Hesap Pay) | Step 3 |
|---|---|---|---|
| ![](docs/screenshots/home-fa.png) | ![](docs/screenshots/step1-fa.png) | ![](docs/screenshots/step2-hesap-pay-fa.png) | ![](docs/screenshots/step3-fa.png) |

| Request conversation | My requests | Admin request review |
|---|---|---|
| ![](docs/screenshots/tracking-chat-fa.png) | ![](docs/screenshots/requests-list-fa.png) | ![](docs/screenshots/admin-request-fa.png) |
