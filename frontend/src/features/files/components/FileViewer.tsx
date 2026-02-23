/**
 * FileViewer Component
 * Modal pentru preview/viewer de fișiere
 */

import React, { useState, useEffect } from "react";
import { fileService } from "../services/fileService";
import { API_URL } from "@/config/api";
import type { File } from "../types/file.types";

// Event custom pentru sincronizarea actualizărilor
const FILE_MARKED_AS_READ_EVENT = "fileMarkedAsRead";
const emitFileMarkedAsRead = (fileId: string) => {
  window.dispatchEvent(new CustomEvent(FILE_MARKED_AS_READ_EVENT, { detail: { fileId } }));
};

interface FileViewerProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead?: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  file,
  isOpen,
  onClose,
  onMarkAsRead,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setViewUrl(null);
      setError(null);
      return;
    }

    // Marchează ca citit când se deschide viewer-ul
    if (!file.isRead && onMarkAsRead) {
      fileService.markAsRead(file._id).then(async () => {
        await onMarkAsRead();
      }).catch(err => {
        console.error("Error marking file as read:", err);
      });
    }

    // Generează URL pentru preview
    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        // Folosim URL-ul de download (backend-ul gestionează autentificarea prin cookie/token)
        const downloadUrl = `${API_URL}/api/files/${file._id}/download`;
        setViewUrl(downloadUrl);
      } catch (err: any) {
        setError(err.message || "Eroare la încărcarea fișierului");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, file, onMarkAsRead]);

  if (!isOpen || !file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{file.filename}</h3>
              <p className="text-xs text-emerald-100 truncate">
                {file.description || "Fără descriere"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                try {
                  await fileService.download(file._id);
                  // Marcarea ca citit se face automat în backend la download
                  // Emite event pentru sincronizare cu alte instanțe (ex: badge)
                  if (!file.isRead) {
                    emitFileMarkedAsRead(file._id);
                    // Actualizăm starea locală imediat
                    if (onMarkAsRead) {
                      await onMarkAsRead();
                    }
                  }
                } catch (err) {
                  console.error("Error downloading:", err);
                  alert("Eroare la descărcarea fișierului");
                }
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descarcă
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-emerald-100 transition-colors"
              aria-label="Închide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-emerald-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-slate-600">Se încarcă...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-12 h-12 text-red-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 font-medium">{error}</p>
                  <button
                    onClick={async () => {
                      try {
                        await fileService.download(file._id);
                        // Marcarea ca citit se face automat în backend la download
                        // Emite event pentru sincronizare cu alte instanțe (ex: badge)
                        if (!file.isRead) {
                          emitFileMarkedAsRead(file._id);
                          // Actualizăm starea locală imediat
                          if (onMarkAsRead) {
                            await onMarkAsRead();
                          }
                        }
                      } catch (err) {
                        console.error("Error downloading:", err);
                      }
                    }}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Descarcă fișierul
                  </button>
              </div>
            </div>
          ) : viewUrl ? (
            <div className="flex items-center justify-center h-full">
              {isImage ? (
                <img
                  src={viewUrl}
                  alt={file.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  onError={() => setError("Nu s-a putut încărca imaginea")}
                />
              ) : isPDF ? (
                <iframe
                  src={viewUrl}
                  className="w-full h-full min-h-[600px] border-0 rounded-lg shadow-lg"
                  title={file.filename}
                  onError={() => setError("Nu s-a putut încărca PDF-ul")}
                />
              ) : (
                <div className="text-center p-8">
                  <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-slate-600 mb-4">Preview nu este disponibil pentru acest tip de fișier</p>
                  <button
                    onClick={async () => {
                      try {
                        await fileService.download(file._id);
                        // Marcarea ca citit se face automat în backend la download
                        // Emite event pentru sincronizare cu alte instanțe (ex: badge)
                        if (!file.isRead) {
                          emitFileMarkedAsRead(file._id);
                          // Actualizăm starea locală imediat
                          if (onMarkAsRead) {
                            await onMarkAsRead();
                          }
                        }
                      } catch (err) {
                        console.error("Error downloading:", err);
                        alert("Eroare la descărcarea fișierului");
                      }
                    }}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Descarcă fișierul
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

