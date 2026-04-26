// src/lib/api.js
const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status = 0, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method, body) {
  if (!API_URL) throw new ApiError('VITE_API_URL not configured');

  let opts;
  let url = API_URL;

  if (method === 'GET') {
    opts = { method: 'GET', redirect: 'follow' };
  } else {
    // Apps Script web apps issue a 302 to script.googleusercontent.com.
    // The browser strips POST bodies during redirects in some cases.
    // Workaround: send JSON as a URL-encoded form parameter; Apps Script
    // can read it from e.parameter.payload regardless of redirects.
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(body));
    opts = {
      method: 'POST',
      redirect: 'follow',
      body: formData,
      // Do NOT set Content-Type — browser will set it correctly
      // for URLSearchParams, and any custom header triggers preflight.
    };
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new ApiError('Network unreachable: ' + (err?.message || 'fetch failed'), 0);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`HTTP ${res.status}`, res.status, text.slice(0, 200));
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new ApiError('Invalid response (not JSON)', 0);
  }

  if (data.status >= 400) {
    throw new ApiError(data.error || 'API error', data.status, JSON.stringify(data).slice(0, 200));
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
