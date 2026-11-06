-- Rahbar Pay — simple UX update
-- * Customers sign in with phone + one-time code (no password); 'login' purpose for codes.
-- * Conversation messages on each request (WhatsApp-style tracking).
-- * Plain-Dari service names, localized field options, optional receipt photo.

DROP TABLE IF EXISTS otp_codes;
CREATE TABLE otp_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('login')),
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, purpose);

CREATE TABLE request_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  is_staff    INTEGER NOT NULL DEFAULT 0,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_reqmsg_req ON request_messages(request_id, id);

ALTER TABLE requests ADD COLUMN staff_seen_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN customer_seen_at INTEGER NOT NULL DEFAULT 0;

UPDATE settings SET value = 'شنبه تا پنجشنبه، ۸ صبح تا ۶ شام' WHERE key = 'support_hours_fa';
INSERT OR IGNORE INTO settings (key, value) VALUES ('support_phone', '');

-- Crypto stays locked; plain words instead of jargon.
UPDATE services SET name_fa = 'خرید ارز دیجیتال', desc_fa = 'این خدمت فعلاً بسته است. فقط پس از گرفتن اجازه قانونی باز می‌شود.',
  desc_en = 'Closed for now. It opens only after legal permission is obtained.' WHERE id = 'buy_crypto';
UPDATE services SET name_fa = 'فروش ارز دیجیتال', desc_fa = 'این خدمت فعلاً بسته است. فقط پس از گرفتن اجازه قانونی باز می‌شود.',
  desc_en = 'Closed for now. It opens only after legal permission is obtained.' WHERE id = 'sell_crypto';

UPDATE services SET
  name_en = 'Pay a bill', name_fa = 'پرداخت بل',
  desc_en = 'Electricity, water or internet.', desc_fa = 'برق، آب یا انترنت.',
  requires_receipt = 0,
  fields = '[{"key":"biller","label_en":"Which bill?","label_fa":"بل کدام؟","type":"select","required":true,"options":[{"value":"DABS","label_en":"Electricity (DABS)","label_fa":"برق (برشنا)","icon":"bolt"},{"value":"Water","label_en":"Water","label_fa":"آب","icon":"drop"},{"value":"Internet","label_en":"Internet","label_fa":"انترنت","icon":"wifi"}]},{"key":"bill_no","label_en":"Bill number","label_fa":"شماره بل","hint_en":"Written at the top of your bill.","hint_fa":"در بالای کاغذ بل نوشته شده است.","type":"text","inputmode":"numeric","pattern":"^[A-Za-z0-9-]{4,30}$","required":true}]'
WHERE id = 'bill_payment';

UPDATE services SET
  name_en = 'Mobile top-up', name_fa = 'کریدت موبایل',
  desc_en = 'Roshan, AWCC, Etisalat or MTN.', desc_fa = 'روشن، افغان بیسیم، اتصالات یا ام‌تی‌ان.',
  requires_receipt = 0, min_amount = 2500,
  fields = '[{"key":"operator","label_en":"Which company?","label_fa":"کدام شرکت؟","type":"select","required":true,"options":[{"value":"Roshan","label_en":"Roshan","label_fa":"روشن"},{"value":"AWCC","label_en":"AWCC","label_fa":"افغان بیسیم"},{"value":"Etisalat","label_en":"Etisalat","label_fa":"اتصالات"},{"value":"MTN","label_en":"MTN","label_fa":"ام‌تی‌ان"}]},{"key":"msisdn","label_en":"Mobile number to top up","label_fa":"شماره‌ای که کریدت شود","type":"tel","inputmode":"tel","pattern":"^(\\+?93|0)?7[0-9]{8}$","required":true}]',
  sort = 2
WHERE id = 'mobile_topup';

UPDATE services SET
  name_en = 'Account statement', name_fa = 'صورت‌حساب',
  desc_en = 'A list of your requests and payments.', desc_fa = 'فهرست درخواست‌ها و پرداخت‌های شما.',
  fields = '[{"key":"period","label_en":"For how long?","label_fa":"برای چه مدت؟","type":"select","required":true,"options":[{"value":"30d","label_en":"Last month","label_fa":"یک ماه گذشته"},{"value":"90d","label_en":"Last 3 months","label_fa":"سه ماه گذشته"},{"value":"year","label_en":"This year","label_fa":"امسال"}]}]'
WHERE id = 'account_statement';

UPDATE services SET
  name_en = 'Change my details', name_fa = 'تغییر معلومات من',
  desc_en = 'Change your name or other details.', desc_fa = 'تغییر نام یا معلومات دیگر.',
  fields = '[{"key":"change","label_en":"What should change?","label_fa":"چه چیزی تغییر کند؟","hint_en":"Write it in a few words.","hint_fa":"در چند کلمه بنویسید.","type":"textarea","required":true}]'
WHERE id = 'account_update';

UPDATE services SET sort = 1 WHERE id = 'bill_payment';
UPDATE services SET sort = 10 WHERE id = 'buy_crypto';
UPDATE services SET sort = 11 WHERE id = 'sell_crypto';

UPDATE payment_methods SET
  instructions_fa = 'پول را به حساب تجاری رهبر پی در اتوما پی بفرستید. بعد شماره رسید را اینجا بنویسید.',
  instructions_en = 'Send the money to the Rahbar Pay business account on ATOMA Pay. Then type the receipt number here.'
WHERE id = 'atoma_pay';
UPDATE payment_methods SET
  instructions_fa = 'پول را به حساب تجاری رهبر پی در حساب پی بفرستید. بعد شماره رسید را اینجا بنویسید.',
  instructions_en = 'Send the money to the Rahbar Pay business account on Hesap Pay. Then type the receipt number here.'
WHERE id = 'hesap_pay';
UPDATE payment_methods SET
  instructions_fa = 'پول را فقط به حساب بانکی شرکت رهبر پی بفرستید (نه حساب شخصی). بعد شماره رسید بانک را اینجا بنویسید.',
  instructions_en = 'Send the money only to the Rahbar Pay company bank account (never a personal account). Then type the bank receipt number here.'
WHERE id = 'bank_transfer';
UPDATE payment_methods SET name_fa = 'کارت بانکی', name_en = 'Bank card' WHERE id = 'gateway';
