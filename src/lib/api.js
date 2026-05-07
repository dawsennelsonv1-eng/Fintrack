// src/lib/api.js
const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

/**
 * Apps Script web apps respond to POST with a 302 redirect before the
 * handler runs. The redirect strips the request body, so we MUST send
 * the payload as form-encoded data (which survives the redirect via
 * the URL-rewrite) and read it via `e.parameter.payload` server-side.
 *
 * Sending JSON with Content-Type: application/json or text/plain looks
 * fine in the browser network tab but the server receives an empty body.
 */
async function request(method, body) {
  if (!API_URL) throw new ApiError('VITE_API_URL not configured');

  const opts = {
    method,
    redirect: 'follow',
  };

  if (method === 'POST' && body) {
    // Form-encode so the payload survives Apps Script's 302 redirect.
    // Apps Script reads this on the server as e.parameter.payload.
    opts.body = new URLSearchParams({ payload: JSON.stringify(body) });
    // NOTE: do NOT set Content-Type manually — URLSearchParams sets the
    // correct application/x-www-form-urlencoded;charset=UTF-8 header.
  }

  let res;
  try {
    res = await fetch(API_URL, opts);
  } catch (err) {
    throw new ApiError('Network unreachable', 0);
  }

  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);

  const data = await res.json();
  if (data.status >= 400) throw new ApiError(data.error || 'API error', data.status);
  return data;
}

export const api = {
  fetchAll: () => request('GET'),
  create:   (tx)  => request('POST', { action: 'create', ...tx }),
  update:   (tx)  => request('POST', { action: 'update', ...tx }),
  remove:   (id)  => request('POST', { action: 'delete', id }),
  bulk:     (ops) => request('POST', { action: 'bulk', operations: ops }),
};

export { ApiError };
