/**
 * FileUpload Component
 * Componentă pentru upload de fișiere (doar pentru manager)
 */

import React, { useState, useRef } from "react";
import { useFileUpload } from "../hooks/useFileUpload";
import { workplaceService } from "@/shared/services/workplaceService";
import type { Workplace } from "@/shared/types/workplace.types";

interface FileUploadProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onSuccess, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [selectedWorkplaceIds, setSelectedWorkplaceIds] = useState<string[]>([]);
  const [allWorkplaces, setAllWorkplaces] = useState<Workplace[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress, error: uploadError } = useFileUpload({
    onSuccess: () => {
      setSelectedFile(null);
      setSelectedWorkplaceIds([]);
      setIsGlobal(false);
      setDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (onSuccess) onSuccess();
    },
    onError: (err) => setError(err),
  });

  // Încarcă farmaciile
  React.useEffect(() => {
    const loadWorkplaces = async () => {
      try {
        const workplaces = await workplaceService.getAllForAdmin();
        setAllWorkplaces(workplaces.filter((w) => w.isActive));
      } catch (err) {
        console.error("Eroare la încărcarea farmaciilor:", err);
      }
    };
    loadWorkplaces();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validare mărime (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError("Fișierul depășește mărimea maximă de 50MB");
        return;
      }
      setSelectedFile(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedFile) {
      setError("Selectează un fișier");
      return;
    }

    if (!isGlobal && selectedWorkplaceIds.length === 0) {
      setError("Selectează cel puțin o farmacie sau alege 'Toate farmaciile'");
      return;
    }

    try {
      await upload(
        selectedFile,
        isGlobal ? [] : selectedWorkplaceIds,
        "other", // Categorie implicită
        description || undefined
      );
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleAddWorkplace = (workplaceId: string) => {
    if (!selectedWorkplaceIds.includes(workplaceId)) {
      setSelectedWorkplaceIds((prev) => [...prev, workplaceId]);
    }
  };

  const handleRemoveWorkplace = (workplaceId: string) => {
    setSelectedWorkplaceIds((prev) => prev.filter((id) => id !== workplaceId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const selectedWorkplaces = allWorkplaces.filter((wp) =>
    selectedWorkplaceIds.includes(wp._id)
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Încarcă fișier</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Select */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Selectează fișier
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              selectedFile
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            />
            {selectedFile ? (
              <div>
                <svg
                  className="w-12 h-12 text-emerald-600 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-1">{formatFileSize(selectedFile.size)}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Elimină
                </button>
              </div>
            ) : (
              <div>
                <svg
                  className="w-12 h-12 text-slate-400 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm text-slate-600">Click pentru a selecta un fișier</p>
                <p className="text-xs text-slate-500 mt-1">Max 50MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Descriere (opțional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Adaugă o descriere pentru acest fișier..."
          />
        </div>

        {/* Destinatar */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Destinatar
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer transition-all hover:border-emerald-300 hover:bg-emerald-50/50">
              <input
                type="radio"
                name="destination"
                checked={isGlobal}
                onChange={() => setIsGlobal(true)}
                className="w-5 h-5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <span className="text-sm font-semibold text-slate-700 block">Toate farmaciile</span>
                <span className="text-xs text-slate-500">Fișierul va fi trimis tuturor farmaciilor</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer transition-all hover:border-emerald-300 hover:bg-emerald-50/50">
              <input
                type="radio"
                name="destination"
                checked={!isGlobal}
                onChange={() => setIsGlobal(false)}
                className="w-5 h-5 text-emerald-600 border-slate-300 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <span className="text-sm font-semibold text-slate-700 block">Farmacii selectate</span>
                <span className="text-xs text-slate-500">Alege farmaciile țintă</span>
              </div>
            </label>
          </div>

          {!isGlobal && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Selectează farmaciile țintă
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddWorkplace(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-3"
              >
                <option value="">Selectează o farmacie...</option>
                {allWorkplaces
                  .filter((wp) => !selectedWorkplaceIds.includes(wp._id))
                  .map((wp) => (
                    <option key={wp._id} value={wp._id}>
                      {wp.name}
                    </option>
                  ))}
              </select>

              {selectedWorkplaces.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedWorkplaces.map((wp) => (
                    <span
                      key={wp._id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200"
                    >
                      {wp.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveWorkplace(wp._id)}
                        className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-200 rounded transition-colors p-0.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress */}
        {uploading && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-600">Se încarcă...</span>
              <span className="text-sm text-slate-600">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {(error || uploadError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error || uploadError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Anulează
            </button>
          )}
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Se încarcă..." : "Încarcă fișier"}
          </button>
        </div>
      </form>
    </div>
  );
};


