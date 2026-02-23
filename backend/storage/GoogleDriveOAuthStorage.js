/**
 * GoogleDriveOAuthStorage - Implementare storage adapter pentru Google Drive folosind OAuth 2.0
 * Folosește OAuth 2.0 în loc de Service Account pentru a avea acces la storage quota
 */

const StorageAdapter = require("./StorageAdapter");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");
const fileConfig = require("../config/fileConfig");

class GoogleDriveOAuthStorage extends StorageAdapter {
  constructor() {
    super();
    this.initialized = false;
    this.rootFolderId = null;
    this.oAuth2Client = null;
  }

  /**
   * Inițializează conexiunea la Google Drive folosind OAuth 2.0
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Încarcă credențiale OAuth
      const credentialsPath = path.join(
        __dirname,
        "..",
        "google-drive-oauth-credentials.json"
      );

      if (!fs.existsSync(credentialsPath)) {
        throw new Error(
          `Google Drive OAuth credentials not found at: ${credentialsPath}\n` +
          "Te rugăm să creezi un OAuth 2.0 Client în Google Cloud Console și să salvezi credențialele."
        );
      }

      const credentials = JSON.parse(
        fs.readFileSync(credentialsPath, "utf8")
      );

      if (!credentials.installed && !credentials.web) {
        throw new Error(
          "Invalid OAuth credentials format. Trebuie să fie un OAuth 2.0 Client (installed sau web)."
        );
      }

      const clientConfig = credentials.installed || credentials.web;

      // Creează OAuth 2.0 client
      this.oAuth2Client = new google.auth.OAuth2(
        clientConfig.client_id,
        clientConfig.client_secret,
        clientConfig.redirect_uris?.[0] || "urn:ietf:wg:oauth:2.0:oob"
      );

      // Încarcă token-ul salvat
      const tokenPath = path.join(__dirname, "..", "google-drive-tokens.json");
      if (fs.existsSync(tokenPath)) {
        const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        this.oAuth2Client.setCredentials(tokens);

        // Verifică dacă token-ul este expirat și îl reînnoiește dacă e necesar
        if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
          if (tokens.refresh_token) {
            await this.oAuth2Client.refreshAccessToken();
            const newTokens = this.oAuth2Client.credentials;
            fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2));
          } else {
            throw new Error(
              "Token expirat și nu există refresh token. Te rugăm să obții un token nou."
            );
          }
        }
      } else {
        // Dacă nu există token, trebuie să obținem unul
        throw new Error(
          `Token OAuth nu a fost găsit la: ${tokenPath}\n` +
          "Te rugăm să rulezi scriptul de setup pentru a obține un token OAuth."
        );
      }

      // Creează Drive client
      this.drive = google.drive({ version: "v3", auth: this.oAuth2Client });

      // Obține sau creează root folder
      this.rootFolderId = await this.getOrCreateRootFolder();

      this.initialized = true;
      console.log("✅ Google Drive OAuth Storage initialized");
    } catch (error) {
      console.error("❌ Google Drive OAuth Storage initialization error:", error);
      throw error;
    }
  }

  /**
   * Obține sau creează root folder-ul pentru fișiere
   */
  async getOrCreateRootFolder() {
    if (!this.drive || !this.oAuth2Client) {
      throw new Error("Storage not initialized.");
    }

    // Caută folder-ul "RemediumFarm"
    const folders = await this.drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and name='RemediumFarm' and trashed=false",
      fields: "files(id, name)",
      spaces: "drive",
    });

    let remediumFolderId = null;

    if (folders.data.files.length > 0) {
      remediumFolderId = folders.data.files[0].id;
    } else {
      // Creează folder-ul "RemediumFarm" în root
      const remediumFolder = await this.drive.files.create({
        requestBody: {
          name: "RemediumFarm",
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });
      remediumFolderId = remediumFolder.data.id;
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
      // Creează folder-ul "Files"
      const filesFolder = await this.drive.files.create({
        requestBody: {
          name: "Files",
          mimeType: "application/vnd.google-apps.folder",
          parents: [remediumFolderId],
        },
        fields: "id",
      });
      return filesFolder.data.id;
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
        spaces: "drive",
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

    // Convertim Buffer-ul într-un stream
    const stream = Readable.from(fileBuffer);

    // Media (conținutul fișierului)
    const media = {
      mimeType: mimeType || "application/octet-stream",
      body: stream,
    };

    // Upload
    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, size, webViewLink, webContentLink, mimeType",
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
   * Returnează null - va fi folosit getDownloadStream în schimb
   */
  async getDownloadUrl(fileId) {
    // Nu folosim webContentLink direct - folosim getDownloadStream
    return null;
  }

  /**
   * Obține stream pentru download
   */
  async getDownloadStream(fileId) {
    await this.initialize();

    try {
      // Obține informații despre fișier
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: "mimeType, name",
      });

      // Pentru fișiere Google (Docs, Sheets, etc.), folosește export
      if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
        // Export ca PDF pentru fișiere Google
        const response = await this.drive.files.export(
          {
            fileId: fileId,
            mimeType: "application/pdf",
          },
          { responseType: "stream" }
        );
        return {
          stream: response.data,
          mimeType: "application/pdf",
          filename: file.data.name ? `${file.data.name}.pdf` : "export.pdf",
        };
      }

      // Pentru fișiere normale, descarcă direct
      const response = await this.drive.files.get(
        {
          fileId: fileId,
          alt: "media",
        },
        { responseType: "stream" }
      );

      return {
        stream: response.data,
        mimeType: file.data.mimeType || "application/octet-stream",
        filename: file.data.name || "file",
      };
    } catch (error) {
      console.error("Error getting download stream:", error);
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

module.exports = GoogleDriveOAuthStorage;

