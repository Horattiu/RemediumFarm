/**
 * File Feature Configuration
 * Configurație centralizată pentru feature-ul de fișiere
 * Poate fi dezactivat prin ENABLE_FILE_FEATURE=false în .env
 */

module.exports = {
  // Feature toggle
  enabled: process.env.ENABLE_FILE_FEATURE !== "false",

  // Storage type: "googledrive" | "local"
  storageType: process.env.FILE_STORAGE_TYPE || "googledrive",

  // Limite upload
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/zip",
    "application/x-zip-compressed",
  ],

  // Rate limiting
  maxFilesPerMinute: 10,
  maxSizePerMinute: 100 * 1024 * 1024, // 100MB

  // Google Drive settings
  googleDriveRootFolder: "RemediumFarm/Files",
  googleDriveCredentialsPath: "google-drive-credentials.json",

  // Local storage (pentru development)
  localStoragePath: "uploads/files",
};


