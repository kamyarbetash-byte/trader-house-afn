// Thin JSON client. Throws ApiError with server error code + field.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.error || `HTTP ${status}`);
    this.status = status;
    this.code = body?.error || 'network';
    this.field = body?.field;
    this.body = body || {};
  }
}

async function call(method, url, body, opts = {}) {
  const init = { method, credentials: 'same-origin', headers: { accept: 'application/json' } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, init); } catch { throw new ApiError(0, { error: 'network' }); }
  if (opts.raw) { if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({}))); return res; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (res.status === 401 && opts.onUnauthorized) opts.onUnauthorized(err);
    throw err;
  }
  return data;
}

export function client(onUnauthorized) {
  const o = { onUnauthorized };
  return {
    get: (u) => call('GET', u, undefined, o),
    post: (u, b = {}) => call('POST', u, b, o),
    patch: (u, b = {}) => call('PATCH', u, b, o),
    upload: (u, form) => call('POST', u, form, o),
    raw: (u) => call('GET', u, undefined, { ...o, raw: true }),
  };
}
