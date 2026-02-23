/**
 * useFileUpload Hook
 * Hook pentru upload de fișiere
 */

import { useState } from "react";
import { fileService } from "../services/fileService";
import type { File } from "../types/file.types";

interface UseFileUploadOptions {
  onSuccess?: (file: File) => void;
  onError?: (error: string) => void;
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const { onSuccess, onError } = options;
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (
    file: globalThis.File,
    workplaceIds: string[],
    category: "document" | "image" | "instruction" | "other",
    description?: string
  ) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Simulare progress (pentru că multer nu oferă progress real)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const uploadedFile = await fileService.upload(
        file,
        workplaceIds,
        category,
        description
      );

      clearInterval(progressInterval);
      setProgress(100);

      if (onSuccess) {
        onSuccess(uploadedFile);
      }

      return uploadedFile;
    } catch (err: any) {
      setError(err.message || "Eroare la încărcarea fișierului");
      if (onError) {
        onError(err.message || "Eroare la încărcarea fișierului");
      }
      throw err;
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    upload,
    uploading,
    progress,
    error,
  };
};


