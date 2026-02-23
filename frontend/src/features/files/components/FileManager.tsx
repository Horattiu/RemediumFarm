/**
 * FileManager Component
 * Componentă completă pentru manager (upload + listă)
 */

import React, { useState } from "react";
import { FileUpload } from "./FileUpload";
import { FileList } from "./FileList";

export const FileManager: React.FC = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingAll, setDeletingAll] = useState(false);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setRefreshKey((prev) => prev + 1); // Force refresh
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      "⚠️ ATENȚIE: Ești sigur că vrei să ștergi TOATE fișierele?\n\n" +
      "Această acțiune este permanentă și nu poate fi anulată.\n\n" +
      "Toate fișierele vor fi șterse definitiv."
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      "⚠️ CONFIRMARE FINALĂ\n\n" +
      "Ești ABSOLUT SIGUR că vrei să ștergi TOATE fișierele?\n\n" +
      "Scrie 'DA' în următoarea casetă pentru a confirma."
    );

    if (!doubleConfirm) return;

    setDeletingAll(true);
    try {
      const { fileService } = await import("../services/fileService");
      await fileService.deleteAll();
      alert("✅ Toate fișierele au fost șterse cu succes!");
      handleUploadSuccess(); // Refresh lista
    } catch (err: any) {
      alert(err.message || "Eroare la ștergerea tuturor fișierelor");
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Fișiere</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Șterge toate fișierele"
          >
            {deletingAll ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Se șterg...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Șterge toate</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showUpload ? "Anulează" : "Încarcă fișier"}
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="mb-6">
          <FileUpload onSuccess={handleUploadSuccess} onClose={() => setShowUpload(false)} />
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Fișiere trimise</h3>
        <FileList key={refreshKey} onFileDeleted={handleUploadSuccess} />
      </div>
    </div>
  );
};


