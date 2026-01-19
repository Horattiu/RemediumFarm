import React, { useEffect, useMemo, useRef, useState } from "react";

const AddVisitor = ({
  items = [], // TOȚI angajații (din toate farmaciile)
  excludeIds = [], // ids deja în tabel (employees + visitors)
  onPick, // (person) => void
  disabled = false,
  label = "+ Adaugă vizitator",
}) => {
  const btnRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 });

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return (Array.isArray(items) ? items : [])
      .filter((p) => p?._id && !excluded.has(p._id))
      .filter((p) => {
        if (!s) return true;
        const name = (p.name || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        const func = (p.function || "").toLowerCase();
        return name.includes(s) || email.includes(s) || func.includes(s);
      })
      .slice(0, 10);
  }, [items, excluded, q]);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const gap = 10;
    const menuWidth = 360;
    const menuHeight = 300; // Estimare pentru înălțimea meniului
    const padding = 16; // Padding de la marginile ecranului

    // Calculează lățimea disponibilă
    const availableWidth = Math.max(280, Math.min(menuWidth, window.innerWidth - padding * 2));

    // Verifică dacă meniul ar ieși din viewport pe orizontală (dreapta)
    const spaceOnRight = window.innerWidth - r.right - gap;
    const spaceOnLeft = r.left - gap;
    
    let left;
    if (spaceOnRight >= availableWidth) {
      // Are loc în dreapta
      left = r.right + gap;
    } else if (spaceOnLeft >= availableWidth) {
      // Are loc în stânga
      left = r.left - availableWidth - gap;
    } else {
      // Nu are loc nici în dreapta, nici în stânga - centrează sau pune la margine
      if (spaceOnRight > spaceOnLeft) {
        left = r.right + gap;
      } else {
        left = padding;
      }
    }

    // Verifică dacă meniul ar ieși din viewport pe verticală (jos)
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    
    let top;
    if (spaceBelow >= menuHeight) {
      // Are loc dedesubt
      top = r.bottom + gap;
    } else if (spaceAbove >= menuHeight) {
      // Are loc deasupra
      top = r.top - menuHeight - gap;
    } else {
      // Nu are loc nici dedesubt, nici deasupra - ajustează la viewport
      if (spaceBelow > spaceAbove) {
        top = r.bottom + gap;
      } else {
        top = Math.max(padding, r.top - menuHeight - gap);
      }
    }

    // Asigură-te că meniul nu iese din viewport
    top = Math.max(padding, Math.min(top, window.innerHeight - menuHeight - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - availableWidth - padding));

    setPos({
      top,
      left,
      width: availableWidth,
    });
  };

  useEffect(() => {
    if (!open) return;

    computePos();

    const onResize = () => computePos();
    const onScroll = () => computePos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // click outside => close
  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      const btn = btnRef.current;
      const menu = document.getElementById("add-visitor-menu");
      if (btn?.contains(e.target)) return;
      if (menu?.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (p) => {
    onPick?.(p);
    setQ("");
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`px-4 py-2 rounded-lg border text-sm font-medium ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : "border-slate-300 bg-white hover:bg-slate-50"
        }`}
      >
        {label}
      </button>

      {open && (
        <div
          id="add-visitor-menu"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 9999,
          }}
          className="rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Caută după nume / email / funcție…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />

            <div className="mt-2 max-h-60 overflow-auto">
              {filtered.length === 0 ? (
                <div className="px-1 py-2 text-sm text-slate-500">
                  Niciun rezultat.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((p) => (
                    <li key={p._id}>
                      <button
                        type="button"
                        onClick={() => pick(p)}
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {p.name || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.email || "—"}
                          {p.function ? ` • ${p.function}` : ""}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddVisitor;
