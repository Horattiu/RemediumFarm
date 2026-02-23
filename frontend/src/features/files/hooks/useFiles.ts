/**
 * useFiles Hook
 * Hook pentru gestionarea listei de fișiere
 */

import { useState, useEffect, useCallback } from "react";
import { fileService } from "../services/fileService";
import type { File, FileListResponse } from "../types/file.types";

// Event custom pentru sincronizarea actualizărilor între instanțe
const FILE_MARKED_AS_READ_EVENT = "fileMarkedAsRead";

// Funcție helper pentru a emite event
const emitFileMarkedAsRead = (fileId: string) => {
  window.dispatchEvent(new CustomEvent(FILE_MARKED_AS_READ_EVENT, { detail: { fileId } }));
};

interface UseFilesOptions {
  category?: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  workplaceId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useFiles = (options: UseFilesOptions = {}) => {
  const {
    category,
    page = 1,
    limit = 20,
    unreadOnly = false,
    workplaceId,
    autoRefresh = false,
    refreshInterval = 30000, // 30 secunde
  } = options;

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: FileListResponse = await fileService.getAll({
        category,
        page,
        limit,
        unreadOnly,
        workplaceId,
      });

      setFiles(response.files);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setUnreadCount(response.unreadCount || 0);
    } catch (err: any) {
      setError(err.message || "Eroare la încărcarea fișierelor");
      console.error("Error loading files:", err);
    } finally {
      setLoading(false);
    }
  }, [category, page, limit, unreadOnly, workplaceId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadFiles();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadFiles]);

  // Ascultă evenimente de marcare ca citit pentru sincronizare instantanee
  useEffect(() => {
    const handleFileMarkedAsRead = () => {
      // Reîncarcă imediat când un fișier este marcat ca citit
      loadFiles();
    };

    window.addEventListener(FILE_MARKED_AS_READ_EVENT, handleFileMarkedAsRead);
    return () => {
      window.removeEventListener(FILE_MARKED_AS_READ_EVENT, handleFileMarkedAsRead);
    };
  }, [loadFiles]);

  const refresh = () => {
    loadFiles();
  };

  const markAsRead = async (fileId: string) => {
    try {
      await fileService.markAsRead(fileId);
      // Actualizează starea locală imediat
      setFiles((prev) =>
        prev.map((f) =>
          f._id === fileId ? { ...f, isRead: true } : f
        )
      );
      // Actualizează unreadCount imediat
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Emite event pentru sincronizare cu alte instanțe (ex: badge)
      emitFileMarkedAsRead(fileId);
      // Reîncarcă pentru a actualiza datele din backend (fără delay)
      loadFiles();
    } catch (err) {
      console.error("Error marking file as read:", err);
    }
  };

  return {
    files,
    loading,
    error,
    total,
    totalPages,
    unreadCount,
    refresh,
    markAsRead,
  };
};

