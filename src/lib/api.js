// src/lib/api.js

//
// Each workspace has its own Apps Script deployment URL:

//


const PERSONAL_URL = import.meta.env?.VITE_API_URL || '';
const AVS_URL      = import.meta.env?.VITE_API_URL_AVS || '';
export const SYSTEM_STATE_ROW_ID = '__fintrack_state_v8__';

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

function urlFor(workspace) {
  if (workspace === 'avs') return AVS_URL;
  return PERSONAL_URL;
}

async function sendPost(url, body, encoding = 'json') {
  const opts = {
method: 'POST',
    redirect: 'follow',
    cache: 'no-store',
  };

if (encoding === 'form') {
    opts.body = new URLSearchParams({ payload: JSON.stringify(body) });
} else {
opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new ApiError('Network unreachable', 0);
  }

  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);

  let data;
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch (e) {
    throw new ApiError('Response parse failed (request may have processed)', 502);
  }

return data;
}
async function request(method, body, workspace) {
const url = urlFor(workspace);
if (!url) {
throw new ApiError(
workspace === 'avs'
? 'VITE_API_URL_AVS not configured'
: 'VITE_API_URL not configured'
);
}
if (method !== 'POST' || !body) {
let res;
try {
res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
} catch (err) {
throw new ApiError('Network unreachable', 0);
}
if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
let data;
try {
const text = await res.text();
data = JSON.parse(text);
} catch (e) {
throw new ApiError('Response parse failed', 502);
}
if (data.status >= 400) {
throw new ApiError(data.error || 'API error', data.status);
}
return data;
}
const primaryEncoding = workspace === 'avs' ? 'form' : 'json';
const fallbackEncoding = primaryEncoding === 'json' ? 'form' : 'json';
let data = await sendPost(url, body, primaryEncoding);
if (
data &&
data.status >= 400 &&
typeof data.error === 'string' &&
(data.error.includes('Unexpected token') ||
data.error.includes('payload') ||
data.error.includes('JSON'))
) {
data = await sendPost(url, body, fallbackEncoding);
}
  if (data.status >= 400) {
    throw new ApiError(data.error || 'API error', data.status);
  }
  return data;
}


export const api = {
  fetchAll: ()    => request('GET',  null,                              'personal'),
  create:   (tx)  => request('POST', { action: 'create', ...tx },       'personal'),
  update:   (tx)  => request('POST', { action: 'update', ...tx },       'personal'),
  remove:   (id)  => request('POST', { action: 'delete', id },          'personal'),
  bulk:     (ops) => request('POST', { action: 'bulk', operations: ops }, 'personal'),
};


export const apiFor = (workspace) => ({
  fetchAll: ()    => request('GET',  null,                              workspace),
  create:   (tx)  => request('POST', { action: 'create', ...tx },       workspace),
  update:   (tx)  => request('POST', { action: 'update', ...tx },       workspace),
  remove:   (id, entity) => request('POST', { action: 'delete', id, entity }, workspace),
  bulk:     (ops) => request('POST', { action: 'bulk', operations: ops }, workspace),
  ping:     ()    => request('POST', { action: 'ping' },                 workspace),
});


export const personalApi = apiFor('personal');
export const avsApi      = apiFor('avs');

export { ApiError };
