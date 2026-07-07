// components/dashboard/SortableTable.tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  className?: string;
}

interface SortableTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  emptyMessage?: string;
}

export default function SortableTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = 'No records found.',
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir, columns]);

  function handleHeaderClick(col: ColumnDef<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div
        className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => handleHeaderClick(col)}
            disabled={!col.sortable}
            className={[
              'flex items-center gap-1 text-left',
              col.sortable ? 'cursor-pointer hover:text-slate-700' : 'cursor-default',
              col.className ?? '',
            ].join(' ')}
          >
            {col.label}
            {col.sortable && sortKey === col.key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100 bg-white">
        {sortedRows.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">{emptyMessage}</p>}
        {sortedRows.map((row) => (
          <motion.div
            key={row.id}
            layout
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid items-center gap-2 px-4 py-3 text-sm"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <div key={col.key} className={col.className}>
                {col.render(row)}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}