/**
 * File Upload Middleware
 * Validare și rate limiting pentru upload-uri
 */

const multer = require("multer");
const fileConfig = require("../config/fileConfig");

// Configurare multer (memory storage pentru a putea calcula hash)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Validare tip fișier
  if (fileConfig.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Tipul de fișier ${file.mimetype} nu este permis. Tipuri permise: ${fileConfig.allowedMimeTypes.join(", ")}`
      ),
      false
    );
  }
};

// Configurare multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: fileConfig.maxFileSize,
    files: 1, // Un singur fișier per request
  },
});

// Rate limiting simplu (în memorie - pentru production folosește Redis)
const uploadAttempts = new Map();

const rateLimitMiddleware = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Neautorizat" });
  }

  const now = Date.now();
  const userAttempts = uploadAttempts.get(userId) || { count: 0, resetAt: now + 60000 };

  // Reset dacă a trecut 1 minut
  if (now > userAttempts.resetAt) {
    userAttempts.count = 0;
    userAttempts.resetAt = now + 60000;
  }

  // Verifică limită
  if (userAttempts.count >= fileConfig.maxFilesPerMinute) {
    return res.status(429).json({
      error: `Ai depășit limita de ${fileConfig.maxFilesPerMinute} fișiere/minut`,
    });
  }

  // Incrementare
  userAttempts.count++;
  uploadAttempts.set(userId, userAttempts);

  next();
};

module.exports = {
  upload: upload.single("file"),
  rateLimit: rateLimitMiddleware,
};


