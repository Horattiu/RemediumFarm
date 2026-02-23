/**
 * Files Feature - Export centralizat
 * Feature modular pentru gestionarea fișierelor
 */

export { fileService } from "./services/fileService";
export { useFiles } from "./hooks/useFiles";
export { useFileUpload } from "./hooks/useFileUpload";
export { FileUpload } from "./components/FileUpload";
export { FileList } from "./components/FileList";
export { FileCard } from "./components/FileCard";
export { FileManager } from "./components/FileManager";
export { FilesReceived } from "./components/FilesReceived";
export { FileViewer } from "./components/FileViewer";
export type { File, FileUploadRequest, FileListResponse, FileStats } from "./types/file.types";

