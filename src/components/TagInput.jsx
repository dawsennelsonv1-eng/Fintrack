// src/components/TagInput.jsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, X } from 'lucide-react';

/**
 * Tag input with autocomplete suggestions.
 * - Type to add a tag, press space/comma/enter to commit
 * - Shows suggestions from `allTags` filtered by current input
 * - Tap suggestion to add it
 * - X to remove
 *
 * value: array of strings (tags)
 * onChange: (tags) => void
 * allTags: array of all known tags from history (for autocomplete)
 */
export default function TagInput({ value = [], onChange, allTags = [], placeholder = 'Add tag…' }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const tags = useMemo(() => {
    if (!Array.isArray(value)) {
      // Tolerate string input
      if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    }
    return value;
  }, [value]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!focused) return [];
    const known = allTags.filter((t) => !tags.includes(t));
    if (!q) return known.slice(0, 6);
    return known
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 6);
  }, [input, allTags, tags, focused]);

  const addTag = (raw) => {
    const tag = String(raw).trim().replace(/^#/, '').replace(/[,\s]+/g, '-');
    if (!tag) return;
    if (tags.includes(tag)) { setInput(''); return; }
    onChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      if (input.trim()) {
        e.preventDefault();
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div>
      <div className="relative">
        <div
          className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--bg)] focus-within:ring-2 focus-within:ring-[var(--border)] cursor-text min-h-[44px]"
          onClick={() => inputRef.current?.focus()}
        >
          <Hash size={13} className="text-muted shrink-0" />
          {tags.map((t) => (
            <motion.span
              key={t}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-[var(--surface)] border text-[12px]"
            >
              <span>#{t}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(t); }}
                className="w-4 h-4 rounded-sm hover:bg-[var(--bg)] flex items-center justify-center text-muted"
              >
                <X size={10} />
              </button>
            </motion.span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Commit on blur if there's pending input
              if (input.trim()) addTag(input);
              setTimeout(() => setFocused(false), 150);
            }}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[60px] bg-transparent outline-none text-sm placeholder:text-muted"
          />
        </div>

        <AnimatePresence>
          {focused && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-1 surface border rounded-xl shadow-lg z-10 p-1.5 max-h-48 overflow-y-auto"
            >
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg)] text-sm flex items-center gap-2"
                >
                  <Hash size={12} className="text-muted" />
                  <span>{tag}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-[10px] text-muted mt-1 px-1">
        Press space, comma, or enter to add. Tap to remove.
      </div>
    </div>
  );
}
