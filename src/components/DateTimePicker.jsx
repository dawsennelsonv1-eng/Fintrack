// src/components/DateTimePicker.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, ChevronDown } from 'lucide-react';

/**
 * Compact date/time picker.
 * - Default presets: Now / Earlier today / Yesterday / Custom
 * - "Custom" reveals a native datetime-local input
 * - Returns ISO strings via onChange
 */
export default function DateTimePicker({ value, onChange, label = 'When' }) {
  const [mode, setMode] = useState('now'); // now | earlier | yesterday | custom
  const [customLocal, setCustomLocal] = useState('');

  // Initialize mode from value on mount
  useEffect(() => {
    if (!value) { setMode('now'); return; }
    const d = new Date(value);
    const now = new Date();
    const ydy = new Date(); ydy.setDate(ydy.getDate() - 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth() &&
      a.getDate()     === b.getDate();
    // If within last 5 minutes, treat as "now"
    if (Math.abs(now - d) < 5 * 60 * 1000 && sameDay(d, now)) {
      setMode('now');
    } else if (sameDay(d, now)) {
      setMode('earlier');
      setCustomLocal(toLocalInputString(d));
    } else if (sameDay(d, ydy)) {
      setMode('yesterday');
      setCustomLocal(toLocalInputString(d));
    } else {
      setMode('custom');
      setCustomLocal(toLocalInputString(d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMode = (newMode) => {
    setMode(newMode);
    if (newMode === 'now') {
      onChange(new Date().toISOString());
    } else if (newMode === 'earlier') {
      // Default to 2 hours ago
      const d = new Date(); d.setHours(d.getHours() - 2);
      setCustomLocal(toLocalInputString(d));
      onChange(d.toISOString());
    } else if (newMode === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setCustomLocal(toLocalInputString(d));
      onChange(d.toISOString());
    } else if (newMode === 'custom') {
      const start = customLocal || toLocalInputString(new Date());
      setCustomLocal(start);
      onChange(fromLocalInputString(start).toISOString());
    }
  };

  const handleCustom = (localStr) => {
    setCustomLocal(localStr);
    if (!localStr) return;
    onChange(fromLocalInputString(localStr).toISOString());
  };

  const showInput = mode === 'earlier' || mode === 'yesterday' || mode === 'custom';
  const displayDate = value ? new Date(value) : new Date();

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1 flex items-center gap-1.5">
        <Clock size={11} /> {label}
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <PresetButton active={mode === 'now'}       onClick={() => handleMode('now')}>Now</PresetButton>
        <PresetButton active={mode === 'earlier'}   onClick={() => handleMode('earlier')}>Earlier</PresetButton>
        <PresetButton active={mode === 'yesterday'} onClick={() => handleMode('yesterday')}>Yesterday</PresetButton>
        <PresetButton active={mode === 'custom'}    onClick={() => handleMode('custom')}>Custom</PresetButton>
      </div>

      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--bg)]">
              <Calendar size={14} className="text-muted shrink-0" />
              <input
                type="datetime-local"
                value={customLocal}
                onChange={(e) => handleCustom(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm num"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-[11px] text-muted mt-2 px-1 num">
        {formatFriendly(displayDate)}
      </div>
    </div>
  );
}

function PresetButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 rounded-lg text-xs font-medium transition-all ${
        active
          ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
          : 'bg-[var(--bg)] text-muted hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

// Convert a Date to the format expected by datetime-local input
// datetime-local needs "YYYY-MM-DDTHH:mm" in the user's local timezone
function toLocalInputString(date) {
  const tz = date.getTimezoneOffset() * 60000;
  return new Date(date - tz).toISOString().slice(0, 16);
}

function fromLocalInputString(localStr) {
  // Treat as local time and let JS interpret
  return new Date(localStr);
}

function formatFriendly(date) {
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const ydy = new Date(); ydy.setDate(ydy.getDate() - 1);
  const time = date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, now)) return `Today, ${time}`;
  if (sameDay(date, ydy)) return `Yesterday, ${time}`;
  const dateStr = date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateStr}, ${time}`;
}
