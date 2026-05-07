// src/lib/api.js
// v2 — GET-based sync. Bypasses Apps Script's 302 redirect entirely.
//
// Why GET? Apps Script's deployed web app does a 302 redirect on POST
// requests. The browser follows it, but in doing so the request body
// is dropped. This caused silent failures where the server received
// an empty payload regardless of what we sent.
//
// GET requests don't have bodies — we encode the payload as a query
// parameter. The redirect preserves the URL (and query string) intact.
// This is the most reliable way to talk to Apps Script web apps.

const API_URL = import.meta.env.VITE_API_URL || '';
const CLIENT_VERSION = 'v6'; // Bump this whenever sync logic changes
const CHUNK_SIZE_BYTES = 1500; // URL length safety margin

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

// Fetch with cache-bypass headers + a cache-buster query param.
// The cache-buster prevents service workers and HTTP caches from
// serving stale responses.
async function rawFetch(url) {
  const sep = url.includes('?') ? '&' : '?';
  const bust = `_cb=${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const finalUrl = `${url}${sep}${bust}&_cv=${CLIENT_VERSION}`;

  let res;
  try {
    res = await fetch(finalUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });
  } catch (err) {
    throw new ApiError('Network unreachable', 0);
  }

  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ApiError('Invalid response from server', 502);
  }

  if (data.status >= 400) {
    throw new ApiError(data.error || 'API error', data.status);
  }
  return data;
}

// Check that the API_URL is configured and looks like a valid Apps Script URL.
function ensureUrl() {
  if (!API_URL) throw new ApiError('VITE_API_URL not configured', 0);
}

// Build a GET request with the payload as a query parameter.
// Apps Script will receive it as e.parameter.payload.
async function callGet(payload) {
  ensureUrl();
  const json = JSON.stringify(payload);
  const url = `${API_URL}?payload=${encodeURIComponent(json)}`;
  return rawFetch(url);
}

// Bulk operations may be too large for a single URL.
// We split them into chunks that fit safely under URL length limits.
function chunkOperations(operations) {
  const chunks = [];
  let current = [];
  let currentSize = 0;
  const baseUrlBytes = API_URL.length + 100; // overhead for ?payload= etc.

  for (const op of operations) {
    const opJson = JSON.stringify(op);
    const opSize = opJson.length;

    // If a single op is too big, push it alone (still try, may fail)
    if (opSize > CHUNK_SIZE_BYTES) {
      if (current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      chunks.push([op]);
      continue;
    }

    if (currentSize + opSize + baseUrlBytes > CHUNK_SIZE_BYTES) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(op);
    currentSize += opSize;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export const api = {
  // GET with no payload returns all data
  fetchAll: async () => {
    ensureUrl();
    return rawFetch(API_URL);
  },

  // Bulk operations sent as one or more GET requests.
  // Returns combined results in original order.
  bulk: async (operations) => {
    if (!operations || operations.length === 0) {
      return { results: [] };
    }

    const chunks = chunkOperations(operations);
    const allResults = [];

    for (const chunk of chunks) {
      try {
        const response = await callGet({
          action: 'bulk',
          operations: chunk,
        });
        allResults.push(...(response.results || []));
      } catch (err) {
        // If one chunk fails, mark its operations as failed but
        // keep going so partial success is possible.
        for (const op of chunk) {
          allResults.push({
            status: err.status || 500,
            error: err.message,
            id: op.id,
          });
        }
      }
    }

    return { results: allResults };
  },

  // Individual operations (used rarely; bulk is preferred)
  create: (payload) => callGet({ action: 'create', ...payload }),
  update: (payload) => callGet({ action: 'update', ...payload }),
  remove: (id, entity = 'transaction') => callGet({ action: 'delete', entity, id }),

  // Diagnostic: ping the server, returns its version
  ping: () => callGet({ action: 'ping' }),
};

export { ApiError };
