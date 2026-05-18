// src/components/AvsSyncDebug.jsx
// Ship 1 — AVS Sync Debug Overlay
//
// Activates on long-press of the workspace switcher in the header.
// (Tap the workspace name normally = switcher dropdown. Long-press = this.)
//
// Shows:
//   • Current VITE_API_URL_AVS env var value
//   • Last hydrate attempt: timestamp + status + raw response excerpt
//   • Last sync attempt: same
//   • Current queue contents (pending ops not yet pushed)
//   • Buttons: "Test ping", "Force hydrate", "Force sync"
//   • Live captured errors from window.error and unhandledrejection
//
// This is the diagnostic tool we need to figure out why AVS doesn't talk
// to the sheet. Run it, take a screenshot of what it shows, send to me.
//
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, RefreshCw, Send, Copy, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { avsApi, ApiError } from '../lib/api';

// Singleton state shared across instances (only one overlay can be open
// at a time, but we want the log to persist even when closed)
const debugState = {
  logs: [],
  errors: [],
  listeners: new Set(),
};

function pushLog(entry) {
  debugState.logs.unshift({
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    ...entry,
  });
  // Cap to last 50
  if (debugState.logs.length > 50) debugState.logs.length = 50;
  debugState.listeners.forEach((fn) => fn());
}

function pushError(err) {
  debugState.errors.unshift({
    id: Date.now() + Math.random(),
    time: new Date().toISOString(),
    message: String(err?.message || err),
    stack: err?.stack || '',
  });
  if (debugState.errors.length > 30) debugState.errors.length = 30;
  debugState.listeners.forEach((fn) => fn());
}

// Wire global error listeners ONCE
if (typeof window !== 'undefined' && !window.__avsDebugWired) {
  window.__avsDebugWired = true;

  window.addEventListener('error', (e) => {
    pushError({ message: e.message, stack: e.error?.stack || '' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    pushError({
      message: 'Unhandled promise rejection: ' + String(e.reason?.message || e.reason),
      stack: e.reason?.stack || '',
    });
  });

  // Wrap fetch to log every call that hits an Apps Script URL
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const isAppsScript = url.includes('script.google.com');

    if (isAppsScript) {
      const opts = args[1] || {};
      let bodyPreview = '';
      try {
        if (opts.body instanceof URLSearchParams) {
          const payload = opts.body.get('payload');
          bodyPreview = payload ? payload.slice(0, 400) : '';
        } else if (typeof opts.body === 'string') {
          bodyPreview = opts.body.slice(0, 400);
        }
      } catch (e) { /* ignore */ }

      const logEntry = {
        kind: 'fetch',
        method: opts.method || 'GET',
        url,
        bodyPreview,
        status: '...',
        responseExcerpt: '',
      };
      pushLog(logEntry);
      const startedAt = Date.now();

      try {
        const res = await originalFetch.apply(this, args);
        logEntry.status = res.status;
        logEntry.duration = Date.now() - startedAt;

        // Try to clone and read body without consuming the real one
        try {
          const cloned = res.clone();
          const text = await cloned.text();
          logEntry.responseExcerpt = text.slice(0, 500);
        } catch (e) { /* ignore */ }

        debugState.listeners.forEach((fn) => fn());
        return res;
      } catch (err) {
        logEntry.status = 'NETWORK_FAIL';
        logEntry.responseExcerpt = String(err?.message || err);
        logEntry.duration = Date.now() - startedAt;
        debugState.listeners.forEach((fn) => fn());
        throw err;
      }
    }

    return originalFetch.apply(this, args);
  };
}

// Subscribe hook
function useDebugState() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    debugState.listeners.add(fn);
    return () => debugState.listeners.delete(fn);
  }, []);
  return { logs: debugState.logs, errors: debugState.errors };
}

// Expose globally so it can be triggered from anywhere
if (typeof window !== 'undefined') {
  window.__showAvsDebug = () => {
    window.dispatchEvent(new CustomEvent('avs:debug:open'));
  };
}

export default function AvsSyncDebug() {
  const [open, setOpen] = useState(false);
  const { logs, errors } = useDebugState();
  const business = useStore((s) => s.business);
  const workspace = useStore((s) => s.app?.workspace);

  // Listen for the open event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('avs:debug:open', handler);
    return () => window.removeEventListener('avs:debug:open', handler);
  }, []);

  // Also: triple-tap anywhere in top 60px opens it (mobile-friendly hidden gesture)
  useEffect(() => {
    let taps = 0;
    let timer = null;
    const handler = (e) => {
      if (e.clientY > 80 && e.touches?.[0]?.clientY > 80) return;
      const y = e.clientY ?? e.touches?.[0]?.clientY ?? 999;
      if (y > 80) return;
      taps += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { taps = 0; }, 600);
      if (taps >= 3) {
        taps = 0;
        setOpen(true);
      }
    };
    window.addEventListener('touchstart', handler);
    window.addEventListener('mousedown', handler);
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('mousedown', handler);
    };
  }, []);

  const apiUrl = import.meta.env.VITE_API_URL_AVS || '(not set)';
  const apiUrlMasked = apiUrl === '(not set)'
    ? apiUrl
    : apiUrl.length > 60
      ? apiUrl.slice(0, 35) + '...' + apiUrl.slice(-20)
      : apiUrl;

  const testPing = async () => {
    try {
      pushLog({ kind: 'action', method: 'PING', url: 'manual', status: '...', responseExcerpt: 'starting...' });
      const res = await avsApi.ping();
      pushLog({
        kind: 'action',
        method: 'PING result',
        url: '',
        status: 'OK',
        responseExcerpt: JSON.stringify(res).slice(0, 500),
      });
    } catch (e) {
      pushError(e);
    }
  };

  const forceHydrate = async () => {
    try {
      pushLog({ kind: 'action', method: 'HYDRATE', url: 'manual', status: '...', responseExcerpt: 'starting...' });
      await useStore.getState().hydrateBusinessFromServer();
      pushLog({
        kind: 'action',
        method: 'HYDRATE result',
        url: '',
        status: 'OK',
        responseExcerpt: `leads:${business?.leads?.length || 0}, adSpend:${business?.adSpend?.length || 0}`,
      });
    } catch (e) {
      pushError(e);
    }
  };

  const forceSync = async () => {
    try {
      pushLog({
        kind: 'action',
        method: 'SYNC',
        url: 'manual',
        status: '...',
        responseExcerpt: `queue has ${business?.queue?.length || 0} ops`,
      });
      await useStore.getState().syncAvsQueue();
      pushLog({
        kind: 'action',
        method: 'SYNC result',
        url: '',
        status: 'OK',
        responseExcerpt: `queue now has ${useStore.getState().business?.queue?.length || 0} ops`,
      });
    } catch (e) {
      pushError(e);
    }
  };

  const copyAll = () => {
    const dump = JSON.stringify({
      workspace,
      apiUrl: apiUrlMasked,
      business: {
        queue: business?.queue || [],
        lastSyncAt: business?.lastSyncAt,
        syncError: business?.syncError,
        counts: {
          leads: business?.leads?.length || 0,
          adSpend: business?.adSpend?.length || 0,
          staffCommissions: business?.staffCommissions?.length || 0,
          staffPayroll: business?.staffPayroll?.length || 0,
          contentAdherence: business?.contentAdherence?.length || 0,
          businessDebts: business?.businessDebts?.length || 0,
          businessExpenses: business?.businessExpenses?.length || 0,
        },
      },
      logs: logs.slice(0, 20),
      errors: errors.slice(0, 20),
    }, null, 2);
    navigator.clipboard?.writeText(dump);
    pushLog({ kind: 'action', method: 'COPIED', url: '', status: 'OK', responseExcerpt: 'Diagnostic dump copied to clipboard' });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[100] max-h-[92vh] flex flex-col"
          >
            <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="font-medium text-sm">AVS Sync Debug</div>
                  <div className="text-[10px] text-muted">Diagnostic tool</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* API URL */}
                <Section title="Configuration">
                  <Row label="Workspace" value={workspace} />
                  <Row
                    label="VITE_API_URL_AVS"
                    value={apiUrlMasked}
                    danger={apiUrl === '(not set)'}
                  />
                  <Row label="Queue length" value={String(business?.queue?.length || 0)} />
                  <Row label="Last sync" value={business?.lastSyncAt || '(never)'} />
                  {business?.syncError && (
                    <Row label="Last error" value={business.syncError} danger />
                  )}
                </Section>

                {/* Actions */}
                <Section title="Actions">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    <ActionButton icon={Play} label="Test ping" onClick={testPing} />
                    <ActionButton icon={RefreshCw} label="Force hydrate" onClick={forceHydrate} />
                    <ActionButton icon={Send} label="Force sync" onClick={forceSync} />
                    <ActionButton icon={Copy} label="Copy diagnostic" onClick={copyAll} />
                  </div>
                </Section>

                {/* Errors */}
                {errors.length > 0 && (
                  <Section title={`Errors (${errors.length})`}>
                    {errors.slice(0, 10).map((e) => (
                      <div key={e.id} className="px-3 py-2 border-b border-[var(--border)] last:border-0">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: '#c2452f' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium" style={{ color: '#c2452f' }}>
                              {e.message}
                            </div>
                            <div className="text-[9px] text-muted mt-0.5">
                              {new Date(e.time).toLocaleTimeString()}
                            </div>
                            {e.stack && (
                              <pre className="text-[9px] text-muted mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                                {e.stack.slice(0, 300)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Section>
                )}

                {/* Network log */}
                <Section title={`Network calls (${logs.length})`}>
                  {logs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted">
                      No calls captured yet. Tap "Force hydrate" or "Test ping" to test.
                    </div>
                  ) : (
                    logs.slice(0, 20).map((l) => (
                      <div key={l.id} className="px-3 py-2 border-b border-[var(--border)] last:border-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: l.status === 'OK' || l.status === 200 ? '#3d8b5f22' :
                                l.status === '...' ? '#7a8a8c22' : '#c2452f22',
                              color: l.status === 'OK' || l.status === 200 ? '#3d8b5f' :
                                l.status === '...' ? '#7a8a8c' : '#c2452f',
                            }}
                          >
                            {l.method} {l.status}
                          </span>
                          <span className="text-[9px] text-muted">{new Date(l.time).toLocaleTimeString()}</span>
                          {l.duration != null && (
                            <span className="text-[9px] text-muted">{l.duration}ms</span>
                          )}
                        </div>
                        {l.url && l.url !== 'manual' && (
                          <div className="text-[9px] text-muted font-mono break-all">
                            {l.url.length > 80 ? l.url.slice(0, 50) + '...' + l.url.slice(-25) : l.url}
                          </div>
                        )}
                        {l.bodyPreview && (
                          <div className="text-[9px] mt-0.5">
                            <span className="text-muted">body: </span>
                            <span className="font-mono break-all">{l.bodyPreview.slice(0, 200)}</span>
                          </div>
                        )}
                        {l.responseExcerpt && (
                          <pre className="text-[9px] mt-0.5 whitespace-pre-wrap break-all bg-[var(--bg)] rounded p-1.5 font-mono">
                            {l.responseExcerpt.slice(0, 400)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </Section>

                <div className="text-[10px] text-muted text-center px-4 py-2">
                  Triple-tap top of screen to reopen this overlay.
                </div>

                <div className="h-8" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5 px-1">
        {title}
      </div>
      <div className="surface border rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, danger }) {
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-[var(--border)] last:border-0">
      <div className="text-[11px] text-muted shrink-0">{label}</div>
      <div
        className="text-[11px] font-mono text-right truncate"
        style={danger ? { color: '#c2452f' } : undefined}
      >
        {value || '(empty)'}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="surface border rounded-xl py-2.5 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
    >
      <Icon size={12} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
