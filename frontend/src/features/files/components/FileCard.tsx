/**
 * FileCard Component
 * Card pentru afișarea unui fișier (pentru admin farmacie)
 */

import React from "react";
import { fileService } from "../services/fileService";
import { FileViewer } from "./FileViewer";
import { API_URL } from "@/config/api";
import type { File } from "../types/file.types";

// Event custom pentru sincronizarea actualizărilor
const FILE_MARKED_AS_READ_EVENT = "fileMarkedAsRead";
const emitFileMarkedAsRead = (fileId: string) => {
  window.dispatchEvent(new CustomEvent(FILE_MARKED_AS_READ_EVENT, { detail: { fileId } }));
};

interface FileCardProps {
  file: File;
  onMarkAsRead?: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onMarkAsRead }) => {
  const [downloading, setDownloading] = React.useState(false);
  const [showViewer, setShowViewer] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
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
      console.error("Error downloading file:", err);
      alert("Eroare la descărcarea fișierului");
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return (
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType.includes("pdf")) {
      return (
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType.includes("word") || mimeType.includes("document")) {
      return (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
      return (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      document: "Document",
      image: "Imagine",
      instruction: "Instrucțiuni",
      other: "Altele",
    };
    return labels[category] || category;
  };

  // Preview thumbnail pentru imagini
  const isImage = file.mimeType?.startsWith("image/");
  const token = localStorage.getItem("token");
  const previewUrl = isImage ? `${API_URL}/api/files/${file._id}/download${token ? `?token=${token}` : ""}` : null;

  return (
    <div
      className={`p-4 border rounded-lg transition-all cursor-pointer hover:shadow-md ${
        file.isRead
          ? "bg-white border-slate-200"
          : "bg-emerald-50 border-emerald-200 shadow-sm"
      }`}
      onClick={() => {
        if (isImage || file.mimeType === "application/pdf") {
          setShowViewer(true);
        }
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon sau Preview thumbnail */}
        <div className="flex-shrink-0">
          {isImage && previewUrl ? (
            <div className="w-32 h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
              <img
                src={previewUrl}
                alt={file.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback la icon dacă imaginea nu se încarcă
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="w-16 h-16 flex items-center justify-center">
              {getFileIcon(file.mimeType)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{file.filename}</h3>
              {!file.isRead && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                  Nou
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {formatFileSize(file.size)}
            </span>
          </div>

          {file.description && (
            <p className="text-sm text-slate-600 mb-2">{file.description}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
            <span className="px-2 py-1 bg-slate-100 rounded">{getCategoryLabel(file.category)}</span>
            <span>De: {file.uploadedByName}</span>
            <span>
              {new Date(file.createdAt).toLocaleDateString("ro-RO", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Preview button pentru imagini și PDF */}
            {(file.mimeType?.startsWith("image/") || file.mimeType === "application/pdf") && (
              <button
                onClick={() => setShowViewer(true)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Vezi
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Se descarcă...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descarcă
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      <FileViewer
        file={showViewer ? file : null}
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        onMarkAsRead={onMarkAsRead}
      />
    </div>
  );
};


