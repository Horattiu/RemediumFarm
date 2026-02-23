/**
 * File Routes
 * Toate rutele pentru feature-ul de fișiere
 * 
 * Poate fi dezactivat prin ENABLE_FILE_FEATURE=false în .env
 */

const express = require("express");
const router = express.Router();
const fileService = require("../services/fileService");
const { auth } = require("../authmiddleware");
const { upload, rateLimit } = require("../middleware/fileUpload");
const logger = require("../logger");
const User = require("../models/User");
const Workplace = require("../models/Workplace");

/**
 * POST /api/files/upload
 * Upload un fișier (doar superadmin)
 */
router.post("/upload", auth, rateLimit, upload, async (req, res) => {
  try {
    // Verifică dacă este superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate încărca fișiere" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nu a fost selectat niciun fișier" });
    }

    const { workplaceIds, category, description } = req.body;

    // Parse workplaceIds (poate fi string sau array)
    let targetWorkplaceIds = [];
    if (workplaceIds) {
      if (Array.isArray(workplaceIds)) {
        targetWorkplaceIds = workplaceIds;
      } else if (typeof workplaceIds === "string") {
        try {
          const parsed = JSON.parse(workplaceIds);
          targetWorkplaceIds = Array.isArray(parsed) ? parsed : [];
        } catch {
          targetWorkplaceIds = workplaceIds ? [workplaceIds] : [];
        }
      }
    }

    // Obține numele utilizatorului
    const user = await User.findById(req.user.id).select("name").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    // Upload
    const fileDoc = await fileService.upload(req.file, {
      workplaceIds: targetWorkplaceIds,
      category: category || "other",
      description: description || "",
      uploadedBy: req.user.id,
      uploadedByName: user.name,
    });

    logger.info("File uploaded", {
      fileId: fileDoc._id,
      filename: fileDoc.filename,
      uploadedBy: req.user.id,
      workplaceCount: targetWorkplaceIds.length,
    });

    res.status(201).json(fileDoc);
  } catch (err) {
    console.error("❌ FILE UPLOAD ERROR:", err);
    logger.error("File upload error", err, { userId: req.user?.id });
    res.status(500).json({ error: err.message || "Eroare la încărcarea fișierului" });
  }
});

/**
 * GET /api/files
 * Obține fișiere (filtrare după rol)
 */
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role workplaceId").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    const { category, page, limit, unreadOnly } = req.query;

    let result;

    if (user.role === "superadmin") {
      // Superadmin vede toate fișierele
      result = await fileService.getAllFiles({
        workplaceId: req.query.workplaceId,
        category,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });
    } else if (user.role === "admin") {
      // Admin vede doar fișierele pentru farmacia sa
      const userWorkplaceId = user.workplaceId?._id || user.workplaceId;
      if (!userWorkplaceId) {
        return res.status(400).json({ error: "Nu ai o farmacie asociată" });
      }

      result = await fileService.getFilesForWorkplace(userWorkplaceId, {
        category,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        unreadOnly: unreadOnly === "true",
      });
    } else {
      return res.status(403).json({ error: "Nu ai permisiune să accesezi fișiere" });
    }

    res.json(result);
  } catch (err) {
    console.error("❌ GET FILES ERROR:", err);
    logger.error("Get files error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare la încărcarea fișierelor" });
  }
});

/**
 * GET /api/files/:id/download
 * Download un fișier
 */
router.get("/:id/download", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role workplaceId").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    const userWorkplaceId = user.workplaceId?._id || user.workplaceId;

    const { file, stream, mimeType, filename } = await fileService.download(
      req.params.id,
      req.user.id,
      user.role,
      userWorkplaceId
    );

    if (!stream) {
      return res.status(500).json({ error: "Nu s-a putut obține stream-ul de download" });
    }

    // Setează header-urile pentru download
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename || file.filename)}"`);
    res.setHeader("Content-Type", mimeType || file.mimeType || "application/octet-stream");

    // Pipe stream-ul către response
    stream.on("error", (err) => {
      console.error("Error streaming file:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Eroare la descărcarea fișierului" });
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("❌ FILE DOWNLOAD ERROR:", err);
    logger.error("File download error", err, { userId: req.user?.id, fileId: req.params.id });
    res.status(500).json({ error: err.message || "Eroare la descărcarea fișierului" });
  }
});

/**
 * POST /api/files/:id/read
 * Marchează un fișier ca citit
 */
router.post("/:id/read", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role workplaceId").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Doar adminii farmaciilor pot marca fișiere ca citite" });
    }

    const userWorkplaceId = user.workplaceId?._id || user.workplaceId;
    if (!userWorkplaceId) {
      return res.status(400).json({ error: "Nu ai o farmacie asociată" });
    }

    const fileDoc = await fileService.markAsRead(req.params.id, userWorkplaceId, req.user.id);

    res.json(fileDoc);
  } catch (err) {
    console.error("❌ MARK AS READ ERROR:", err);
    logger.error("Mark as read error", err, { userId: req.user?.id, fileId: req.params.id });
    res.status(500).json({ error: err.message || "Eroare la marcarea ca citit" });
  }
});

/**
 * DELETE /api/files
 * Șterge toate fișierele (doar superadmin)
 */
router.delete("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    if (user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate șterge toate fișierele" });
    }

    const result = await fileService.deleteAll(req.user.id, user.role);

    logger.info("All files deleted", {
      deletedCount: result.deletedCount,
      storageFilesDeleted: result.storageFilesDeleted,
      deletedBy: req.user.id,
    });

    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      storageFilesDeleted: result.storageFilesDeleted,
    });
  } catch (err) {
    console.error("❌ DELETE ALL FILES ERROR:", err);
    logger.error("Delete all files error", err, { userId: req.user?.id });
    res.status(500).json({ error: err.message || "Eroare la ștergerea tuturor fișierelor" });
  }
});

/**
 * DELETE /api/files/:id
 * Șterge un fișier (doar superadmin)
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    const fileDoc = await fileService.delete(req.params.id, req.user.id, user.role);

    logger.info("File deleted", {
      fileId: req.params.id,
      deletedBy: req.user.id,
    });

    res.json({ success: true, file: fileDoc });
  } catch (err) {
    console.error("❌ FILE DELETE ERROR:", err);
    logger.error("File delete error", err, { userId: req.user?.id, fileId: req.params.id });
    res.status(500).json({ error: err.message || "Eroare la ștergerea fișierului" });
  }
});

/**
 * GET /api/files/stats
 * Statistici (doar superadmin)
 */
router.get("/stats", auth, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate vedea statistici" });
    }

    const stats = await fileService.getStats();
    res.json(stats);
  } catch (err) {
    console.error("❌ GET STATS ERROR:", err);
    logger.error("Get stats error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare la încărcarea statisticilor" });
  }
});

module.exports = router;


