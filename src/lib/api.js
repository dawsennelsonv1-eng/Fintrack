// src/lib/api.js
// Form-encoded POST that matches the Apps Script v5 server.
// The payload survives the 302 redirect because URLSearchParams encodes
// it as a form body that Apps Script reads via e.parameter.payload.
//
// Verification fallback: if a response fails to come back (mobile network
// hiccup, etc), the caller can re-fetch from the sheet to verify what
// actually got through, instead of blindly re-queuing operations.

const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request(method, body) {
  if (!API_URL) throw new ApiError('VITE_API_URL not configured');

  const opts = {
    method,
    redirect: 'follow',
    cache: 'no-store',
  };

  if (method === 'POST' && body) {
    // Form-encode so the payload survives Apps Script's 302 redirect.
    // Apps Script reads this server-side as e.parameter.payload.
    opts.body = new URLSearchParams({ payload: JSON.stringify(body) });
    // Do NOT set Content-Type — URLSearchParams sets it correctly.
  }

  let res;
  try {
    res = await fetch(API_URL, opts);
  } catch (err) {
    throw new ApiError('Network unreachable', 0);
  }

  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);

  let data;
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch (e) {
    // Response came back but couldn't be parsed.
    // The request likely processed server-side though.
    throw new ApiError('Response parse failed (request may have processed)', 502);
  }

  if (data.status >= 400) {
    throw new ApiError(data.error || 'API error', data.status);
  }
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
