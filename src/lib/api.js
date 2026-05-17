// src/lib/api.js
// Tier 5b — workspace-aware API routing
//
// Each workspace has its own Apps Script deployment URL:
//   • Personal → VITE_API_URL          (the existing Personal sheet/v7 server)
//   • AVS      → VITE_API_URL_AVS      (the new AVS sheet/v8 server)
//
// Backward-compat: if no workspace is passed, we default to the Personal
// URL exactly like before. All existing Personal code keeps working
// without changes.
//
// Form-encoded POST + 302-survival contract is identical to v7.

const PERSONAL_URL = import.meta.env.VITE_API_URL || '';
const AVS_URL      = import.meta.env.VITE_API_URL_AVS || '';

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

async function request(method, body, workspace) {
  const url = urlFor(workspace);
  if (!url) {
    throw new ApiError(
      workspace === 'avs'
        ? 'VITE_API_URL_AVS not configured'
        : 'VITE_API_URL not configured'
    );
  }

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

  if (data.status >= 400) {
    throw new ApiError(data.error || 'API error', data.status);
  }
  return data;
}

// ─── Backward-compatible exports for Personal ──────────────────
//
// These signatures match v7 exactly so no existing Personal code
// needs touching. They implicitly use the Personal URL.
//
export const api = {
  fetchAll: ()    => request('GET',  null,                              'personal'),
  create:   (tx)  => request('POST', { action: 'create', ...tx },       'personal'),
  update:   (tx)  => request('POST', { action: 'update', ...tx },       'personal'),
  remove:   (id)  => request('POST', { action: 'delete', id },          'personal'),
  bulk:     (ops) => request('POST', { action: 'bulk', operations: ops }, 'personal'),
};

// ─── Workspace-aware exports for new code ──────────────────────
//
// Pass workspace explicitly. Used by the AVS business slice and any
// future workspaces. Personal slice keeps using `api` above unchanged.
//
export const apiFor = (workspace) => ({
  fetchAll: ()    => request('GET',  null,                              workspace),
  create:   (tx)  => request('POST', { action: 'create', ...tx },       workspace),
  update:   (tx)  => request('POST', { action: 'update', ...tx },       workspace),
  remove:   (id, entity) => request('POST', { action: 'delete', id, entity }, workspace),
  bulk:     (ops) => request('POST', { action: 'bulk', operations: ops }, workspace),
  ping:     ()    => request('POST', { action: 'ping' },                 workspace),
});

// Convenience instances
export const personalApi = apiFor('personal');
export const avsApi      = apiFor('avs');

export { ApiError };
