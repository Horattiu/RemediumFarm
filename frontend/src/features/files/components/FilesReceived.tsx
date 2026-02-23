/**
 * FilesReceived Component
 * Componentă pentru admin farmacie - fișiere primite
 */

import React, { useState } from "react";
import { useFiles } from "../hooks/useFiles";
import { FileCard } from "./FileCard";
import { getUserFromStorage } from "@/features/auth/utils/auth.utils";

export const FilesReceived: React.FC = () => {
  const user = getUserFromStorage();
  const userWorkplaceId = user?.workplaceId;

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { files, loading, error, total, totalPages, unreadCount, refresh, markAsRead } = useFiles({
    page: currentPage,
    limit: 20,
    unreadOnly: showUnreadOnly,
    workplaceId: userWorkplaceId,
    autoRefresh: true, // Auto-refresh la 30 secunde
    refreshInterval: 30000,
  });

  const handleMarkAsRead = async (fileId: string) => {
    await markAsRead(fileId);
    refresh();
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
      {/* Header cu badge pentru fișiere noi */}
      {unreadCount > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-sm font-medium text-emerald-900">
              Ai {unreadCount} {unreadCount === 1 ? "fișier nou" : "fișiere noi"}
            </span>
          </div>
        </div>
      )}

      {/* Filtre */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => {
              setShowUnreadOnly(e.target.checked);
              setCurrentPage(1);
            }}
            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700">Doar necitite</span>
        </label>

        <div className="text-sm text-slate-600 ml-auto">
          Total: {total} fișiere
        </div>
      </div>

      {/* Listă */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          {showUnreadOnly ? "Nu ai fișiere necitite" : "Nu ai primit fișiere"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((file) => (
              <FileCard
                key={file._id}
                file={file}
                onMarkAsRead={() => handleMarkAsRead(file._id)}
              />
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


