/**
 * GoogleDriveStorage - Implementare storage adapter pentru Google Drive
 * Folosește googleapis pentru a interacționa cu Google Drive
 */

const StorageAdapter = require("./StorageAdapter");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");
const fileConfig = require("../config/fileConfig");

class GoogleDriveStorage extends StorageAdapter {
  constructor() {
    super();
    this.initialized = false;
    this.rootFolderId = null;
  }

  /**
   * Inițializează conexiunea la Google Drive
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Încarcă credențiale
      const credentialsPath = path.join(
        __dirname,
        "..",
        fileConfig.googleDriveCredentialsPath
      );

      if (!fs.existsSync(credentialsPath)) {
        throw new Error(
          `Google Drive credentials not found at: ${credentialsPath}`
        );
      }

      const credentials = JSON.parse(
        fs.readFileSync(credentialsPath, "utf8")
      );

      // Autentificare
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets", // Pentru Sheets (deja ai)
          "https://www.googleapis.com/auth/drive", // Pentru Drive (nou)
        ],
      });

      this.drive = google.drive({ version: "v3", auth: this.auth });

      // Obține sau creează root folder
      this.rootFolderId = await this.getOrCreateRootFolder();

      this.initialized = true;
      console.log("✅ Google Drive Storage initialized");
    } catch (error) {
      console.error("❌ Google Drive Storage initialization error:", error);
      throw error;
    }
  }

  /**
   * Obține sau creează root folder-ul pentru fișiere
   * ⚠️ NU apelează initialize() - este apelat deja din initialize()
   * 
   * IMPORTANT: Service Accounts nu pot crea fișiere în root-ul Drive-ului personal.
   * Trebuie să folosim un folder partajat. Caută folder-ul partajat cu service account-ul.
   */
  async getOrCreateRootFolder() {
    // Verifică că drive este inițializat (dar nu apelează initialize() din nou)
    if (!this.drive || !this.auth) {
      throw new Error("Storage not initialized. Drive and auth must be set before calling this method.");
    }

    // Caută folder-ul "RemediumFarm" partajat cu service account-ul
    // Folosim 'sharedWithMe=true' pentru a găsi folderele partajate
    const folders = await this.drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and name='RemediumFarm' and trashed=false and 'me' in owners",
      fields: "files(id, name)",
      spaces: "drive",
    });

    let remediumFolderId = null;

    if (folders.data.files.length > 0) {
      remediumFolderId = folders.data.files[0].id;
    } else {
      // Dacă nu găsim, încercăm să căutăm în folderele partajate
      const sharedFolders = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name='RemediumFarm' and trashed=false",
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (sharedFolders.data.files.length > 0) {
        remediumFolderId = sharedFolders.data.files[0].id;
      } else {
        // Dacă nu există, aruncă eroare - folder-ul trebuie să fie creat și partajat manual
        throw new Error(
          "Folder-ul 'RemediumFarm' nu a fost găsit. " +
          "Te rugăm să creezi folderul 'RemediumFarm/Files' în Google Drive și să-l partajezi cu: " +
          "remedium-backup-service@remedium-backup-485415.iam.gserviceaccount.com " +
          "cu permisiunea 'Editor'."
        );
      }
    }

    // Caută sau creează folder-ul "Files" în "RemediumFarm"
    const filesFolders = await this.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='Files' and '${remediumFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (filesFolders.data.files.length > 0) {
      return filesFolders.data.files[0].id;
    } else {
      // Încearcă să creeze folder-ul "Files" în folder-ul partajat
      try {
        const filesFolder = await this.drive.files.create({
          requestBody: {
            name: "Files",
            mimeType: "application/vnd.google-apps.folder",
            parents: [remediumFolderId],
          },
          fields: "id",
        });
        return filesFolder.data.id;
      } catch (error) {
        // Dacă nu poate crea, aruncă eroare descriptivă
        throw new Error(
          "Nu s-a putut crea folder-ul 'Files' în 'RemediumFarm'. " +
          "Verifică că ai partajat folderul 'RemediumFarm' cu service account-ul " +
          "(remedium-backup-service@remedium-backup-485415.iam.gserviceaccount.com) " +
          "cu permisiunea 'Editor'. Eroare: " + error.message
        );
      }
    }
  }

  /**
   * Obține sau creează un folder după path
   * @param {String} folderPath - Path relativ (ex: "workplace123/2026/02")
   */
  async getOrCreateFolder(folderPath) {
    await this.initialize();

    if (!folderPath) return this.rootFolderId;

    const parts = folderPath.split("/").filter((p) => p);
    let currentFolderId = this.rootFolderId;

    for (const folderName of parts) {
      // Caută folder-ul
      const folders = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${currentFolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
      });

      if (folders.data.files.length > 0) {
        currentFolderId = folders.data.files[0].id;
      } else {
        // Creează folder-ul
        const newFolder = await this.drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [currentFolderId],
          },
          fields: "id",
        });
        currentFolderId = newFolder.data.id;
      }
    }

    return currentFolderId;
  }

  /**
   * Upload un fișier
   */
  async upload(fileBuffer, fileName, options = {}) {
    await this.initialize();

    const { folderPath, mimeType } = options;

    // Obține sau creează folder-ul
    const parentFolderId = await this.getOrCreateFolder(folderPath);

    // Metadata fișier
    const fileMetadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    // Convertim Buffer-ul într-un stream (Google Drive API așteaptă stream)
    const stream = Readable.from(fileBuffer);

    // Media (conținutul fișierului)
    const media = {
      mimeType: mimeType || "application/octet-stream",
      body: stream,
    };

    // Upload - folosim 'drive' space pentru a accesa folderele partajate
    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, size, webViewLink, webContentLink, mimeType",
      supportsAllDrives: true, // Suport pentru Shared Drives
    });

    return {
      fileId: response.data.id,
      name: response.data.name,
      size: parseInt(response.data.size || "0"),
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
      mimeType: response.data.mimeType,
      path: folderPath ? `${folderPath}/${fileName}` : fileName,
    };
  }

  /**
   * Obține URL pentru download
   */
  async getDownloadUrl(fileId) {
    await this.initialize();

    try {
      // Obține informații despre fișier
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: "webContentLink, mimeType",
      });

      // Pentru fișiere Google (Docs, Sheets, etc.), folosește export
      if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
        // Export ca PDF
        const response = await this.drive.files.export(
          {
            fileId: fileId,
            mimeType: "application/pdf",
          },
          { responseType: "stream" }
        );
        // Returnează stream-ul sau generează signed URL
        return null; // Va fi gestionat diferit
      }

      // Pentru fișiere normale, folosește webContentLink
      return file.data.webContentLink;
    } catch (error) {
      console.error("Error getting download URL:", error);
      throw error;
    }
  }

  /**
   * Șterge un fișier
   */
  async delete(fileId) {
    await this.initialize();

    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  /**
   * Verifică dacă un fișier există
   */
  async exists(fileId) {
    await this.initialize();

    try {
      await this.drive.files.get({
        fileId: fileId,
        fields: "id",
      });
      return true;
    } catch (error) {
      if (error.code === 404) {
        return false;
      }
      throw error;
    }
  }
}

module.exports = GoogleDriveStorage;

