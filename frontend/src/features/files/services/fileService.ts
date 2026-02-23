/**
 * File Service
 * API calls pentru feature-ul de fișiere
 */

import { API_URL } from "@/config/api";
import { apiClient } from "@/shared/services/api/client";
import type { File, FileListResponse, FileStats } from "../types/file.types";

const getToken = (): string | null => {
  return localStorage.getItem("token");
};

export const fileService = {
  /**
   * Upload un fișier
   */
  async upload(
    file: globalThis.File,
    workplaceIds: string[],
    category: "document" | "image" | "instruction" | "other",
    description?: string
  ): Promise<File> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("workplaceIds", JSON.stringify(workplaceIds));
    formData.append("category", category);
    if (description) {
      formData.append("description", description);
    }

    const token = getToken();
    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Eroare la upload" }));
      throw new Error(error.error || "Eroare la încărcarea fișierului");
    }

    const data = await response.json();
    return data as File;
  },

  /**
   * Obține lista de fișiere
   */
  async getAll(filters?: {
    category?: string;
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    workplaceId?: string;
  }): Promise<FileListResponse> {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.unreadOnly) params.append("unreadOnly", "true");
    if (filters?.workplaceId) params.append("workplaceId", filters.workplaceId);

    const response = await apiClient.get<FileListResponse>(
      `/api/files?${params.toString()}`
    );
    return response.data as FileListResponse;
  },

  /**
   * Download un fișier
   */
  async download(fileId: string): Promise<void> {
    // Generează URL-ul de download
    const url = `${API_URL}/api/files/${fileId}/download`;
    
    // Deschide în tab nou pentru download
    window.open(url, "_blank");
  },

  /**
   * Marchează un fișier ca citit
   */
  async markAsRead(fileId: string): Promise<File> {
    const response = await apiClient.post<File>(`/api/files/${fileId}/read`);
    return response.data as File;
  },

  /**
   * Șterge un fișier
   */
  async delete(fileId: string): Promise<void> {
    await apiClient.delete(`/api/files/${fileId}`);
  },

  /**
   * Șterge toate fișierele (doar superadmin)
   */
  async deleteAll(): Promise<{ deletedCount: number; storageFilesDeleted: number }> {
    const response = await apiClient.delete<{ deletedCount: number; storageFilesDeleted: number }>("/api/files");
    return response.data;
  },

  /**
   * Obține statistici (doar superadmin)
   */
  async getStats(): Promise<FileStats> {
    const response = await apiClient.get<FileStats>("/api/files/stats");
    return response.data as FileStats;
  },
};

