/**
 * FileList Component
 * Listă de fișiere (pentru manager - toate fișierele trimise)
 */

import React, { useState, useEffect } from "react";
import { useFiles } from "../hooks/useFiles";
import { fileService } from "../services/fileService";
import { workplaceService } from "@/shared/services/workplaceService";
import type { File } from "../types/file.types";
import type { Workplace } from "@/shared/types/workplace.types";

interface FileListProps {
  workplaceId?: string;
  onFileDeleted?: () => void;
}

export const FileList: React.FC<FileListProps> = ({ workplaceId, onFileDeleted }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);

  const { files, loading, error, total, totalPages, refresh } = useFiles({
    page: currentPage,
    limit: 20,
    workplaceId,
  });

  // Încarcă workplaces pentru a afișa numele farmaciilor
  useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const data = await workplaceService.getAll();
        setWorkplaces(data);
      } catch (err) {
        console.error("Eroare la încărcarea workplaces:", err);
      }
    };
    loadWorkplaces();
  }, []);

  const handleDelete = async (fileId: string) => {
    if (!confirm("Sigur vrei să ștergi acest fișier? Acțiunea este permanentă.")) {
      return;
    }

    setDeletingId(fileId);
    try {
      await fileService.delete(fileId);
      refresh();
      if (onFileDeleted) onFileDeleted();
    } catch (err: any) {
      alert(err.message || "Eroare la ștergerea fișierului");
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Obține numele farmaciilor pentru un fișier
  const getRecipientsText = (file: File): string => {
    if (file.workplaceIds.length === 0) {
      return "Toate farmaciile";
    }
    
    const workplaceNames = file.workplaceIds
      .map((id) => {
        const workplace = workplaces.find((wp) => wp._id === id);
        return workplace?.name || id;
      })
      .filter(Boolean);
    
    return workplaceNames.join(", ");
  };


  if (loading && files.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">Se încarcă...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-center justify-end">
        <div className="text-sm text-slate-600">
          Total: {total} fișiere
        </div>
      </div>

      {/* Listă */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          Nu există fișiere trimise
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file._id}
                className="p-4 border border-slate-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {file.filename}
                      </h3>
                    </div>

                    {file.description && (
                      <p className="text-sm text-slate-600 mb-2">{file.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>
                        Destinatari: {getRecipientsText(file)}
                      </span>
                      <span>De: {file.uploadedByName}</span>
                      <span>
                        {new Date(file.createdAt).toLocaleDateString("ro-RO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(file._id)}
                    disabled={deletingId === file._id}
                    className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Șterge fișier"
                  >
                    {deletingId === file._id ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginare */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-sm text-slate-600">
                Pagina {currentPage} din {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Următor →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};


