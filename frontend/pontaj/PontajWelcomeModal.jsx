import React from "react";

/**
 * PontajWelcomeModal
 * Modal temporar care apare o singură dată pentru a informa utilizatorii
 * despre noua interfață de pontaj.
 * 
 * Folosește localStorage pentru a ține minte dacă utilizatorul a văzut deja modalul.
 */
const PontajWelcomeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            Interfață actualizată pentru pontaj
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Închide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 text-slate-700">
          <ul className="text-sm space-y-2 ml-4 list-disc">
            <li>
              <span className="font-medium">Click pe celulă</span> pentru a adăuga sau modifica pontajul
            </li>
            <li>
              <span className="font-medium">Selectează orele</span> de intrare și ieșire direct din fereastra de pontaj
            </li>
            <li>
              <span className="font-medium">Editează sau șterge</span> pontajul existent din același loc
            </li>
          </ul>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Am înțeles, mulțumesc!
          </button>
        </div>
      </div>
    </div>
  );
};

export default PontajWelcomeModal;

