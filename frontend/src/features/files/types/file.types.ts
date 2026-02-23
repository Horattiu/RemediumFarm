/**
 * File Types
 * TypeScript types pentru feature-ul de fișiere
 */

import type { BaseEntity } from "@/shared/types/common.types";

export interface File extends BaseEntity {
  filename: string;
  mimeType: string;
  size: number;
  hash: string;
  storageType: "googledrive" | "local" | "s3";
  storageFileId: string;
  storagePath: string;
  workplaceId?: string;
  workplaceIds: string[];
  uploadedBy: string;
  uploadedByName: string;
  category: "document" | "image" | "instruction" | "other";
  description: string;
  isActive: boolean;
  isRead: boolean;
  readBy: Array<{
    workplaceId?: string;
    readAt: string;
    readBy: string;
  }>;
  expiresAt?: string;
}

export interface FileUploadRequest {
  file: File;
  workplaceIds: string[];
  category: "document" | "image" | "instruction" | "other";
  description?: string;
}

export interface FileListResponse {
  files: File[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount?: number;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, number>;
  byWorkplace: number;
}


