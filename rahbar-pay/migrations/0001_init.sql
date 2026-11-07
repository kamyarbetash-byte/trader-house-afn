-- Rahbar Pay — initial schema (Cloudflare D1 / SQLite)
-- All timestamps are unix seconds (UTC). Money amounts are stored as integer minor units (cents / pul).

CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- e.g. C-7F3K9Q (customers) / S-... (staff)
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','operator','admin')),
  full_name     TEXT NOT NULL,
  phone         TEXT UNIQUE,                 -- E.164, customers log in with phone
  email         TEXT UNIQUE,                 -- staff log in with email
  pass_hash     TEXT NOT NULL,
  pass_salt     TEXT NOT NULL,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  totp_secret   TEXT,                        -- base32, staff only
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  lang          TEXT NOT NULL DEFAULT 'en',
  telegram_chat TEXT,
  telegram_link_code TEXT,
  notify_telegram INTEGER NOT NULL DEFAULT 1,
  notify_email  INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,              -- SHA-256 of the cookie token, never the token itself
  user_id     TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('customer','staff','staff_2fa')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  ua          TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE otp_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, purpose);

CREATE TABLE rate_limits (
  bucket      TEXT PRIMARY KEY,
  count       INTEGER NOT NULL,
  reset_at    INTEGER NOT NULL
);

CREATE TABLE service_categories (
  id          TEXT PRIMARY KEY,
  name_en     TEXT NOT NULL,
  name_fa     TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE services (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES service_categories(id),
  name_en     TEXT NOT NULL,
  name_fa     TEXT NOT NULL,
  desc_en     TEXT NOT NULL DEFAULT '',
  desc_fa     TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT 'service',
  -- active: customers can submit · legal_pending: visible, locked until legally authorised · disabled: hidden
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','legal_pending','disabled')),
  currencies  TEXT NOT NULL DEFAULT 'AFN,USD',
  min_amount  INTEGER NOT NULL DEFAULT 100,
  max_amount  INTEGER NOT NULL DEFAULT 100000000,
  requires_receipt INTEGER NOT NULL DEFAULT 1,
  requires_payment INTEGER NOT NULL DEFAULT 1,
  fields      TEXT NOT NULL DEFAULT '[]',     -- JSON: [{key,label_en,label_fa,type,required,pattern}]
  sort        INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE payment_methods (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,                  -- atoma_pay | hesap_pay | bank_transfer | gateway
  name_en     TEXT NOT NULL,
  name_fa     TEXT NOT NULL,
  -- manual: operator verifies against official records · api: verified through provider API · disabled
  status      TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('manual','api','disabled')),
  instructions_en TEXT NOT NULL DEFAULT '',
  instructions_fa TEXT NOT NULL DEFAULT '',
  ref_pattern TEXT NOT NULL DEFAULT '^[A-Za-z0-9\-]{6,40}$',
  currencies  TEXT NOT NULL DEFAULT 'AFN,USD',
  sort        INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_no   TEXT NOT NULL UNIQUE,         -- RP-YYMM-XXXXXX
  user_id       TEXT NOT NULL REFERENCES users(id),
  service_id    TEXT NOT NULL REFERENCES services(id),
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL CHECK (currency IN ('AFN','USD')),
  details       TEXT NOT NULL DEFAULT '{}',   -- JSON: service-specific account details
  payment_method_id TEXT REFERENCES payment_methods(id),   -- NULL for services without a payment
  payment_ref   TEXT NOT NULL DEFAULT '',
  payment_ref_norm TEXT NOT NULL DEFAULT '',
  receipt_file_id TEXT,
  customer_note TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','under_review','payment_verified','processing','completed','rejected')),
  duplicate_of  TEXT,                         -- tracking no. of an earlier request with the same payment reference
  assigned_to   TEXT REFERENCES users(id),
  reject_reason TEXT,
  is_demo       INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_requests_user ON requests(user_id, created_at DESC);
CREATE INDEX idx_requests_status ON requests(status, created_at DESC);
CREATE INDEX idx_requests_ref ON requests(payment_method_id, payment_ref_norm);

CREATE TABLE request_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id),
  status      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',       -- customer-visible
  actor_id    TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_events_req ON request_events(request_id);

CREATE TABLE internal_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Payment verification records. A request can only reach 'payment_verified' when a row here is
-- 'verified' with an independent source (provider API, bank transaction record or official statement).
CREATE TABLE payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id    INTEGER NOT NULL REFERENCES requests(id),
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  reference_norm TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('verified','mismatch','rejected','refunded')),
  source        TEXT NOT NULL CHECK (source IN ('provider_api','bank_record','official_statement')),
  evidence_ref  TEXT NOT NULL,                -- bank txn id / statement line / provider txn id
  note          TEXT NOT NULL DEFAULT '',
  operator_id   TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_payments_req ON payments(request_id);
CREATE UNIQUE INDEX idx_payments_unique_verified ON payments(payment_method_id, reference_norm) WHERE status = 'verified';

CREATE TABLE files (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  sha256      TEXT NOT NULL,
  storage     TEXT NOT NULL CHECK (storage IN ('r2','d1')),
  data        BLOB,                           -- only when storage = 'd1' (demo)
  created_at  INTEGER NOT NULL
);

CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT,                           -- NULL = broadcast to all customers
  kind        TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  title_fa    TEXT NOT NULL,
  body_en     TEXT NOT NULL DEFAULT '',
  body_fa     TEXT NOT NULL DEFAULT '',
  link        TEXT,
  created_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE notification_reads (
  notification_id INTEGER NOT NULL,
  user_id         TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE support_tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no   TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  subject     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  tracking_no TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE support_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id),
  author_id   TEXT NOT NULL,
  is_staff    INTEGER NOT NULL DEFAULT 0,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT NOT NULL DEFAULT '{}',
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_audit_time ON audit_log(created_at DESC);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Seed data ─────────────────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('support_hours_en', 'Saturday – Thursday, 08:00 – 18:00 (Kabul)'),
  ('support_hours_fa', 'شنبه تا پنجشنبه، ۰۸:۰۰ تا ۱۸:۰۰ (کابل)'),
  ('support_email', 'support@rahbarpay.example'),
  ('maintenance', '0'),
  ('telegram_bot_username', ''),
  ('submissions_open', '1');

INSERT INTO service_categories (id, name_en, name_fa, sort) VALUES
  ('digital_assets', 'Digital Assets', 'دارایی‌های دیجیتال', 1),
  ('account', 'Account Services', 'خدمات حساب', 2),
  ('payments', 'Payments', 'پرداخت‌ها', 3);

INSERT INTO services (id, category_id, name_en, name_fa, desc_en, desc_fa, icon, status, currencies, min_amount, max_amount, requires_receipt, requires_payment, fields, sort, updated_at) VALUES
  ('buy_crypto', 'digital_assets', 'Buy Crypto', 'خرید رمزارز',
   'Request interface only. Locked until Rahbar Pay holds the required legal authorization.',
   'فقط فرم درخواست. تا دریافت مجوز قانونی لازم غیرفعال است.',
   'buy', 'legal_pending', 'USD', 1000, 1000000, 1, 1, '[]', 1, unixepoch()),
  ('sell_crypto', 'digital_assets', 'Sell Crypto', 'فروش رمزارز',
   'Request interface only. Locked until Rahbar Pay holds the required legal authorization.',
   'فقط فرم درخواست. تا دریافت مجوز قانونی لازم غیرفعال است.',
   'sell', 'legal_pending', 'USD', 1000, 1000000, 1, 1, '[]', 2, unixepoch()),
  ('bill_payment', 'payments', 'Utility Bill Payment', 'پرداخت بل خدمات',
   'Pay electricity (DABS), water or internet bills through a verified payment.',
   'پرداخت بل برق (برشنا)، آب یا انترنت از طریق پرداخت تأییدشده.',
   'bill', 'active', 'AFN', 10000, 5000000, 1, 1,
   '[{"key":"biller","label_en":"Biller","label_fa":"صادرکننده بل","type":"select","options":["DABS","Water Supply","Internet Provider"],"required":true},{"key":"bill_no","label_en":"Bill / customer number","label_fa":"شماره بل / مشترک","type":"text","pattern":"^[A-Za-z0-9-]{4,30}$","required":true}]',
   3, unixepoch()),
  ('mobile_topup', 'payments', 'Mobile Top-up', 'شارژ موبایل',
   'Top up a Roshan, AWCC, Etisalat or MTN mobile number.',
   'شارژ شماره روشن، افغان بیسیم، اتصالات یا ام‌تی‌ان.',
   'phone', 'active', 'AFN', 5000, 1000000, 1, 1,
   '[{"key":"operator","label_en":"Mobile operator","label_fa":"شرکت مخابراتی","type":"select","options":["Roshan","AWCC","Etisalat","MTN"],"required":true},{"key":"msisdn","label_en":"Mobile number","label_fa":"شماره موبایل","type":"tel","pattern":"^\\+?93?0?7[0-9]{8}$","required":true}]',
   4, unixepoch()),
  ('account_statement', 'account', 'Account Statement Request', 'درخواست صورت‌حساب',
   'Request an official statement of your Rahbar Pay requests and payments.',
   'درخواست صورت‌حساب رسمی درخواست‌ها و پرداخت‌های شما در راهبر پی.',
   'document', 'active', 'AFN', 0, 0, 0, 0,
   '[{"key":"period","label_en":"Statement period","label_fa":"دوره صورت‌حساب","type":"select","options":["Last 30 days","Last 90 days","This year"],"required":true}]',
   5, unixepoch()),
  ('account_update', 'account', 'Account Details Update', 'به‌روزرسانی اطلاعات حساب',
   'Update your registered name or payout account after identity review.',
   'به‌روزرسانی نام ثبت‌شده یا حساب دریافت پس از بررسی هویت.',
   'user', 'active', 'AFN', 0, 0, 0, 0,
   '[{"key":"change","label_en":"What should change?","label_fa":"چه چیزی تغییر کند؟","type":"textarea","required":true}]',
   6, unixepoch());

INSERT INTO payment_methods (id, provider, name_en, name_fa, status, instructions_en, instructions_fa, ref_pattern, currencies, sort, updated_at) VALUES
  ('atoma_pay', 'atoma_pay', 'ATOMA Pay', 'اتوما پی', 'manual',
   'Pay to the Rahbar Pay ATOMA Pay merchant account shown by your operator, then enter the ATOMA transaction ID. API verification will be enabled after the provider agreement is signed.',
   'به حساب تجاری راهبر پی در اتوما پی پرداخت کنید و شناسه تراکنش اتوما را وارد کنید. تأیید خودکار پس از امضای قرارداد با ارائه‌دهنده فعال می‌شود.',
   '^[A-Za-z0-9\-]{6,40}$', 'AFN,USD', 1, unixepoch()),
  ('hesap_pay', 'hesap_pay', 'Hesap Pay', 'حساب پی', 'manual',
   'Pay to the Rahbar Pay Hesap Pay business account, then enter the Hesap Pay transaction number. API verification will be enabled after the provider agreement is signed.',
   'به حساب تجاری راهبر پی در حساب پی پرداخت کنید و شماره تراکنش حساب پی را وارد کنید. تأیید خودکار پس از امضای قرارداد با ارائه‌دهنده فعال می‌شود.',
   '^[A-Za-z0-9\-]{6,40}$', 'AFN,USD', 2, unixepoch()),
  ('bank_transfer', 'bank_transfer', 'Bank Transfer', 'انتقال بانکی', 'manual',
   'Transfer to the Rahbar Pay company bank account (details issued by an operator — never to a personal account). Enter the bank transfer reference.',
   'به حساب بانکی شرکت راهبر پی انتقال دهید (مشخصات توسط کارمند ارائه می‌شود — هرگز به حساب شخصی). شماره مرجع انتقال بانکی را وارد کنید.',
   '^[A-Za-z0-9\-/]{6,40}$', 'AFN,USD', 3, unixepoch()),
  ('gateway', 'gateway', 'Authorized Card Gateway', 'درگاه کارت مجاز', 'disabled',
   'Available once an authorized payment gateway is integrated.',
   'پس از اتصال یک درگاه پرداخت مجاز در دسترس خواهد بود.',
   '^[A-Za-z0-9\-]{6,40}$', 'AFN,USD', 4, unixepoch());
