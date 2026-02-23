import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Employee } from '@/shared/types/employee.types';

interface AddVisitorProps {
  items?: Employee[]; // TOȚI angajații (din toate farmaciile)
  excludeIds?: string[]; // ids deja în tabel (employees + visitors)
  onPick?: (person: Employee) => void; // (person) => void
  disabled?: boolean;
  label?: string;
}

export const AddVisitor: React.FC<AddVisitorProps> = ({
  items = [],
  excludeIds = [],
  onPick,
  disabled = false,
  label = '+ Adaugă vizitator',
}) => {
  const visitorInfoTooltip =
    'Vizitator: angajat din alt punct de lucru care desfășoară temporar activitate în această unitate și își înregistrează aici orele de lucru.';

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return (Array.isArray(items) ? items : [])
      .filter((p) => p?._id && !excluded.has(p._id))
      .filter((p) => {
        if (!s) return false; // Nu arată rezultate dacă nu e nimic scris
        const name = (p.name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const func = (p.function || '').toLowerCase();
        return name.includes(s) || email.includes(s) || func.includes(s);
      })
      .slice(0, 2); // Maxim 2 persoane
  }, [items, excluded, q]);

  // Arată meniul când există rezultate
  useEffect(() => {
    setShowMenu(q.trim().length > 0 && filtered.length > 0);
  }, [q, filtered.length]);

  // Click outside => close
  useEffect(() => {
    if (!showMenu) return;

    const onDown = (e: MouseEvent) => {
      const container = containerRef.current;
      if (container?.contains(e.target as Node)) return;
      setShowMenu(false);
      setQ('');
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showMenu]);

  const pick = (p: Employee) => {
    onPick?.(p);
    setQ('');
    setShowMenu(false);
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-3">
      <span
        className="text-sm text-slate-700 whitespace-nowrap cursor-help"
        title={visitorInfoTooltip}
      >
        {label}
      </span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          placeholder="Caută..."
          className={`px-3 py-2 border rounded-lg text-sm w-64 ${
            disabled
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
          }`}
        />

        {showMenu && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <ul className="py-1">
              {filtered.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {p.name || '-'}
                    </div>
                    {p.email && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.email}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

