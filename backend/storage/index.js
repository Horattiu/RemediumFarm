/**
 * Storage Factory
 * Creează storage adapter-ul corect în funcție de configurație
 * 
 * Pentru a schimba storage-ul, modifică doar FILE_STORAGE_TYPE în .env
 */

const fileConfig = require("../config/fileConfig");
// Folosim OAuth în loc de Service Account pentru a avea storage quota
const GoogleDriveOAuthStorage = require("./GoogleDriveOAuthStorage");
// const LocalStorage = require("./LocalStorage"); // Pentru viitor

function createStorageAdapter() {
  const storageType = fileConfig.storageType;

  switch (storageType) {
    case "googledrive":
      return new GoogleDriveOAuthStorage();

    case "local":
      // return new LocalStorage(); // Pentru development
      throw new Error("Local storage not yet implemented");

    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}

module.exports = {
  createStorageAdapter,
  StorageAdapter: require("./StorageAdapter"),
};


