/**
 * FileService - Business logic pentru gestionarea fișierelor
 * Folosește storage adapter pentru a fi independent de implementarea storage-ului
 */

const File = require("../models/File");
const Workplace = require("../models/Workplace");
const { createStorageAdapter } = require("../storage");
const fileConfig = require("../config/fileConfig");
const crypto = require("crypto");
const path = require("path");

class FileService {
  constructor() {
    // ✅ Storage adapter injectat (ușor de înlocuit)
    this.storage = createStorageAdapter();
  }

  /**
   * Calculează hash SHA256 pentru un buffer
   */
  calculateHash(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Validează un fișier
   */
  validateFile(file) {
    // Validare mărime
    if (file.size > fileConfig.maxFileSize) {
      throw new Error(
        `Fișierul depășește mărimea maximă de ${fileConfig.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Validare tip
    if (!fileConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Tipul de fișier ${file.mimetype} nu este permis`);
    }
  }

  /**
   * Generează path pentru storage
   * Structură: NumeFarmacie/An/Luna
   */
  async generateStoragePath(workplaceIds) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    // Dacă e pentru un singur workplace, folosim numele farmaciei
    if (workplaceIds && workplaceIds.length === 1) {
      try {
        const workplace = await Workplace.findById(workplaceIds[0]).lean();
        if (workplace) {
          // Folosim numele farmaciei (curățat de caractere speciale pentru path)
          const workplaceName = workplace.name
            .replace(/[^a-zA-Z0-9\s-]/g, "") // Elimină caractere speciale
            .replace(/\s+/g, " ") // Normalizează spațiile
            .trim();
          return `${workplaceName}/${year}/${month}`;
        }
      } catch (err) {
        console.error("Error getting workplace name:", err);
      }
      // Fallback la ID dacă nu găsim numele
      return `${workplaceIds[0]}/${year}/${month}`;
    } else if (workplaceIds && workplaceIds.length > 1) {
      // Pentru multiple workplaces, folosim folder "Global"
      return `Global/${year}/${month}`;
    } else {
      // Pentru toate farmaciile
      return `Global/${year}/${month}`;
    }
  }

  /**
   * Generează nume unic pentru fișier în storage
   */
  generateStorageFileName(originalName, hash) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    // Folosim hash pentru a evita duplicate și pentru deduplicare
    return `${hash}${ext}`;
  }

  /**
   * Upload un fișier
   */
  async upload(file, metadata) {
    const { workplaceIds, category, description, uploadedBy, uploadedByName } =
      metadata;

    // Validare
    this.validateFile(file);

    // Calculează hash
    const hash = this.calculateHash(file.buffer);

    // Verifică dacă fișierul există deja (deduplicare)
    const existingFile = await File.findOne({ hash, isActive: true });

    let storageFileId;
    let storagePath;
    let size;

    if (existingFile) {
      // Fișierul există deja - nu reîncarcă, doar creează referință
      console.log(`✅ File deduplication: Using existing file ${existingFile.storageFileId}`);
      storageFileId = existingFile.storageFileId;
      storagePath = existingFile.storagePath;
      size = existingFile.size;
    } else {
      // Upload nou
      const folderPath = await this.generateStoragePath(workplaceIds);
      const storageFileName = this.generateStorageFileName(file.originalname, hash);

      const uploadResult = await this.storage.upload(file.buffer, storageFileName, {
        folderPath,
        mimeType: file.mimetype,
      });

      storageFileId = uploadResult.fileId;
      storagePath = uploadResult.path;
      size = uploadResult.size;
    }

    // Salvare metadata în MongoDB
    const fileDoc = new File({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: size,
      hash: hash,
      storageType: fileConfig.storageType,
      storageFileId: storageFileId,
      storagePath: storagePath,
      workplaceId: workplaceIds && workplaceIds.length === 1 ? workplaceIds[0] : null,
      workplaceIds: workplaceIds || [],
      uploadedBy: uploadedBy,
      uploadedByName: uploadedByName,
      category: category || "other",
      description: description || "",
      isActive: true,
      isRead: false,
    });

    await fileDoc.save();

    return fileDoc;
  }

  /**
   * Obține fișiere pentru un workplace
   */
  async getFilesForWorkplace(workplaceId, filters = {}) {
    const { category, page = 1, limit = 20, unreadOnly = false } = filters;

    const baseQuery = {
      isActive: true,
      $or: [
        { workplaceIds: { $size: 0 } }, // Mesaje globale
        { workplaceId: workplaceId }, // Pentru workplace-ul specific
        { workplaceIds: workplaceId }, // În array-ul de workplace-uri
      ],
    };

    if (category) {
      baseQuery.category = category;
    }

    const skip = (page - 1) * limit;

    // Obține fișierele cu paginare
    const allFiles = await File.find(baseQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Marchează fiecare fișier dacă este citit pentru acest workplace
    const filesWithReadStatus = allFiles.map((file) => {
      // Verifică dacă fișierul a fost citit de către acest workplace
      const isReadForThisWorkplace = file.readBy?.some(
        (r) => r.workplaceId?.toString() === workplaceId?.toString()
      ) || false;

      // Pentru fișiere globale (fără workplaceIds), verifică isRead global
      const isGlobalFile = !file.workplaceIds || file.workplaceIds.length === 0;
      const isRead = isGlobalFile ? (file.isRead || false) : isReadForThisWorkplace;

      return {
        ...file,
        isRead,
      };
    });

    // Filtrează după unreadOnly dacă e necesar
    let filteredFiles = filesWithReadStatus;
    if (unreadOnly) {
      filteredFiles = filesWithReadStatus.filter((f) => !f.isRead);
    }

    // Paginare
    const total = filteredFiles.length;
    const files = filteredFiles.slice(skip, skip + limit);

    // Calculează unreadCount folosind aggregation pentru eficiență
    // Un fișier este necitit dacă:
    // 1. Este global (workplaceIds.length === 0) și isRead === false
    // 2. SAU este pentru acest workplace și nu este în readBy pentru acest workplace
    const unreadCountResult = await File.aggregate([
      { $match: baseQuery },
      {
        $addFields: {
          isReadForWorkplace: {
            $cond: [
              { $eq: [{ $size: { $ifNull: ["$workplaceIds", []] } }, 0] },
              "$isRead", // Pentru fișiere globale, folosește isRead
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ["$readBy", []] },
                        as: "read",
                        cond: {
                          $eq: [
                            { $toString: "$$read.workplaceId" },
                            { $toString: workplaceId }
                          ]
                        }
                      }
                    }
                  },
                  0
                ]
              }
            ]
          }
        }
      },
      { $match: { isReadForWorkplace: false } },
      { $count: "count" }
    ]);

    const unreadCount = unreadCountResult.length > 0 ? unreadCountResult[0].count : 0;

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  /**
   * Obține toate fișierele (pentru superadmin)
   */
  async getAllFiles(filters = {}) {
    const { workplaceId, category, page = 1, limit = 20 } = filters;

    const query = { isActive: true };

    if (workplaceId) {
      query.$or = [
        { workplaceId: workplaceId },
        { workplaceIds: workplaceId },
      ];
    }

    if (category) {
      query.category = category;
    }

    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      File.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("uploadedBy", "name")
        .populate("workplaceId", "name")
        .lean(),
      File.countDocuments(query),
    ]);

    return {
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Download un fișier
   */
  async download(fileId, userId, userRole, userWorkplaceId) {
    const fileDoc = await File.findById(fileId).lean();

    if (!fileDoc) {
      throw new Error("Fișierul nu a fost găsit");
    }

    if (!fileDoc.isActive) {
      throw new Error("Fișierul nu este disponibil");
    }

    // Verificare permisiuni
    if (userRole === "superadmin") {
      // Superadmin poate descărca orice fișier
    } else if (userRole === "admin") {
      // Admin poate descărca doar fișierele pentru farmacia sa
      const hasAccess =
        fileDoc.workplaceIds.length === 0 || // Global
        fileDoc.workplaceId?.toString() === userWorkplaceId?.toString() ||
        fileDoc.workplaceIds.some(
          (id) => id.toString() === userWorkplaceId?.toString()
        );

      if (!hasAccess) {
        throw new Error("Nu ai permisiune să descarci acest fișier");
      }
    } else {
      throw new Error("Nu ai permisiune să descarci fișiere");
    }

    // Obține stream pentru download (nu URL direct)
    const downloadStream = await this.storage.getDownloadStream(fileDoc.storageFileId);

    // Marchează ca citit (dacă e admin farmacie)
    if (userRole === "admin" && userWorkplaceId) {
      await this.markAsRead(fileId, userWorkplaceId, userId);
    }

    return {
      file: fileDoc,
      stream: downloadStream.stream,
      mimeType: downloadStream.mimeType,
      filename: downloadStream.filename || fileDoc.filename,
    };
  }

  /**
   * Marchează un fișier ca citit
   */
  async markAsRead(fileId, workplaceId, userId) {
    const fileDoc = await File.findById(fileId);

    if (!fileDoc) {
      throw new Error("Fișierul nu a fost găsit");
    }

    // Verifică dacă e deja marcat ca citit pentru acest workplace
    const alreadyRead = fileDoc.readBy.some(
      (r) => r.workplaceId?.toString() === workplaceId?.toString()
    );

    if (!alreadyRead) {
      fileDoc.readBy.push({
        workplaceId: workplaceId,
        readAt: new Date(),
        readBy: userId,
      });

      // Dacă toate workplace-urile au citit, marchează ca citit global
      if (fileDoc.workplaceIds.length > 0) {
        const allRead = fileDoc.workplaceIds.every((wpId) =>
          fileDoc.readBy.some(
            (r) => r.workplaceId?.toString() === wpId.toString()
          )
        );
        if (allRead) {
          fileDoc.isRead = true;
        }
      } else {
        // Pentru fișiere globale, marchează direct ca citit
        fileDoc.isRead = true;
      }

      await fileDoc.save();
    }

    return fileDoc;
  }

  /**
   * Șterge un fișier
   */
  async delete(fileId, userId, userRole) {
    if (userRole !== "superadmin") {
      throw new Error("Doar managerul poate șterge fișiere");
    }

    const fileDoc = await File.findById(fileId);

    if (!fileDoc) {
      throw new Error("Fișierul nu a fost găsit");
    }

    // Verifică dacă mai sunt alte referințe la același fișier
    const otherReferences = await File.countDocuments({
      storageFileId: fileDoc.storageFileId,
      isActive: true,
      _id: { $ne: fileId },
    });

    // Șterge din storage doar dacă nu mai sunt alte referințe
    if (otherReferences === 0) {
      await this.storage.delete(fileDoc.storageFileId);
    }

    // Șterge din MongoDB (soft delete)
    fileDoc.isActive = false;
    await fileDoc.save();

    return fileDoc;
  }

  /**
   * Șterge toate fișierele (doar superadmin)
   */
  async deleteAll(userId, userRole) {
    if (userRole !== "superadmin") {
      throw new Error("Doar managerul poate șterge toate fișierele");
    }

    // Obține toate fișierele active
    const allFiles = await File.find({ isActive: true }).lean();

    // Grupează după storageFileId pentru a șterge din storage doar o dată
    const uniqueStorageFiles = new Set();
    allFiles.forEach((file) => {
      if (file.storageFileId) {
        uniqueStorageFiles.add(file.storageFileId);
      }
    });

    // Șterge din storage toate fișierele unice
    for (const storageFileId of uniqueStorageFiles) {
      try {
        await this.storage.delete(storageFileId);
      } catch (err) {
        console.error(`Eroare la ștergerea fișierului din storage ${storageFileId}:`, err);
        // Continuă chiar dacă un fișier nu poate fi șters din storage
      }
    }

    // Șterge din MongoDB (soft delete) - marchează toate ca inactive
    const result = await File.updateMany(
      { isActive: true },
      { isActive: false }
    );

    return {
      deletedCount: result.modifiedCount,
      storageFilesDeleted: uniqueStorageFiles.size,
    };
  }

  /**
   * Obține statistici (pentru superadmin)
   */
  async getStats() {
    const [totalFiles, totalSize, byCategory, byWorkplace] = await Promise.all([
      File.countDocuments({ isActive: true }),
      File.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: "$size" } } },
      ]),
      File.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      File.aggregate([
        { $match: { isActive: true } },
        { $unwind: "$workplaceIds" },
        { $group: { _id: "$workplaceIds", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalFiles,
      totalSize: totalSize[0]?.total || 0,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byWorkplace: byWorkplace.length,
    };
  }
}

// Export singleton
module.exports = new FileService();


