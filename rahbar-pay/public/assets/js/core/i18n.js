// English (default, LTR) and Dari (RTL) strings + locale-aware formatting.
const dict = {
  en: {
    brand: 'Rahbar Pay',
    lang_toggle: 'دری',
    demo: 'Demo',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save changes',
    saved: 'Saved',
    close: 'Close',
    back: 'Back',
    continue: 'Continue',
    submit: 'Submit',
    confirm: 'Confirm',
    view_all: 'View all',
    search: 'Search',
    filter_all: 'All',
    none_yet: 'Nothing here yet',
    copy: 'Copy',
    copied: 'Copied',
    optional: 'Optional',
    required: 'Required',
    col_status: 'Status',

    // nav
    nav_logout: 'Sign out',
    nav_home: 'Home',

    // landing

    // auth
    auth_phone: 'Mobile number',
    auth_password: 'Password',
    auth_password_new: 'Create password',
    auth_full_name: 'Full name (as on your Tazkira)',
    auth_code: 'Verification code',
    auth_verify: 'Verify & continue',

    // dashboard
    dash_total: 'Total requests',
    dash_security_tg_off: 'Not linked',
    dash_security_tg_on: 'Linked',
    market_usd: 'USD / AFN',
    market_eur: 'EUR / AFN',
    market_gold: 'Gold · USD/oz',
    market_btc: 'BTC · USD (reference)',

    // services

    // new request
    req_amount: 'Amount',
    req_method: 'Payment method',
    req_ref: 'Transaction reference',
    req_note: 'Note to operator',
    req_tracking: 'Tracking number',
    req_detail_info: 'Request details',
    req_service: 'Service',
    req_submitted: 'Submitted',
    req_updated: 'Last update',
    req_reason: 'Reason',

    st_pending: 'Pending',
    st_under_review: 'Under Review',
    st_payment_verified: 'Payment Verified',
    st_processing: 'Processing',
    st_completed: 'Completed',
    st_rejected: 'Rejected',
    st_pending_d: 'Request received and queued for review.',
    st_under_review_d: 'An operator is checking your request.',
    st_payment_verified_d: 'Payment confirmed against official records.',
    st_processing_d: 'Your request is being carried out.',
    st_completed_d: 'Your request is complete.',
    st_rejected_d: 'Your request could not be accepted.',

    // payments

    // notifications

    // profile
    prof_customer_id: 'Customer ID',
    prof_language: 'Language',
    prof_tg: 'Telegram notifications',
    prof_tg_d: 'Status-only alerts. Never includes amounts or account details.',
    prof_tg_link: 'Link Telegram',
    prof_tg_unlink: 'Unlink',
    prof_tg_nobot: 'The Telegram bot has not been configured by the administrator yet.',

    // support
    sup_title: 'Support center',
    sup_subject: 'Subject',
    sup_category: 'Category',
    sup_send: 'Send',
    sup_reply_ph: 'Write a reply…',
    sup_closed: 'This ticket is closed.',
    cat_general: 'General',
    cat_request: 'A request',
    cat_payment: 'Payment',
    cat_account: 'Account',
    cat_security: 'Security',
    tk_open: 'Open',
    tk_answered: 'Answered',
    tk_closed: 'Closed',

    // errors
    err_network: 'Connection problem. Please check your internet and try again.',
    err_server_error: 'Something went wrong on our side. Please try again.',
    err_validation: 'Please check the highlighted field.',
    err_bad_credentials: 'Mobile number or password is incorrect.',
    err_phone_taken: 'This mobile number is already registered. Sign in instead.',
    err_otp_invalid: 'The code is incorrect or has expired.',
    err_rate_limited: 'Too many attempts. Please wait and try again.',
    err_locked: 'Too many failed attempts. The account is locked for 15 minutes.',
    err_weak_password: 'Use at least 10 characters with letters and numbers.',
    err_suspended: 'This account is suspended. Contact support.',
    err_unauthenticated: 'Please sign in to continue.',
    err_not_found: 'Not found.',
    err_duplicate_reference: 'This transaction reference has already been used on another request.',
    err_amount_out_of_range: 'The amount is outside the allowed range for this service.',
    err_service_not_authorized: 'This service is not yet authorized.',
    err_file_too_large: 'The file is too large.',
    err_file_type: 'Only JPG, PNG or PDF files are accepted.',
    err_submissions_closed: 'New requests are temporarily paused. Please try later.',
    err_ticket_closed: 'This ticket is closed.',
    v_required: 'This field is required.',
    v_phone: 'Enter a valid mobile number, e.g. 0701234567.',
    v_name: 'Enter your full name.',
    v_amount: 'Enter a valid amount.',
    v_ref: 'Enter a valid reference (6–40 letters or numbers).',
    v_code: 'Enter the 6-digit code.',
    v_terms: 'Please accept to continue.',

  },

  fa: {
    brand: 'رهبر پی',
    lang_toggle: 'English',
    demo: 'نمایشی',
    retry: 'تلاش دوباره',
    cancel: 'لغو',
    save: 'ذخیره تغییرات',
    saved: 'ذخیره شد',
    close: 'بستن',
    back: 'بازگشت',
    continue: 'ادامه',
    submit: 'ارسال',
    confirm: 'تأیید',
    view_all: 'مشاهده همه',
    search: 'جستجو',
    filter_all: 'همه',
    none_yet: 'هنوز چیزی نیست',
    copy: 'کاپی',
    copied: 'کاپی شد',
    optional: 'اختیاری',
    required: 'الزامی',
    col_status: 'وضعیت',

    nav_logout: 'خروج',
    nav_home: 'خانه',

    auth_phone: 'شماره موبایل',
    auth_password: 'رمز عبور',
    auth_password_new: 'ساخت رمز عبور',
    auth_full_name: 'نام کامل (مطابق تذکره)',
    auth_code: 'کد تأیید',
    auth_verify: 'تأیید و ادامه',

    dash_total: 'کل درخواست‌ها',
    dash_security_tg_off: 'وصل نیست',
    dash_security_tg_on: 'وصل است',
    market_usd: 'دالر / افغانی',
    market_eur: 'یورو / افغانی',
    market_gold: 'طلا · دالر/اونس',
    market_btc: 'بیت‌کوین · دالر (مرجع)',

    req_amount: 'مبلغ',
    req_method: 'روش پرداخت',
    req_ref: 'شماره مرجع تراکنش',
    req_note: 'یادداشت برای کارمند',
    req_tracking: 'کد پیگیری',
    req_detail_info: 'جزئیات درخواست',
    req_service: 'خدمت',
    req_submitted: 'تاریخ ثبت',
    req_updated: 'آخرین به‌روزرسانی',
    req_reason: 'دلیل',

    st_pending: 'در انتظار',
    st_under_review: 'در حال بررسی',
    st_payment_verified: 'پرداخت تأیید شد',
    st_processing: 'در حال انجام',
    st_completed: 'تکمیل شد',
    st_rejected: 'رد شد',
    st_pending_d: 'درخواست دریافت شد و در صف بررسی است.',
    st_under_review_d: 'یک کارمند در حال بررسی درخواست شماست.',
    st_payment_verified_d: 'پرداخت با سوابق رسمی تأیید شد.',
    st_processing_d: 'درخواست شما در حال انجام است.',
    st_completed_d: 'درخواست شما تکمیل شد.',
    st_rejected_d: 'درخواست شما پذیرفته نشد.',

    prof_customer_id: 'شناسه مشتری',
    prof_language: 'زبان',
    prof_tg: 'اعلان تلگرام',
    prof_tg_d: 'فقط وضعیت. هرگز مبلغ یا مشخصات حساب را شامل نمی‌شود.',
    prof_tg_link: 'اتصال تلگرام',
    prof_tg_unlink: 'قطع اتصال',
    prof_tg_nobot: 'ربات تلگرام هنوز توسط مدیر تنظیم نشده است.',

    sup_title: 'مرکز پشتیبانی',
    sup_subject: 'موضوع',
    sup_category: 'دسته',
    sup_send: 'ارسال',
    sup_reply_ph: 'پاسخ بنویسید…',
    sup_closed: 'این تیکت بسته شده است.',
    cat_general: 'عمومی',
    cat_request: 'یک درخواست',
    cat_payment: 'پرداخت',
    cat_account: 'حساب',
    cat_security: 'امنیت',
    tk_open: 'باز',
    tk_answered: 'پاسخ داده شد',
    tk_closed: 'بسته',

    err_network: 'مشکل اتصال. لطفاً انترنت خود را بررسی و دوباره تلاش کنید.',
    err_server_error: 'مشکلی از طرف ما پیش آمد. لطفاً دوباره تلاش کنید.',
    err_validation: 'لطفاً بخش مشخص‌شده را بررسی کنید.',
    err_bad_credentials: 'شماره موبایل یا رمز عبور نادرست است.',
    err_phone_taken: 'این شماره قبلاً ثبت شده است. وارد شوید.',
    err_otp_invalid: 'کد نادرست است یا منقضی شده.',
    err_rate_limited: 'تلاش‌های زیاد. لطفاً کمی صبر کنید.',
    err_locked: 'تلاش‌های ناموفق زیاد. حساب برای ۱۵ دقیقه قفل شد.',
    err_weak_password: 'حداقل ۱۰ حرف شامل حروف و اعداد استفاده کنید.',
    err_suspended: 'این حساب معلق شده است. با پشتیبانی تماس بگیرید.',
    err_unauthenticated: 'لطفاً برای ادامه وارد شوید.',
    err_not_found: 'پیدا نشد.',
    err_duplicate_reference: 'این شماره مرجع قبلاً در درخواست دیگری استفاده شده است.',
    err_amount_out_of_range: 'مبلغ خارج از محدوده مجاز این خدمت است.',
    err_service_not_authorized: 'این خدمت هنوز مجاز نیست.',
    err_file_too_large: 'فایل بسیار بزرگ است.',
    err_file_type: 'فقط فایل‌های JPG، PNG یا PDF پذیرفته می‌شوند.',
    err_submissions_closed: 'ثبت درخواست جدید موقتاً متوقف است. لطفاً بعداً تلاش کنید.',
    err_ticket_closed: 'این تیکت بسته شده است.',
    v_required: 'این بخش الزامی است.',
    v_phone: 'یک شماره موبایل معتبر وارد کنید، مثلاً ۰۷۰۱۲۳۴۵۶۷.',
    v_name: 'نام کامل خود را وارد کنید.',
    v_amount: 'یک مبلغ معتبر وارد کنید.',
    v_ref: 'یک مرجع معتبر وارد کنید (۶ تا ۴۰ حرف یا عدد).',
    v_code: 'کد ۶ رقمی را وارد کنید.',
    v_terms: 'لطفاً برای ادامه موافقت کنید.',

  },
};

// Dari is the default; English only when the user chose it.
let lang = localStorage.getItem('rp_lang') === 'en' ? 'en' : 'fa';
const listeners = new Set();

export const getLang = () => lang;
export const isRtl = () => lang === 'fa';

export function extend(extra) {
  for (const l of ['en', 'fa']) Object.assign(dict[l], extra[l] || {});
}

export function t(key, vars) {
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/** Pick the localized field of a server record: L(service, 'name') → name_fa / name_en */
export const L = (obj, base) => (obj ? obj[`${base}_${lang}`] || obj[`${base}_en`] || '' : '');

export function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
}

export function setLang(next) {
  lang = next === 'fa' ? 'fa' : 'en';
  localStorage.setItem('rp_lang', lang);
  applyLang();
  listeners.forEach((fn) => fn(lang));
}
export const onLang = (fn) => listeners.add(fn);

const locale = () => (lang === 'fa' ? 'fa-AF' : 'en-US');

export function fmtNumber(n, digits = 0) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** amount in minor units → "؋ 12,500.00" / "$ 120.00" */
export function fmtMoney(minor, currency) {
  const v = (minor || 0) / 100;
  const digits = currency === 'USD' ? 2 : v % 1 ? 2 : 0;
  const num = fmtNumber(v, digits);
  if (currency === 'USD') return lang === 'fa' ? `${num} دالر` : `$${num}`;
  return lang === 'fa' ? `${num} افغانی` : `${num} AFN`;
}

export function fmtDate(ts, { time = true, short = false } = {}) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const opts = short ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' };
  if (time) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  // Dari users read the Afghan solar (Hijri Shamsi) calendar.
  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-AF-u-ca-persian' : 'en-GB', opts).format(d);
}

export function fmtRelative(ts) {
  const diff = Math.round(ts - Date.now() / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(ts, { time: false });
}

export function errorText(err) {
  if (!err) return '';
  const key = `err_${err.code}`;
  const s = t(key);
  return s === key ? (err.code === 'validation' ? t('err_validation') : err.message || t('err_server_error')) : s;
}
