// src/components/settings/DataExport.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileJson, FileSpreadsheet, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function DataExport() {
  const exportAllData = useStore((s) => s.exportAllData);
  const transactions = useStore((s) => s.personal.transactions);
  const [flashed, setFlashed] = useState(null);

  const flash = (which) => {
    setFlashed(which);
    setTimeout(() => setFlashed(null), 1600);
  };

  const downloadFile = (filename, content, mime) => {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const exportJSON = () => {
    const data = exportAllData();
    const ts = new Date().toISOString().slice(0, 10);
    if (downloadFile(`fintrack-backup-${ts}.json`, JSON.stringify(data, null, 2), 'application/json')) {
      flash('json');
    }
  };

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['date', 'type', 'amount', 'currency', 'category', 'notes', 'tags'];
    const escape = (v) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = [
      headers.join(','),
      ...transactions.map((t) =>
        headers.map((h) => escape(t[h] ?? '')).join(',')
      ),
    ];
    const ts = new Date().toISOString().slice(0, 10);
    if (downloadFile(`fintrack-transactions-${ts}.csv`, rows.join('\n'), 'text/csv')) {
      flash('csv');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted leading-relaxed">
        Download a copy of your data. Your sheet is the canonical source — these exports are for backup or analysis in another tool.
      </p>

      <div className="space-y-2">
        <ExportCard
          icon={FileJson}
          title="Full backup (JSON)"
          desc="All transactions, buckets, goals, debts, investments, recurring schedules, templates, categories, and settings."
          onClick={exportJSON}
          flashed={flashed === 'json'}
        />
        <ExportCard
          icon={FileSpreadsheet}
          title="Transactions only (CSV)"
          desc={`${transactions.length} transactions · open in Excel, Numbers, or Google Sheets`}
          onClick={exportCSV}
          flashed={flashed === 'csv'}
          disabled={transactions.length === 0}
        />
      </div>

      <p className="text-[11px] text-muted text-center pt-2">
        Files save to your device's Downloads folder.
      </p>
    </div>
  );
}

function ExportCard({ icon: Icon, title, desc, onClick, flashed, disabled }) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left surface border rounded-xl p-4 hover:bg-[var(--bg)] transition-colors disabled:opacity-40 disabled:hover:bg-[var(--surface)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center shrink-0">
          {flashed ? <Check size={17} className="text-accent-income" /> : <Icon size={17} strokeWidth={1.75} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{flashed ? 'Downloaded' : title}</div>
          <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{desc}</div>
        </div>
        <Download size={15} className="text-muted shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}
