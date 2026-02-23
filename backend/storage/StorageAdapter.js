/**
 * StorageAdapter - Abstract class pentru storage adapters
 * Toate implementările trebuie să extindă această clasă
 * 
 * Acest pattern permite schimbarea ușoară a storage-ului
 * (ex: de la Google Drive la S3) fără să modifici restul codului
 */

class StorageAdapter {
  /**
   * Upload un fișier la storage
   * @param {Buffer} fileBuffer - Buffer-ul fișierului
   * @param {String} fileName - Numele fișierului
   * @param {Object} options - Opțiuni (folderPath, metadata, etc.)
   * @returns {Promise<{fileId: String, path: String, size: Number}>}
   */
  async upload(fileBuffer, fileName, options = {}) {
    throw new Error("Method 'upload' must be implemented");
  }

  /**
   * Obține URL pentru download
   * @param {String} fileId - ID-ul fișierului în storage
   * @returns {Promise<String>} - URL pentru download
   */
  async getDownloadUrl(fileId) {
    throw new Error("Method 'getDownloadUrl' must be implemented");
  }

  /**
   * Obține stream pentru download (opțional, pentru storage-uri care suportă)
   * @param {String} fileId - ID-ul fișierului în storage
   * @returns {Promise<{stream: Stream, mimeType: String, filename: String}>}
   */
  async getDownloadStream(fileId) {
    throw new Error("Method 'getDownloadStream' must be implemented");
  }

  /**
   * Șterge un fișier din storage
   * @param {String} fileId - ID-ul fișierului
   * @returns {Promise<void>}
   */
  async delete(fileId) {
    throw new Error("Method 'delete' must be implemented");
  }

  /**
   * Verifică dacă un fișier există
   * @param {String} fileId - ID-ul fișierului
   * @returns {Promise<Boolean>}
   */
  async exists(fileId) {
    throw new Error("Method 'exists' must be implemented");
  }

  /**
   * Obține sau creează un folder
   * @param {String} folderPath - Path-ul folderului
   * @returns {Promise<String>} - ID-ul folderului
   */
  async getOrCreateFolder(folderPath) {
    throw new Error("Method 'getOrCreateFolder' must be implemented");
  }
}

module.exports = StorageAdapter;


