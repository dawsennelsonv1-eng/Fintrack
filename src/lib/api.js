// Apps Script web app endpoint. Set VITE_API_URL in .env to override.
const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request(method, body) {
  if (!API_URL) throw new ApiError('VITE_API_URL not configured');

  // Apps Script CORS quirk: sending application/json triggers preflight.
  // Using text/plain skips preflight; the script still parses JSON from body.
  const opts = {
    method,
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  };
  if (body) opts.body = JSON.stringify(body);

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
