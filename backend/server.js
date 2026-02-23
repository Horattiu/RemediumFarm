

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const emailjs = require("@emailjs/nodejs");
require("dotenv").config();

// MODELE
const User = require("./models/User");
const Employee = require("./models/Employee"); // ✅ NOU: Model pentru angajați
const Workplace = require("./models/Workplace");
const Leave = require("./models/Leave");
// const Pontaj = require("./models/Pontaj"); // ✅ ȘTERS: colecția nu mai este folosită
const Timesheet = require("./models/Timesheet"); // ✅ NOU: structură employee-centric
const MonthlySchedule = require("./models/MonthlySchedule"); // ✅ Planificare lunară
// const RosterDay = require("./models/RoasterDay"); // ✅ ȘTERS: colecția nu mai este folosită
const PDFTemplate = require("./models/PDFTemplate"); // ✅ Template-uri PDF pentru cereri de concediu
const Announcement = require("./models/Announcement"); // ✅ Mesaje/anunțuri manager
const File = require("./models/File"); // ✅ Fișiere manager → admini farmacii

// Middleware auth (dacă îl ai)
const { auth } = require("./authmiddleware");

// Logger pentru file logging local
const logger = require("./logger");

// Email service pentru notificări
const { sendLeaveRequestNotification } = require("./utils/emailService");

// Helper pentru a obține informații despre utilizator pentru loguri
const getUserInfoForLog = async (req) => {
  const logInfo = {};
  
  if (req.user?.id) {
    try {
      const user = await User.findById(req.user.id).select('name role').lean();
      if (user) {
        logInfo.userName = user.name;
        logInfo.userRole = user.role;
      }
    } catch (err) {
      // Ignorăm erorile - nu vrem să blocăm logarea
    }
  }
  
  return logInfo;
};

// Helper pentru a obține numele farmaciei
const getWorkplaceName = async (workplaceId) => {
  if (!workplaceId) return null;
  try {
    const workplace = await Workplace.findById(workplaceId).select('name').lean();
    return workplace?.name || null;
  } catch {
    return null;
  }
};

// Helper pentru a obține numele angajatului
const getEmployeeName = async (employeeId) => {
  if (!employeeId) return null;
  try {
    const employee = await Employee.findById(employeeId).select('name').lean();
    return employee?.name || null;
  } catch {
    return null;
  }
};

const app = express();

/* ==========================
   MIDDLEWARE GLOBAL
   ========================== */
app.use(
  cors({
    origin: function (origin, callback) {
      // Lista de origins permise
      const allowedOrigins = [
        "http://localhost:5173", // Vite dev server
        "http://localhost:3000", // Alternative dev port
        "https://resplendent-biscuit-887578.netlify.app", // Netlify production (subdomain)
        "http://myremediumfarm.ro", // Domeniu personalizat (HTTP - temporar până la SSL)
        "https://myremediumfarm.ro", // Domeniu personalizat (HTTPS - după activarea SSL)
      ];
      
      // Permite requests fără origin (Postman, curl, etc.) - doar pentru development
      if (!origin) {
        return callback(null, true);
      }
      
      // Normalizează origin-ul (elimină slash-ul final dacă există)
      const normalizedOrigin = origin.replace(/\/$/, "");
      
      // ✅ Permite orice origin de pe Railway (HTTPS automat)
      if (normalizedOrigin.includes(".up.railway.app") || normalizedOrigin.includes("railway.app")) {
        return callback(null, normalizedOrigin);
      }
      
      // Verifică dacă origin-ul normalizat este în lista de origins permise
      const isAllowed = allowedOrigins.some(allowed => {
        const normalizedAllowed = allowed.replace(/\/$/, "");
        return normalizedOrigin === normalizedAllowed;
      });
      
      if (isAllowed) {
        // Returnează origin-ul normalizat (fără slash final) pentru a evita problemele CORS
        callback(null, normalizedOrigin);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin} (normalized: ${normalizedOrigin})`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5000;

/* ==========================
   CONNECT MONGODB
   ========================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    logger.info("MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    logger.error("MongoDB connection failed", err);
  });

/* ==========================
   HELPERS (DATE SAFE)
   ========================== */
const parseLocalDayStart = (yyyyMmDd) => {
  // ✅ CRITIC: Creează dată în UTC pentru a evita problemele cu timezone
  // Parsează manual anul, luna, ziua și creează dată în UTC
  // Astfel MongoDB o salvează corect și nu se schimbă ziua
  const [year, month, day] = yyyyMmDd.split('-').map(Number);
  // ✅ Creează dată în UTC (month este 0-indexed în JavaScript)
  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return d;
};

// Helper pentru verificarea suprapunerii între două intervale de date
const datesOverlap = (start1, end1, start2, end2) => {
  // Normalizează datele
  const s1 = new Date(start1);
  s1.setHours(0, 0, 0, 0);
  const e1 = new Date(end1);
  e1.setHours(23, 59, 59, 999);
  const s2 = new Date(start2);
  s2.setHours(0, 0, 0, 0);
  const e2 = new Date(end2);
  e2.setHours(23, 59, 59, 999);
  
  // Două intervale se suprapun dacă:
  // - start1 <= end2 AND start2 <= end1
  return s1 <= e2 && s2 <= e1;
};

// Helper pentru a verifica suprapuneri de concedii pentru un angajat
const checkLeaveOverlaps = async (employeeId, startDate, endDate, excludeLeaveId = null) => {
  const startDateNorm = new Date(startDate);
  startDateNorm.setHours(0, 0, 0, 0);
  const endDateNorm = new Date(endDate);
  endDateNorm.setHours(23, 59, 59, 999);
  
  // Găsește toate concediile aprobate ale angajatului
  const query = {
    employeeId: employeeId,
    status: "Aprobată",
  };
  
  // Exclude cererea curentă dacă este editare
  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }
  
  // Obține toate concediile aprobate ale angajatului
  const allLeaves = await Leave.find(query)
    .select("_id startDate endDate type days status")
    .lean();
  
  // Verifică manual suprapunerile folosind funcția datesOverlap
  const overlappingLeaves = allLeaves.filter(leave => {
    const leaveStart = new Date(leave.startDate);
    leaveStart.setHours(0, 0, 0, 0);
    const leaveEnd = new Date(leave.endDate);
    leaveEnd.setHours(23, 59, 59, 999);
    
    return datesOverlap(startDateNorm, endDateNorm, leaveStart, leaveEnd);
  });
  
  return overlappingLeaves;
};

const parseLocalDayEnd = (yyyyMmDd) => {
  // ✅ CRITIC: Creează dată în UTC pentru a evita problemele cu timezone
  // Parsează manual anul, luna, ziua și creează dată în UTC
  // Astfel MongoDB o salvează corect și nu se schimbă ziua
  const [year, month, day] = yyyyMmDd.split('-').map(Number);
  // ✅ Creează dată în UTC (month este 0-indexed în JavaScript)
  const d = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return d;
};

const normalizeYMD = (s) => String(s || "").slice(0, 10);

/* ==========================
   AUTH - LOGIN
   ========================== */
app.post("/api/login", async (req, res) => {
  try {
    const { name, password } = req.body;

    const user = await User.findOne({ name, isActive: true }).populate(
      "workplaceId",
      "name"
    );

    if (!user) return res.status(401).json({ error: "Utilizator inexistent" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Parolă greșită" });

    const payload = {
      id: user._id,
      role: user.role,
      workplaceId: user.workplaceId?._id || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    // Detectează dacă request-ul vine de pe HTTPS (Railway/Netlify) sau HTTP (localhost)
    const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: isHttps ? "none" : "lax", // "none" pentru cross-origin HTTPS, "lax" pentru localhost
        secure: isHttps, // true pentru HTTPS, false pentru localhost
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({ message: "Login ok", user });
    
    // Log login cu succes
    logger.info("User logged in", {
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      workplaceId: user.workplaceId?._id || user.workplaceId,
      workplaceName: user.workplaceId?.name || null
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    logger.error("Login error", err, { name: req.body.name });
    res.status(500).json({ error: "Eroare server" });
  }
});

/* ==========================
   WORKPLACES
   ========================== */
app.post("/api/workplaces", async (req, res) => {
  try {
    const workplace = new Workplace(req.body);
    await workplace.save();
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    
    logger.info("Workplace created", { 
      workplaceId: workplace._id, 
      workplaceName: workplace.name,
      ...userInfo
    });
    res.status(201).json(workplace);
  } catch (err) {
    console.error("❌ CREATE WORKPLACE ERROR:", err.message);
    logger.error("Create workplace error", err);
    res.status(500).json({ error: "Eroare creare farmacie" });
  }
});

app.get("/api/workplaces", async (req, res) => {
  try {
    const workplaces = await Workplace.find({ isActive: true }).sort({
      name: 1,
    });
    
    // ✅ Sortează manual: "Online" primul, "Remedium Depozit" ultimul
    const sortedWorkplaces = workplaces.sort((a, b) => {
      const nameA = a.name;
      const nameB = b.name;
      
      // "Online" este întotdeauna primul
      if (nameA === "Online") return -1;
      if (nameB === "Online") return 1;
      
      // "Remedium Depozit" este întotdeauna ultimul
      if (nameA === "Remedium Depozit") return 1;
      if (nameB === "Remedium Depozit") return -1;
      
      // Restul se sortează alfabetic
      return nameA.localeCompare(nameB, "ro");
    });
    
    res.json(sortedWorkplaces);
  } catch (err) {
    console.error("❌ GET WORKPLACES ERROR:", err.message);
    logger.error("Get workplaces error", err);
    res.status(500).json({ error: "Eroare încărcare farmacii" });
  }
});

app.get("/api/workplaces/all", async (req, res) => {
  const workplaces = await Workplace.find({}, "_id name isActive").lean();
  
  // ✅ Sortează manual: "Online" primul, "Remedium Depozit" ultimul
  const sortedWorkplaces = workplaces.sort((a, b) => {
    const nameA = a.name;
    const nameB = b.name;
    
    // "Online" este întotdeauna primul
    if (nameA === "Online") return -1;
    if (nameB === "Online") return 1;
    
    // "Remedium Depozit" este întotdeauna ultimul
    if (nameA === "Remedium Depozit") return 1;
    if (nameB === "Remedium Depozit") return -1;
    
    // Restul se sortează alfabetic
    return nameA.localeCompare(nameB, "ro");
  });
  
  res.json(sortedWorkplaces);
});

app.put("/api/workplaces/:id", async (req, res) => {
  try {
    const updated = await Workplace.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const workplace = await Workplace.findById(req.params.id).select('name').lean();
    
    logger.info("Workplace updated", { 
      workplaceId: req.params.id,
      workplaceName: workplace?.name || null,
      ...userInfo
    });
    res.json(updated);
  } catch (err) {
    console.error("❌ UPDATE WORKPLACE ERROR:", err.message);
    logger.error("Update workplace error", err, { workplaceId: req.params.id });
    res.status(500).json({ error: "Eroare update farmacie" });
  }
});

// ✅ ȘTERS: Endpoint-urile pentru RosterDay nu mai sunt folosite
// // GET roster-day: /api/roster-day/:workplaceId/:date  (date = YYYY-MM-DD)
// app.get("/api/roster-day/:workplaceId/:date", async (req, res) => {
//   try {
//     const workplaceId = req.params.workplaceId;
//     const date = normalizeYMD(req.params.date);

//     const doc = await RosterDay.findOne({ workplaceId, date }).lean();

//     res.json({
//       workplaceId,
//       date,
//       visitorIds: doc?.visitorIds || [],
//     });
//   } catch (err) {
//     console.error("❌ GET ROSTER-DAY ERROR:", err);
//     res.status(500).json({ error: "Eroare roster-day" });
//   }
// });

// // PUT roster-day (upsert): body { visitorIds: [...] }
// app.put("/api/roster-day/:workplaceId/:date", async (req, res) => {
//   try {
//     const workplaceId = req.params.workplaceId;
//     const date = normalizeYMD(req.params.date);

//     const visitorIds = Array.isArray(req.body.visitorIds)
//       ? req.body.visitorIds
//       : [];

//     const updated = await RosterDay.findOneAndUpdate(
//       { workplaceId, date },
//       { $set: { workplaceId, date, visitorIds } },
//       { new: true, upsert: true }
//     ).lean();

//     res.json(updated);
//   } catch (err) {
//     console.error("❌ PUT ROSTER-DAY ERROR:", err);
//     res.status(500).json({ error: "Eroare salvare roster-day" });
//   }
// });

// POST /api/users/by-ids  body: { ids: [...] } - Folosește Employee
app.post("/api/users/by-ids", async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.json([]);

    // ✅ Folosim Employee în loc de User
    const employees = await Employee.find({
      _id: { $in: ids },
      isActive: true,
    })
      .select("_id name email function workplaceId monthlyTargetHours")
      .lean();

    res.json(employees);
  } catch (err) {
    console.error("❌ EMPLOYEES BY IDS ERROR:", err);
    res.status(500).json({ error: "Eroare employees by ids" });
  }
});

app.delete("/api/workplaces/:id", async (req, res) => {
  try {
    await Workplace.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Farmacie dezactivată" });
  } catch (err) {
    console.error("❌ DELETE WORKPLACE ERROR:", err.message);
    res.status(500).json({ error: "Eroare ștergere farmacie" });
  }
});

/* ==========================
   USERS
   ========================== */
app.post("/api/users", async (req, res) => {
  try {
    console.log("📝 CREATE USER REQUEST:", {
      name: req.body.name,
      email: req.body.email,
      hasEmail: !!req.body.email,
      emailTrimmed: req.body.email?.trim(),
      function: req.body.function,
      workplaceId: req.body.workplaceId,
      monthlyTargetHours: req.body.monthlyTargetHours,
    });

    // Validare câmpuri obligatorii
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ error: "Numele este obligatoriu" });
    }

    if (!req.body.workplaceId) {
      return res.status(400).json({ error: "Farmacia este obligatorie" });
    }

    // ✅ Employee nu are password (doar User pentru autentificare)
    // ✅ Convertim workplaceId la ObjectId pentru salvare corectă
    let workplaceObjectId;
    try {
      workplaceObjectId = new mongoose.Types.ObjectId(req.body.workplaceId);
    } catch (err) {
      return res.status(400).json({ error: "ID farmacie invalid" });
    }

    const employeeData = {
      name: req.body.name.trim(),
      function: req.body.function || "",
      workplaceId: workplaceObjectId, // ✅ Folosim ObjectId
      isActive: true,
      monthlyTargetHours:
        typeof req.body.monthlyTargetHours === "number"
          ? req.body.monthlyTargetHours
          : Number(req.body.monthlyTargetHours ?? 160),
    };

    // Adaugă email doar dacă este furnizat și nu este gol
    if (req.body.email && req.body.email.trim()) {
      employeeData.email = req.body.email.trim();
      console.log("✅ Email adăugat:", employeeData.email);
    } else {
      console.log("ℹ️ Email nu este furnizat sau este gol, se va crea fără email");
    }

    console.log("📦 EMPLOYEE DATA PRE-SAVE:", {
      name: employeeData.name,
      hasEmail: !!employeeData.email,
      email: employeeData.email || "null",
      function: employeeData.function,
      workplaceId: String(employeeData.workplaceId),
      workplaceIdRaw: req.body.workplaceId,
    });

    const employee = new Employee(employeeData);

    const saved = await employee.save();
    console.log("✅ EMPLOYEE CREAT CU SUCCES:", {
      _id: saved._id,
      name: saved.name,
      email: saved.email || "null",
    });
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const workplaceName = await getWorkplaceName(saved.workplaceId);
    
    logger.info("Employee created", { 
      employeeId: saved._id, 
      employeeName: saved.name,
      workplaceId: saved.workplaceId,
      workplaceName: workplaceName,
      ...userInfo
    });
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ CREATE EMPLOYEE ERROR:", {
      message: err.message,
      code: err.code,
      name: err.name,
      errors: err.errors,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue,
      stack: err.stack,
      requestBody: {
        name: req.body.name,
        email: req.body.email,
        workplaceId: req.body.workplaceId,
      }
    });
    logger.error("Create employee error", err, { 
      name: req.body.name,
      email: req.body.email,
      workplaceId: req.body.workplaceId,
    });
    
    // Verifică erori de validare Mongoose
    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors || {})[0];
      return res.status(400).json({ 
        error: firstError?.message || "Date invalide pentru crearea utilizatorului"
      });
    }
    
    res.status(500).json({ 
      error: "Eroare creare angajat", 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ✅ Endpoint pentru obținere preferință notificări email
app.get("/api/users/email-notifications", auth, async (req, res) => {
  try {
    const userId = req.user.id; // User-ul logat din token
    
    const user = await User.findById(userId).select("emailNotificationsEnabled").lean();
    
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }
    
    // Returnează valoarea exactă din DB (true, false, sau undefined pentru default true)
    // Frontend-ul va trata undefined ca true (default)
    const emailNotificationsEnabled = user.emailNotificationsEnabled === true;
    
    console.log("📥 GET EMAIL NOTIFICATIONS:", {
      userId: String(userId),
      emailNotificationsEnabledFromDB: user.emailNotificationsEnabled,
      emailNotificationsEnabledReturned: emailNotificationsEnabled,
    });
    
    res.json({ 
      emailNotificationsEnabled: emailNotificationsEnabled
    });
  } catch (err) {
    console.error("❌ GET EMAIL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Eroare obținere preferință email" });
  }
});

// ✅ Endpoint pentru actualizare preferință notificări email
app.put("/api/users/email-notifications", auth, async (req, res) => {
  try {
    const userId = req.user.id; // User-ul logat din token
    const emailNotificationsEnabled = req.body.emailNotificationsEnabled === true;
    
    console.log("═══════════════════════════════════════");
    console.log("📝 UPDATE EMAIL NOTIFICATIONS:");
    console.log("   User ID din token:", userId);
    console.log("   User ID type:", typeof userId);
    console.log("   Request body emailNotificationsEnabled:", req.body.emailNotificationsEnabled);
    console.log("   Setting to (strict boolean):", emailNotificationsEnabled);
    
    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { emailNotificationsEnabled } },
      { new: true }
    ).select("_id name emailNotificationsEnabled");
    
    if (!updated) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }
    
    console.log("✅ Email notifications preference updated:", {
      userId: String(updated._id),
      userName: updated.name,
      emailNotificationsEnabled: updated.emailNotificationsEnabled,
      type: typeof updated.emailNotificationsEnabled,
    });
    console.log("═══════════════════════════════════════");
    
    res.json({ 
      success: true, 
      emailNotificationsEnabled: updated.emailNotificationsEnabled === true
    });
  } catch (err) {
    console.error("❌ UPDATE EMAIL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Eroare actualizare preferință email" });
  }
});

// ✅ Endpoint pentru obținere template PDF (pentru cereri de concediu)
app.get("/api/pdf-template", auth, async (req, res) => {
  try {
    // Găsește template-ul activ (cel mai recent)
    const template = await PDFTemplate.findOne()
      .sort({ updatedAt: -1 })
      .lean();
    
    if (!template) {
      // Dacă nu există template în DB, returnează null
      return res.json({ template: null });
    }
    
    // Convertește Map-ul fields în obiect JSON
    const fieldsObj = {};
    if (template.fields && template.fields instanceof Map) {
      template.fields.forEach((value, key) => {
        fieldsObj[key] = value;
      });
    } else if (template.fields && typeof template.fields === 'object') {
      // Dacă este deja obiect (din lean())
      Object.assign(fieldsObj, template.fields);
    }
    
    res.json({
      template: {
        version: template.version,
        pageHeight: template.pageHeight,
        fields: fieldsObj,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (err) {
    console.error("❌ GET PDF TEMPLATE ERROR:", err);
    res.status(500).json({ error: "Eroare obținere template PDF" });
  }
});

// ✅ Endpoint pentru salvare/actualizare template PDF
app.put("/api/pdf-template", auth, async (req, res) => {
  try {
    const { version, pageHeight, fields } = req.body;
    
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: "Câmpurile template-ului sunt obligatorii" });
    }
    
    console.log("═══════════════════════════════════════");
    console.log("📝 UPDATE PDF TEMPLATE:");
    console.log("   Version:", version);
    console.log("   PageHeight:", pageHeight);
    console.log("   Fields count:", Object.keys(fields).length);
    
    // Găsește template-ul existent sau creează unul nou
    let template = await PDFTemplate.findOne().sort({ updatedAt: -1 });
    
    if (template) {
      // Actualizează template-ul existent
      template.version = version || template.version;
      template.pageHeight = pageHeight || template.pageHeight;
      template.fields = new Map(Object.entries(fields));
      template.updatedAt = new Date();
      await template.save();
    } else {
      // Creează template nou
      template = new PDFTemplate({
        version: version || "2.0",
        pageHeight: pageHeight || 841.89,
        fields: new Map(Object.entries(fields)),
      });
      await template.save();
    }
    
    // Convertește Map-ul fields în obiect JSON pentru răspuns
    const fieldsObj = {};
    template.fields.forEach((value, key) => {
      fieldsObj[key] = value;
    });
    
    console.log("✅ PDF Template salvat cu succes:", {
      templateId: String(template._id),
      version: template.version,
      fieldsCount: Object.keys(fieldsObj).length,
    });
    console.log("═══════════════════════════════════════");
    
    res.json({
      success: true,
      template: {
        version: template.version,
        pageHeight: template.pageHeight,
        fields: fieldsObj,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (err) {
    console.error("❌ UPDATE PDF TEMPLATE ERROR:", err);
    res.status(500).json({ error: "Eroare actualizare template PDF" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      function: req.body.function,
      monthlyTargetHours:
        req.body.monthlyTargetHours !== undefined
          ? Number(req.body.monthlyTargetHours)
          : undefined,
    };

    // ✅ Convertim workplaceId la ObjectId dacă este furnizat
    if (req.body.workplaceId) {
      try {
        updateData.workplaceId = new mongoose.Types.ObjectId(req.body.workplaceId);
      } catch (err) {
        return res.status(400).json({ error: "ID farmacie invalid" });
      }
    }

    // Adaugă email doar dacă este furnizat și nu este gol
    if (req.body.email !== undefined) {
      if (req.body.email && req.body.email.trim()) {
        updateData.email = req.body.email.trim();
      } else {
        // Dacă email-ul este string gol, îl setăm la null
        updateData.email = null;
      }
    }

    Object.keys(updateData).forEach(
      (k) => updateData[k] === undefined && delete updateData[k]
    );

    // ✅ Employee nu are password (doar User pentru autentificare)

    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).populate("workplaceId", "name");

    if (!updated) {
      return res.status(404).json({ error: "Angajatul nu a fost găsit" });
    }

    console.log("✅ EMPLOYEE UPDATED:", {
      _id: String(updated._id),
      name: updated.name,
      workplaceId: String(updated.workplaceId?._id || updated.workplaceId),
    });
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logWorkplaceName = updated.workplaceId?.name || await getWorkplaceName(updated.workplaceId?._id || updated.workplaceId);
    
    logger.info("Employee updated", { 
      employeeId: updated._id, 
      employeeName: updated.name,
      workplaceId: updated.workplaceId?._id || updated.workplaceId,
      workplaceName: logWorkplaceName,
      ...userInfo
    });
    res.json(updated);
  } catch (err) {
    console.error("❌ UPDATE EMPLOYEE ERROR:", {
      message: err.message,
      code: err.code,
      name: err.name,
      errors: err.errors,
    });
    logger.error("Update employee error", err, { employeeId: req.params.id });
    
    // Verifică erori de validare Mongoose
    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors || {})[0];
      return res.status(400).json({ 
        error: firstError?.message || "Date invalide pentru actualizarea utilizatorului"
      });
    }
    
    res.status(500).json({ 
      error: "Eroare update angajat",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// ✅ DELETE EMPLOYEE - Folosește Employee, nu User
app.delete("/api/users/:id", async (req, res) => {
  try {
    const employeeId = req.params.id;
    
    // ✅ Convertim employeeId la ObjectId pentru query-uri corecte
    let employeeObjectId;
    try {
      employeeObjectId = new mongoose.Types.ObjectId(employeeId);
    } catch (err) {
      return res.status(400).json({ error: "ID angajat invalid" });
    }
    
    // ✅ Verifică dacă angajatul există înainte de ștergere
    const employee = await Employee.findById(employeeObjectId);
    if (!employee) {
      return res.status(404).json({ error: "Angajatul nu a fost găsit" });
    }
    
    // ✅ Șterge concediile asociate angajatului (folosim ObjectId pentru query corect)
    const leavesDeleted = await Leave.deleteMany({ employeeId: employeeObjectId });
    console.log(`🗑️  Șterse ${leavesDeleted.deletedCount} concedii pentru angajatul ${employeeId}`);
    
    // ✅ Șterge timesheet-urile asociate angajatului
    const timesheetsDeleted = await Timesheet.deleteMany({ employeeId: employeeObjectId });
    console.log(`🗑️  Șterse ${timesheetsDeleted.deletedCount} timesheet-uri pentru angajatul ${employeeId}`);
    
    // ✅ Șterge angajatul
    const deleted = await Employee.findByIdAndDelete(employeeObjectId);
    
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logWorkplaceName = await getWorkplaceName(deleted.workplaceId);
    
    logger.info("Employee deleted", { 
      employeeId, 
      employeeName: deleted.name,
      workplaceId: deleted.workplaceId,
      workplaceName: logWorkplaceName,
      leavesDeleted: leavesDeleted.deletedCount,
      timesheetsDeleted: timesheetsDeleted.deletedCount,
      ...userInfo
    });
    
    res.json({ 
      message: "Angajat șters", 
      deleted,
      leavesDeleted: leavesDeleted.deletedCount,
      timesheetsDeleted: timesheetsDeleted.deletedCount
    });
  } catch (err) {
    console.error("❌ DELETE EMPLOYEE ERROR:", err);
    logger.error("Delete employee error", err, { employeeId: req.params.id });
    res.status(500).json({ error: "Eroare ștergere angajat" });
  }
});

// ✅ GET USERS - Returnează doar conturile de autentificare (admin, superadmin), NU employees
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({ 
      isActive: true,
      role: { $in: ["admin", "superadmin"] } // ✅ Doar conturi de autentificare
    }).populate(
      "workplaceId",
      "name"
    );
    res.json(users);
  } catch (err) {
    console.error("❌ GET USERS ERROR:", err);
    res.status(500).json({ error: "Eroare încărcare useri" });
  }
});

// ✅ GET EMPLOYEES BY WORKPLACE - Folosește Employee, nu User
app.get("/api/users/by-workplace/:workplaceId", async (req, res) => {
  try {
    const { workplaceId } = req.params;
    
    // ✅ Convertim workplaceId la ObjectId pentru query corect
    let workplaceObjectId;
    try {
      workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);
    } catch (err) {
      return res.status(400).json({ error: "ID farmacie invalid" });
    }

    const employees = await Employee.find({
      workplaceId: workplaceObjectId, // ✅ Folosim ObjectId pentru comparație corectă
      isActive: true,
    })
      .select("_id name email function workplaceId monthlyTargetHours")
      .populate("workplaceId", "name")
      .sort({ name: 1 });

    console.log("🔍 GET EMPLOYEES BY WORKPLACE:", {
      workplaceId,
      workplaceObjectId: String(workplaceObjectId),
      employeesFound: employees.length,
      employees: employees.map(e => ({
        _id: String(e._id),
        name: e.name,
        workplaceId: String(e.workplaceId),
      })),
    });

    res.json(employees);
  } catch (err) {
    console.error("❌ EMPLOYEES BY WORKPLACE ERROR:", err);
    res.status(500).json({ error: "Eroare la încărcarea angajaților" });
  }
});

// ✅ TOȚI ANGAJAȚII (pt AddVisitor)
app.get("/api/users/employees", async (req, res) => {
  try {
    // ✅ Folosim Employee în loc de User.find({ role: "employee" })
    // ✅ IMPORTANT: Nu folosim .limit() - vrem TOȚI angajații
    const employees = await Employee.find({ isActive: true })
      .select("_id name email function workplaceId monthlyTargetHours")
      .populate("workplaceId", "name")
      .sort({ name: 1 })
      .lean();
    
    // ✅ Verifică numărul total de angajați în MongoDB (inclusiv inactivi)
    const totalInDb = await Employee.countDocuments({});
    const activeInDb = await Employee.countDocuments({ isActive: true });
    const inactiveInDb = await Employee.countDocuments({ isActive: false });
    
    console.log("🔍 [GET /api/users/employees] STATISTICI:", {
      totalInMongoDB: totalInDb,
      activeInMongoDB: activeInDb,
      inactiveInMongoDB: inactiveInDb,
      returnedInResponse: employees.length,
    });
    
    res.json(employees);
  } catch (err) {
    console.error("❌ GET EMPLOYEES ERROR:", err);
    res.status(500).json({ error: "Eroare încărcare angajați" });
  }
});

// ✅ BY IDS (pt reafișare vizitatori după refresh) - Folosește Employee
app.get("/api/users/by-ids", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json([]);

    const employees = await Employee.find({ _id: { $in: ids }, isActive: true })
      .select("_id name email function workplaceId monthlyTargetHours")
      .populate("workplaceId", "name");

    // păstrăm ordinea cerută
    const map = new Map(employees.map((e) => [String(e._id), e]));
    const ordered = ids.map((id) => map.get(String(id))).filter(Boolean);

    res.json(ordered);
  } catch (err) {
    console.error("❌ EMPLOYEES BY IDS ERROR:", err);
    res.status(500).json({ error: "Eroare by-ids" });
  }
});

/* ==========================
   LEAVES
   ========================== */
app.post("/api/leaves/create", auth, async (req, res) => {
  try {
    console.log('═══════════════════════════════════════');
    console.log('📥 BACKEND - CREATE LEAVE');
    console.log('📥 Body complet:', JSON.stringify(req.body, null, 2));
    console.log('📥 directSupervisorName:', req.body.directSupervisorName);
    console.log('📥 directSupervisorName type:', typeof req.body.directSupervisorName);
    console.log('📥 directSupervisorName truthy?', !!req.body.directSupervisorName);
    console.log('═══════════════════════════════════════');
    
    // Obține numele angajatului pentru denormalizare
    // ✅ Folosim Employee în loc de User
    const employee = await Employee.findById(req.body.employeeId).select("name").lean();
    const employeeName = employee?.name || "Necunoscut";

    // ✅ Datele cererii pentru verificare
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    
    // Normalizează datele pentru comparație
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);

    // ✅ Verifică dacă există concedii suprapuse pentru același angajat
    const overlappingLeaves = await checkLeaveOverlaps(
      req.body.employeeId,
      startDateNormalized,
      endDateNormalized
    );

    if (overlappingLeaves.length > 0) {
      // Formatează datele pentru mesaj
      const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const conflicts = overlappingLeaves.map(leave => ({
        leaveId: leave._id,
        startDate: formatDate(leave.startDate),
        endDate: formatDate(leave.endDate),
        type: leave.type,
        days: leave.days,
      }));

      return res.status(409).json({
        error: "Există deja concedii aprobate care se suprapun cu perioada selectată.",
        code: "LEAVE_OVERLAP",
        conflicts: conflicts,
        message: `Angajatul are deja ${conflicts.length} concediu${conflicts.length > 1 ? 'i' : ''} aprobat${conflicts.length > 1 ? 'e' : ''} în perioada ${formatDate(startDateNormalized)} - ${formatDate(endDateNormalized)}. Te rog modifică perioada sau șterge/modifică concediile existente.`,
        canEdit: true, // Permite editarea concediilor existente
      });
    }

    // ✅ Verifică dacă există pontaj în perioada cererii de concediu
    const timesheets = await Timesheet.find({
      employeeId: req.body.employeeId,
    }).lean();

    // Verifică dacă există pontaj în perioada cererii
    const conflictingTimesheets = [];
    
    for (const timesheet of timesheets) {
      const timesheetDate = new Date(timesheet.date);
      timesheetDate.setHours(0, 0, 0, 0);
      
      // Verifică dacă data pontajului se află în intervalul cererii
      if (timesheetDate >= startDateNormalized && timesheetDate <= endDateNormalized) {
        // Verifică dacă există entry-uri cu ore lucrate (nu doar concediu)
        const hasWorkHours = timesheet.entries?.some(entry => {
          // Dacă are startTime și endTime și nu este doar concediu
          return entry.startTime && entry.endTime && 
                 (!entry.leaveType || entry.leaveType === null);
        });

        if (hasWorkHours) {
          conflictingTimesheets.push({
            date: timesheet.date,
            entries: timesheet.entries?.filter(e => e.startTime && e.endTime && !e.leaveType) || [],
          });
        }
      }
    }

    // Dacă există pontaj în perioada cererii, returnează avertisment
    if (conflictingTimesheets.length > 0 && !req.body.force) {
      return res.status(409).json({
        error: "Există pontaj în perioada cererii de concediu. Trebuie să ștergi mai întâi pontajul sau cererea de concediu.",
        code: "TIMESHEET_CONFLICT",
        conflictingTimesheets: conflictingTimesheets.map(ts => ({
          date: ts.date,
          entries: ts.entries.map(e => ({
            workplaceName: e.workplaceName,
            startTime: e.startTime,
            endTime: e.endTime,
            hoursWorked: e.hoursWorked,
          })),
        })),
        leave: {
          startDate: startDate,
          endDate: endDate,
          status: "Aprobată",
        },
        canForce: false, // Nu permitem forțarea - trebuie rezolvată problema
      });
    }

    const leave = new Leave({
      employeeId: req.body.employeeId,
      name: employeeName, // ✅ Denormalizat: numele angajatului
      workplaceId: req.body.workplaceId,
      function: req.body.function,
      type: req.body.type,
      reason: req.body.reason,
      startDate: startDate,
      endDate: endDate,
      days: Number(req.body.days),
      directSupervisorName: req.body.directSupervisorName || "",
      status: "În așteptare", // ✅ Cererile sunt create în așteptare, trebuie aprobate de admin manager
      createdBy: req.body.createdBy || undefined,
    });

    console.log('═══════════════════════════════════════');
    console.log('📝 BACKEND - LEAVE CREAT');
    console.log('📝 Leave directSupervisorName:', leave.directSupervisorName);
    console.log('📝 Leave complet:', JSON.stringify(leave.toObject(), null, 2));
    const saved = await leave.save();
    console.log('💾 BACKEND - LEAVE SALVAT');
    console.log('💾 Saved directSupervisorName:', saved.directSupervisorName);
    console.log('💾 Saved _id:', saved._id);
    console.log('═══════════════════════════════════════');
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logEmployeeName = await getEmployeeName(saved.employeeId);
    const logWorkplaceName = await getWorkplaceName(saved.workplaceId);
    
    logger.info("Leave created", { 
      leaveId: saved._id, 
      employeeId: saved.employeeId,
      employeeName: logEmployeeName,
      workplaceId: saved.workplaceId,
      workplaceName: logWorkplaceName,
      startDate: saved.startDate,
      endDate: saved.endDate,
      type: saved.type,
      ...userInfo
    });

    // ✅ Trimite email notificare la admin manager (superadmin) când se creează o cerere nouă
    // Verificăm preferința pentru superadmin (admin manager)
    let shouldSendEmail = false;
    
    try {
      // Verifică dacă există superadmin cu preferința activată
      const superadmin = await User.findOne({
        role: "superadmin",
        emailNotificationsEnabled: true,
        isActive: true,
      }).select("_id name emailNotificationsEnabled role").lean();
      
      if (superadmin) {
        shouldSendEmail = true;
        
        console.log("═══════════════════════════════════════");
        console.log("🔍 VERIFICARE NOTIFICĂRI EMAIL:");
        console.log("   ✅ Găsit superadmin cu notificări activate:");
        console.log("   Superadmin ID:", String(superadmin._id));
        console.log("   Superadmin name:", superadmin.name);
        console.log("   shouldSendEmail:", shouldSendEmail);
        console.log("═══════════════════════════════════════");
      } else {
        console.log("═══════════════════════════════════════");
        console.log("🔍 VERIFICARE NOTIFICĂRI EMAIL:");
        console.log("   ⚠️ Nu s-a găsit superadmin cu notificări activate");
        console.log("   shouldSendEmail: false");
        console.log("═══════════════════════════════════════");
      }
    } catch (err) {
      console.warn("⚠️ Nu s-a putut verifica preferința email din User:", err.message);
      shouldSendEmail = false;
    }
    
    // ✅ Trimite email la admin manager pentru cereri noi (în așteptare)
    if (shouldSendEmail) {
      try {
        const emailResult = await sendLeaveRequestNotification({
          employee_name: logEmployeeName,
          workplace_name: logWorkplaceName,
          function: saved.function,
          type: saved.type,
          startDate: saved.startDate,
          endDate: saved.endDate,
          days: saved.days,
          reason: saved.reason,
          directSupervisorName: saved.directSupervisorName || "",
        });
        
        if (emailResult.success) {
          console.log("📧 Email notificare cerere nouă trimis cu succes către", process.env.EMAILJS_TO_EMAIL || "horatiu.olt@gmail.com");
        } else {
          console.warn("⚠️ Email notificare nu a putut fi trimis:", emailResult.error);
        }
      } catch (emailError) {
        // Nu blocăm salvarea cererii dacă emailul eșuează
        console.error("⚠️ EROARE TRIMITERE EMAIL (non-critical):", emailError.message);
      }
    } else {
      console.log("ℹ️ Notificări email dezactivate - email-ul nu va fi trimis");
    }

    res.json(saved);
  } catch (err) {
    console.error("❌ CREATE LEAVE ERROR:", err);
    logger.error("Create leave error", err, { employeeId: req.body.employeeId });
    res
      .status(500)
      .json({ error: "Eroare creare cerere", details: err.message });
  }
});

app.get("/api/leaves/all", auth, async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("employeeId", "name")
      .populate("workplaceId", "name")
      .populate("createdBy", "name");
    res.json(leaves);
  } catch (err) {
    console.error("❌ GET ALL LEAVES ERROR:", err);
    res.status(500).json({ error: "Eroare încărcare concedii" });
  }
});

app.get("/api/leaves/by-workplace/:workplaceId", async (req, res) => {
  try {
    const leaves = await Leave.find({ workplaceId: req.params.workplaceId })
      .populate("employeeId", "name")
      .populate("workplaceId", "name")
      .populate("createdBy", "name");
    res.json(leaves);
  } catch (err) {
    console.error("❌ GET LEAVES BY WORKPLACE ERROR:", err);
    res.status(500).json({ error: "Eroare încărcare concedii farmacie" });
  }
});

app.put("/api/leaves/:id", async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave)
      return res.status(404).json({ error: "Cererea nu a fost găsită" });

    // ✅ Eliminat verificarea statusului - cererile pot fi editate indiferent de status
    // (cererile sunt aprobate automat, deci nu mai există "În așteptare")

    // Dacă employeeId se schimbă, actualizează și numele
    // ✅ Folosim Employee în loc de User
    let employeeName = leave.name;
    const employeeId = req.body.employeeId || leave.employeeId;
    if (req.body.employeeId && req.body.employeeId !== String(leave.employeeId)) {
      const employee = await Employee.findById(req.body.employeeId).select("name").lean();
      employeeName = employee?.name || "Necunoscut";
    }

    // ✅ Datele noi pentru verificare
    const newStartDate = req.body.startDate ? new Date(req.body.startDate) : leave.startDate;
    const newEndDate = req.body.endDate ? new Date(req.body.endDate) : leave.endDate;

    // ✅ Verifică dacă există concedii suprapuse pentru același angajat (excluzând cererea curentă)
    const isPeriodChanged = req.body.startDate || req.body.endDate;
    if (isPeriodChanged) {
      const startDateNormalized = new Date(newStartDate);
      startDateNormalized.setHours(0, 0, 0, 0);
      const endDateNormalized = new Date(newEndDate);
      endDateNormalized.setHours(23, 59, 59, 999);

      const overlappingLeaves = await checkLeaveOverlaps(
        employeeId,
        startDateNormalized,
        endDateNormalized,
        leave._id // Exclude cererea curentă
      );

      if (overlappingLeaves.length > 0) {
        // Formatează datele pentru mesaj
        const formatDate = (date) => {
          const d = new Date(date);
          return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const conflicts = overlappingLeaves.map(l => ({
          leaveId: l._id,
          startDate: formatDate(l.startDate),
          endDate: formatDate(l.endDate),
          type: l.type,
          days: l.days,
        }));

        return res.status(409).json({
          error: "Noua perioadă se suprapune cu concedii aprobate existente.",
          code: "LEAVE_OVERLAP",
          conflicts: conflicts,
          message: `Angajatul are deja ${conflicts.length} concediu${conflicts.length > 1 ? 'i' : ''} aprobat${conflicts.length > 1 ? 'e' : ''} care se suprapun cu noua perioadă ${formatDate(startDateNormalized)} - ${formatDate(endDateNormalized)}. Te rog modifică perioada sau șterge/modifică concediile existente.`,
          canEdit: true,
        });
      }
    }

    // ✅ Verifică dacă există pontaj în perioada cererii de concediu
    // Verificăm întotdeauna când cererea este aprobată sau când se modifică perioada
    // (pentru a preveni conflicte cu pontajul existent)
    if (leave.status === "Aprobată" || isPeriodChanged) {
      // Normalizează datele pentru comparație
      // Dacă perioada s-a schimbat, folosim datele noi, altfel folosim datele existente
      const checkStartDate = isPeriodChanged ? newStartDate : leave.startDate;
      const checkEndDate = isPeriodChanged ? newEndDate : leave.endDate;
      
      const startDateNormalized = new Date(checkStartDate);
      startDateNormalized.setHours(0, 0, 0, 0);
      const endDateNormalized = new Date(checkEndDate);
      endDateNormalized.setHours(23, 59, 59, 999);

      // Găsește toate timesheet-urile pentru angajat în perioada cererii
      const timesheets = await Timesheet.find({
        employeeId: employeeId,
      }).lean();

      // Verifică dacă există pontaj în perioada cererii
      const conflictingTimesheets = [];
      
      for (const timesheet of timesheets) {
        const timesheetDate = new Date(timesheet.date);
        timesheetDate.setHours(0, 0, 0, 0);
        
        // Verifică dacă data pontajului se află în intervalul cererii
        if (timesheetDate >= startDateNormalized && timesheetDate <= endDateNormalized) {
          // Verifică dacă există entry-uri cu ore lucrate (nu doar concediu)
          const hasWorkHours = timesheet.entries?.some(entry => {
            // Dacă are startTime și endTime și nu este doar concediu
            return entry.startTime && entry.endTime && 
                   (!entry.leaveType || entry.leaveType === null);
          });

          if (hasWorkHours) {
            conflictingTimesheets.push({
              date: timesheet.date,
              entries: timesheet.entries?.filter(e => e.startTime && e.endTime && !e.leaveType) || [],
            });
          }
        }
      }

      // Dacă există pontaj în perioada cererii, returnează avertisment
      if (conflictingTimesheets.length > 0 && !req.body.force) {
        return res.status(409).json({
          error: "Există pontaj în perioada cererii de concediu. Trebuie să ștergi mai întâi pontajul sau cererea de concediu.",
          code: "TIMESHEET_CONFLICT",
          conflictingTimesheets: conflictingTimesheets.map(ts => ({
            date: ts.date,
            entries: ts.entries.map(e => ({
              workplaceName: e.workplaceName,
              startTime: e.startTime,
              endTime: e.endTime,
              hoursWorked: e.hoursWorked,
            })),
          })),
          leave: {
            _id: leave._id,
            startDate: newStartDate,
            endDate: newEndDate,
            status: leave.status,
          },
          canForce: false, // Nu permitem forțarea - trebuie rezolvată problema
        });
      }
    }

    console.log('📥 UPDATE LEAVE - Body primit:', {
      leaveId: req.params.id,
      directSupervisorName: req.body.directSupervisorName,
      hasDirectSupervisorName: !!req.body.directSupervisorName,
    });
    
    const patch = {
      employeeId: req.body.employeeId,
      name: employeeName, // ✅ Actualizează numele dacă employeeId s-a schimbat
      workplaceId: req.body.workplaceId,
      function: req.body.function,
      type: req.body.type,
      reason: req.body.reason,
      startDate: newStartDate,
      endDate: newEndDate,
      days: req.body.days !== undefined ? Number(req.body.days) : undefined,
      directSupervisorName: req.body.directSupervisorName !== undefined ? (req.body.directSupervisorName || "") : undefined,
    };
    Object.keys(patch).forEach(
      (k) => patch[k] === undefined && delete patch[k]
    );

    console.log('📝 UPDATE LEAVE - Patch aplicat:', patch);
    Object.assign(leave, patch);
    const saved = await leave.save();
    console.log('💾 UPDATE LEAVE - Salvat cu directSupervisorName:', saved.directSupervisorName);

    await saved.populate([
      { path: "employeeId", select: "name" },
      { path: "workplaceId", select: "name" },
    ]);

    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logEmployeeName = await getEmployeeName(saved.employeeId);
    const logWorkplaceName = await getWorkplaceName(saved.workplaceId);
    
    logger.info("Leave updated", { 
      leaveId: saved._id, 
      employeeId: saved.employeeId,
      employeeName: logEmployeeName,
      workplaceId: saved.workplaceId,
      workplaceName: logWorkplaceName,
      status: saved.status,
      ...userInfo
    });
    res.json(saved);
  } catch (err) {
    console.error("❌ UPDATE LEAVE ERROR:", err);
    logger.error("Update leave error", err, { leaveId: req.params.id });
    res
      .status(500)
      .json({ error: "Eroare update cerere", details: err.message });
  }
});

app.delete("/api/leaves/:id", async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave)
      return res.status(404).json({ error: "Cererea nu a fost găsită" });

    // ✅ Permitem ștergerea pentru toate statusurile (În așteptare, Aprobată, Respinsă)
    // Utilizatorul poate șterge cererea dacă se răzgândește, chiar dacă a fost aprobată
    await leave.deleteOne();
    console.log(`🗑️  Cerere ștearsă: ${leave.name} (Status: ${leave.status})`);
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logEmployeeName = await getEmployeeName(leave.employeeId);
    const logWorkplaceName = await getWorkplaceName(leave.workplaceId);
    
    logger.info("Leave deleted", { 
      leaveId: leave._id, 
      employeeId: leave.employeeId,
      employeeName: logEmployeeName,
      workplaceId: leave.workplaceId,
      workplaceName: logWorkplaceName,
      status: leave.status,
      ...userInfo
    });
    res.json({ message: "Cerere ștearsă cu succes" });
  } catch (err) {
    console.error("❌ DELETE LEAVE ERROR:", err);
    logger.error("Delete leave error", err, { leaveId: req.params.id });
    res
      .status(500)
      .json({ error: "Eroare ștergere cerere", details: err.message });
  }
});

app.put("/api/leaves/update/:id", async (req, res) => {
  try {
    const updated = await Leave.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true }
    )
      .populate("employeeId", "name")
      .populate("workplaceId", "name");

    res.json(updated);
  } catch (err) {
    console.error("❌ UPDATE LEAVE STATUS ERROR:", err);
    res.status(500).json({ error: "Eroare update cerere" });
  }
});

// ✅ Endpoint pentru aprobare cerere (doar superadmin sau admin)
app.put("/api/leaves/:id/approve", auth, async (req, res) => {
  try {
    // Verifică dacă user-ul este superadmin sau admin
    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Doar admin manager poate aproba cereri" });
    }

    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "Aprobată" } },
      { new: true }
    )
      .populate("employeeId", "name")
      .populate("workplaceId", "name");

    if (!leave) {
      return res.status(404).json({ error: "Cererea nu a fost găsită" });
    }

    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logEmployeeName = await getEmployeeName(leave.employeeId);
    const logWorkplaceName = await getWorkplaceName(leave.workplaceId);
    
    logger.info("Leave approved", { 
      leaveId: leave._id, 
      employeeId: leave.employeeId,
      employeeName: logEmployeeName,
      workplaceId: leave.workplaceId,
      workplaceName: logWorkplaceName,
      ...userInfo
    });

    res.json(leave);
  } catch (err) {
    console.error("❌ APPROVE LEAVE ERROR:", err);
    logger.error("Approve leave error", err, { leaveId: req.params.id });
    res.status(500).json({ error: "Eroare aprobare cerere" });
  }
});

// ✅ Endpoint pentru respingere cerere (doar superadmin sau admin)
app.put("/api/leaves/:id/reject", auth, async (req, res) => {
  try {
    // Verifică dacă user-ul este superadmin sau admin
    if (req.user.role !== "superadmin" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Doar admin manager poate respinge cereri" });
    }

    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "Respinsă" } },
      { new: true }
    )
      .populate("employeeId", "name")
      .populate("workplaceId", "name");

    if (!leave) {
      return res.status(404).json({ error: "Cererea nu a fost găsită" });
    }

    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const logEmployeeName = await getEmployeeName(leave.employeeId);
    const logWorkplaceName = await getWorkplaceName(leave.workplaceId);
    
    logger.info("Leave rejected", { 
      leaveId: leave._id, 
      employeeId: leave.employeeId,
      employeeName: logEmployeeName,
      workplaceId: leave.workplaceId,
      workplaceName: logWorkplaceName,
      ...userInfo
    });

    res.json(leave);
  } catch (err) {
    console.error("❌ REJECT LEAVE ERROR:", err);
    logger.error("Reject leave error", err, { leaveId: req.params.id });
    res.status(500).json({ error: "Eroare respingere cerere" });
  }
});

/* ==========================
   ANNOUNCEMENTS (MESAJE MANAGER)
   ========================== */

// ✅ POST /api/announcements - Creează un mesaj nou (doar superadmin)
app.post("/api/announcements", auth, async (req, res) => {
  try {
    // Verifică dacă este superadmin
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate crea mesaje" });
    }

    const { message, workplaceIds, startDate, endDate } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mesajul este obligatoriu" });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Data de început și data de sfârșit sunt obligatorii" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Date invalide" });
    }

    if (start > end) {
      return res.status(400).json({ error: "Data de început trebuie să fie înainte de data de sfârșit" });
    }

    // Obține numele creatorului
    const creator = await User.findById(req.user.id).select("name").lean();
    if (!creator) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    // Dacă workplaceIds este gol sau null, mesajul este pentru toate farmaciile
    let targetWorkplaceIds = [];
    if (workplaceIds && Array.isArray(workplaceIds) && workplaceIds.length > 0) {
      // Validează că toate ID-urile sunt valide
      targetWorkplaceIds = workplaceIds.filter(id => {
        try {
          new mongoose.Types.ObjectId(id);
          return true;
        } catch {
          return false;
        }
      }).map(id => new mongoose.Types.ObjectId(id));
    }

    // ✅ Verifică dacă există deja un mesaj activ care se suprapune
    const now = new Date();

    // Cazul 1: Mesaj pentru farmacii specifice
    if (targetWorkplaceIds.length > 0) {
      // Verifică dacă există mesaj activ pentru oricare dintre farmaciile țintă
      const existingForWorkplaces = await Announcement.findOne({
        isActive: true,
        startDate: { $lte: end },
        endDate: { $gte: start },
        workplaceIds: { $in: targetWorkplaceIds },
      });
      
      if (existingForWorkplaces) {
        const workplaceNames = await Workplace.find({ _id: { $in: targetWorkplaceIds } })
          .select("name")
          .lean();
        const names = workplaceNames.map(w => w.name).join(", ");
        return res.status(400).json({ 
          error: `Există deja un mesaj activ pentru farmacia/farmaciile: ${names}. Șterge mesajul existent înainte de a crea unul nou.` 
        });
      }
      
      // Verifică dacă există mesaj global activ (care acoperă toate farmaciile, inclusiv cele țintă)
      const existingGlobal = await Announcement.findOne({
        isActive: true,
        startDate: { $lte: end },
        endDate: { $gte: start },
        workplaceIds: { $size: 0 },
      });
      
      if (existingGlobal) {
        return res.status(400).json({ 
          error: "Există deja un mesaj activ pentru toate farmaciile. Șterge mesajul existent înainte de a crea unul nou pentru farmacii specifice." 
        });
      }
      } else {
      // Cazul 2: Mesaj pentru toate farmaciile
      // Verifică dacă există mesaj global activ
      const existingGlobal = await Announcement.findOne({
        isActive: true,
        startDate: { $lte: end },
        endDate: { $gte: start },
        workplaceIds: { $size: 0 },
      });
      
      if (existingGlobal) {
        return res.status(400).json({ 
          error: "Există deja un mesaj activ pentru toate farmaciile. Șterge mesajul existent înainte de a crea unul nou." 
        });
      }
      
      // Verifică dacă există mesaj activ pentru orice farmacie (pentru că mesajul global le acoperă pe toate)
      const existingForAnyWorkplace = await Announcement.findOne({
        isActive: true,
        startDate: { $lte: end },
        endDate: { $gte: start },
        workplaceIds: { $ne: [], $exists: true, $not: { $size: 0 } },
      });
      
      if (existingForAnyWorkplace) {
        return res.status(400).json({ 
          error: "Există deja mesaje active pentru farmacii specifice. Șterge mesajele existente înainte de a crea un mesaj pentru toate farmaciile." 
        });
      }
    }

    const announcement = new Announcement({
      message: message.trim(),
      workplaceIds: targetWorkplaceIds, // Dacă e gol, mesajul este global
      createdBy: req.user.id,
      createdByName: creator.name,
      startDate: start,
      endDate: end,
      isActive: true,
    });

    await announcement.save();

    logger.info("Announcement created", {
      announcementId: announcement._id,
      createdBy: req.user.id,
      workplaceCount: targetWorkplaceIds.length,
      isGlobal: targetWorkplaceIds.length === 0,
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error("❌ CREATE ANNOUNCEMENT ERROR:", err);
    logger.error("Create announcement error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare creare mesaj" });
  }
});

// ✅ GET /api/announcements - Obține mesajele pentru farmacia curentă sau toate (superadmin)
app.get("/api/announcements", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role workplaceId").lean();
    if (!user) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    const now = new Date();
    
    // Dacă este superadmin (manager), șterge automat mesajele expirate
    // și returnează doar mesajele active care nu au expirat
    if (user.role === "superadmin") {
      // Șterge automat mesajele expirate (indiferent de statusul isActive)
      const deleteResult = await Announcement.deleteMany({
        endDate: { $lt: now }, // Mesajele care au expirat
      });

      if (deleteResult.deletedCount > 0) {
        logger.info("Expired announcements deleted", {
          deletedCount: deleteResult.deletedCount,
          deletedBy: req.user.id,
        });
      }

      // Returnează doar mesajele active care nu au expirat
      const announcements = await Announcement.find({
        isActive: true, // Doar mesajele active
        endDate: { $gte: now }, // Care nu au expirat
      })
        .sort({ createdAt: -1 })
        .select("message workplaceIds createdByName startDate endDate createdAt isActive")
        .lean();

      return res.json(announcements);
    }

    // ✅ Accountancy nu primește mesaje de la manager
    if (user.role === "accountancy") {
      return res.json([]);
    }

    // Pentru adminii farmaciilor, returnează doar mesajele active și neexpirate
    let query = { 
      isActive: true,
      startDate: { $lte: now }, // Mesajul a început
      endDate: { $gte: now }, // Mesajul nu s-a terminat
    };

    const userWorkplaceId = user.workplaceId?._id || user.workplaceId;
    if (userWorkplaceId) {
      const workplaceObjectId = new mongoose.Types.ObjectId(userWorkplaceId);
      query.$or = [
        { workplaceIds: { $size: 0 } }, // Mesaje globale (fără workplaceIds)
        { workplaceIds: workplaceObjectId }, // Mesaje pentru farmacia sa
      ];
    } else {
      // Dacă nu are farmacie, vede doar mesajele globale
      query.workplaceIds = { $size: 0 };
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 }) // Cele mai recente primele
      .select("message workplaceIds createdByName startDate endDate createdAt")
      .lean();

    res.json(announcements);
  } catch (err) {
    console.error("❌ GET ANNOUNCEMENTS ERROR:", err);
    logger.error("Get announcements error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare încărcare mesaje" });
  }
});

// ✅ PUT /api/announcements/:id - Arhivează un mesaj (doar superadmin)
app.put("/api/announcements/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate arhiva mesaje" });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { isActive: isActive !== undefined ? isActive : false },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: "Mesajul nu a fost găsit" });
    }

    logger.info("Announcement updated", {
      announcementId: id,
      isActive: announcement.isActive,
      updatedBy: req.user.id,
    });

    res.json(announcement);
  } catch (err) {
    console.error("❌ UPDATE ANNOUNCEMENT ERROR:", err);
    logger.error("Update announcement error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare actualizare mesaj" });
  }
});

// ✅ DELETE /api/announcements/:id - Șterge un mesaj (doar superadmin)
app.delete("/api/announcements/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate șterge mesaje" });
    }

    const { id } = req.params;
    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({ error: "Mesajul nu a fost găsit" });
    }

    logger.info("Announcement deleted", {
      announcementId: id,
      deletedBy: req.user.id,
    });

    res.json({ message: "Mesaj șters cu succes" });
  } catch (err) {
    console.error("❌ DELETE ANNOUNCEMENT ERROR:", err);
    logger.error("Delete announcement error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare ștergere mesaj" });
  }
});

// ✅ DELETE /api/announcements/all - Șterge toate mesajele (doar superadmin)
app.delete("/api/announcements/all", auth, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Doar managerul poate șterge mesaje" });
    }

    const deleteResult = await Announcement.deleteMany({});

    logger.info("All announcements deleted", {
      deletedCount: deleteResult.deletedCount,
      deletedBy: req.user.id,
    });

    res.json({ 
      message: "Toate mesajele au fost șterse cu succes",
      deletedCount: deleteResult.deletedCount
    });
  } catch (err) {
    console.error("❌ DELETE ALL ANNOUNCEMENTS ERROR:", err);
    logger.error("Delete all announcements error", err, { userId: req.user?.id });
    res.status(500).json({ error: "Eroare ștergere mesaje" });
  }
});

/* ==========================
   PONTAJ (SINGLE ROUTE)
   ========================== */
// ✅ LOGICĂ SIMPLIFICATĂ DE PONTAJ - RESCRISĂ DE LA ZERO
app.post("/api/pontaj", async (req, res) => {
  try {
    const {
      employeeId,
      workplaceId,
      date, // "YYYY-MM-DD"
      startTime,
      endTime,
      hoursWorked,
      leaveType,
      status,
      notes,
      force,
    } = req.body;

    // ✅ VALIDARE INPUT
    if (!employeeId || !workplaceId || !date) {
      return res.status(400).json({ error: "employeeId/workplaceId/date sunt obligatorii" });
    }

    const dayStart = parseLocalDayStart(date);
    
    // ✅ IMPORTANT: dateString trebuie să fie exact string-ul primit de la frontend
    // Nu folosim dayStart.getDate() etc. pentru că pot fi afectate de timezone
    // Frontend-ul trimite deja "YYYY-MM-DD" corect
    const dateString = date; // ✅ Folosim direct string-ul primit, nu calculăm din dayStart

    // ✅ 1. GĂSEȘTE ANGAJATUL
    const employee = await Employee.findById(employeeId).select("name workplaceId").lean();
    if (!employee) {
      return res.status(404).json({ error: "Angajatul nu a fost găsit" });
    }
    
    const employeeHomeWorkplaceId = employee.workplaceId || null;
    const employeeName = employee.name || "Necunoscut";
    
    // ✅ 2. VERIFICĂ CONCEDIU APROBAT (doar dacă nu e force)
    if (!force) {
    const approvedLeave = await Leave.findOne({
      employeeId,
        workplaceId: employeeHomeWorkplaceId,
      status: "Aprobată",
        startDate: { $lte: parseLocalDayEnd(date) },
      endDate: { $gte: dayStart },
    }).lean();

      if (approvedLeave) {
      return res.status(409).json({
        error: "Angajatul are concediu aprobat în această zi.",
        code: "LEAVE_APPROVED",
        leave: approvedLeave,
        canForce: true,
      });
    }
    }

    // ✅ 3. CALCULEAZĂ ORELE - SIMPLU ȘI CORECT
    const calcWorkHours = (start, end) => {
      const parseHour = (timeStr) => {
        const [h = '08'] = (timeStr || '08:00').split(':');
        return Math.max(0, Math.min(23, Number(h) || 8));
      };
      const s = parseHour(start);
      let e = parseHour(end);
      if (e <= s) e += 24; // Next day
      return Math.max(0, e - s);
      };

    let calculatedHours = 0;
    if (hoursWorked !== undefined && hoursWorked !== null && hoursWorked !== "" && !isNaN(Number(hoursWorked))) {
      calculatedHours = Math.round(Number(hoursWorked));
    } else if (startTime && endTime) {
      calculatedHours = calcWorkHours(startTime, endTime);
    } else {
      return res.status(400).json({ error: "Trebuie să furnizezi fie hoursWorked, fie startTime și endTime" });
    }

    // ✅ 4. GĂSEȘTE NUMELE FARMACIEI
    const workplace = await Workplace.findById(workplaceId).select("name").lean();
    const workplaceName = (workplace?.name && String(workplace.name).trim()) 
      ? String(workplace.name).trim() 
      : "Necunoscut";

    // ✅ 5. DETERMINĂ TIPUL: "home" sau "visitor"
    const isVisitor = !employeeHomeWorkplaceId || String(employeeHomeWorkplaceId) !== String(workplaceId);
    const entryType = isVisitor ? "visitor" : "home";

    // ✅ 6. CREEAZĂ ENTRY-UL NOU
    const workplaceObjectId = mongoose.Types.ObjectId.isValid(workplaceId) 
      ? new mongoose.Types.ObjectId(workplaceId)
      : workplaceId;
    
    const newEntry = {
      workplaceId: workplaceObjectId,
      workplaceName,
      startTime: startTime || "08:00",
      endTime: endTime || "16:00",
      hoursWorked: calculatedHours,
      minutesWorked: calculatedHours * 60, // Pentru compatibilitate
      type: entryType,
      leaveType: leaveType || null,
      status: status || null,
      notes: notes || "",
    };

    // ✅ 7. LOGICĂ CORECTĂ: Găsește timesheet folosind dateString pentru a evita problemele cu timezone
    // Folosim dateString (string "YYYY-MM-DD") în loc de date (Date object) pentru a fi siguri
    // că găsim exact timesheet-ul pentru ziua respectivă, fără probleme de timezone
    let timesheet = await Timesheet.findOne({
      employeeId,
      dateString: dateString, // ✅ Folosim dateString pentru query exact
    });
    
    // ✅ Dacă nu găsim cu dateString, încercăm și cu date (pentru compatibilitate cu datele vechi)
    // Dar folosim un range exact pentru a evita să găsim zile greșite
    if (!timesheet) {
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      timesheet = await Timesheet.findOne({
        employeeId,
        date: {
          $gte: dayStart,
          $lte: dayEnd,
        },
      });
    }

    // ✅ DEBUG: Log pentru a verifica dacă găsim timesheet-ul corect
    if (timesheet) {
      const timesheetDateStr = timesheet.dateString || (timesheet.date ? timesheet.date.toISOString().slice(0, 10) : 'unknown');
      if (timesheetDateStr !== dateString) {
        console.error("⚠️ [PONTAJ] TIMESHEET GĂSIT PENTRU ZI GREȘITĂ:", {
          requestedDate: dateString,
          foundDate: timesheetDateStr,
          employeeId: String(employeeId),
          timesheetId: String(timesheet._id),
        });
        // ✅ Dacă găsim timesheet pentru zi greșită, nu-l folosim - creăm unul nou
        timesheet = null;
      }
    }

    if (!timesheet) {
      // Creează timesheet nou
      timesheet = new Timesheet({
        employeeId,
        employeeName: employeeName.trim() || "Necunoscut",
        date: dayStart,
        dateString: dateString, // ✅ Folosim string-ul primit direct de la frontend
        entries: [newEntry],
        isComplete: false,
      });
    } else {
      // ✅ VERIFICARE CRITICĂ: Asigură-te că timesheet-ul este pentru ziua corectă
      const timesheetDateStr = timesheet.dateString || (timesheet.date ? timesheet.date.toISOString().slice(0, 10) : null);
      if (timesheetDateStr && timesheetDateStr !== dateString) {
        console.error("❌ [PONTAJ] CRITICAL ERROR: Timesheet găsit pentru zi greșită!", {
          requestedDate: dateString,
          timesheetDate: timesheetDateStr,
          employeeId: String(employeeId),
          timesheetId: String(timesheet._id),
        });
        // ✅ Nu modificăm timesheet-ul greșit - creăm unul nou pentru ziua corectă
        timesheet = new Timesheet({
          employeeId,
          employeeName: employeeName.trim() || "Necunoscut",
          date: dayStart,
          dateString: dateString,
          entries: [newEntry],
          isComplete: false,
        });
      } else {
        // Actualizează numele dacă e necesar
        if (!timesheet.employeeName || timesheet.employeeName.trim() === "") {
          timesheet.employeeName = employeeName.trim() || "Necunoscut";
        }

        // ✅ Actualizează dateString dacă e necesar (pentru consistență)
        if (!timesheet.dateString || timesheet.dateString !== dateString) {
          timesheet.dateString = dateString; // ✅ Folosim string-ul primit direct de la frontend
        }

        // ✅ LOGICĂ CORECTĂ: Șterge TOATE entry-urile pentru același workplace și tip, apoi adaugă unul nou
        // Astfel prevenim duplicatele și asigurăm că orele nu se adună
        timesheet.entries = timesheet.entries.filter(
          (e) => !(String(e.workplaceId) === String(workplaceObjectId) && e.type === entryType)
        );
        
        // Adaugă entry-ul nou
        timesheet.entries.push(newEntry);
        timesheet.markModified('entries');
      }
    }

    // ✅ 8. SALVEAZĂ (totalHours se calculează automat prin pre-save hook)
      await timesheet.save();

    // ✅ 9. RETURNEAZĂ RĂSPUNS
    const saved = await Timesheet.findById(timesheet._id).lean();
    const relevantEntry = saved.entries.find(
      (e) => String(e.workplaceId) === String(workplaceObjectId) && e.type === entryType
    );

    if (relevantEntry) {
      return res.status(200).json({
        _id: saved._id,
        employeeId: saved.employeeId,
        employeeName: saved.employeeName,
        workplaceId: String(relevantEntry.workplaceId),
        workplaceName: relevantEntry.workplaceName,
        date: saved.date,
        startTime: relevantEntry.startTime,
        endTime: relevantEntry.endTime,
        hoursWorked: relevantEntry.hoursWorked,
        minutesWorked: relevantEntry.minutesWorked,
        leaveType: relevantEntry.leaveType,
        notes: relevantEntry.notes,
        type: relevantEntry.type,
        status: relevantEntry.status,
        totalHours: saved.totalHours,
        totalMinutes: saved.totalMinutes,
        entriesCount: saved.entries.length,
      });
    }

    return res.status(200).json(saved);
  } catch (err) {
    console.error("❌ UPSERT PONTAJ ERROR:", {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
    });

    if (err.code === 11000) {
      console.error("⚠️ CONFLICT: Unique index violation (duplicate key)", {
        employeeId: String(employeeId),
        date: dayStart ? dayStart.toISOString().slice(0, 10) : "unknown",
        error: err.message,
      });
      return res.status(409).json({
        error: "Conflict: pontaj existent pentru acest angajat în această zi.",
        code: "PONTAJ_EXISTS",
        details: err.message,
      });
    }

    return res
      .status(500)
      .json({ error: "Eroare salvare pontaj", details: err.message });
  }
});

// ✅ DUPLICAT ȘTERS - Endpoint-ul deja există mai sus (linia ~1571)

// Helper function pentru compararea corectă a ObjectId-urilor
const compareObjectIds = (id1, id2) => {
  if (!id1 || !id2) return false;
  
  // Dacă ambele sunt ObjectId, folosim .equals()
  if (id1 instanceof mongoose.Types.ObjectId && id2 instanceof mongoose.Types.ObjectId) {
    return id1.equals(id2);
  }
  
  // Convertim ambele la string pentru comparație
  const str1 = id1 instanceof mongoose.Types.ObjectId 
    ? id1.toString() 
    : mongoose.Types.ObjectId.isValid(id1) 
      ? new mongoose.Types.ObjectId(id1).toString() 
      : String(id1);
      
  const str2 = id2 instanceof mongoose.Types.ObjectId 
    ? id2.toString() 
    : mongoose.Types.ObjectId.isValid(id2) 
      ? new mongoose.Types.ObjectId(id2).toString() 
      : String(id2);
  
  return str1 === str2;
};

// /api/pontaj/by-workplace/:workplaceId?from=YYYY-MM-DD&to=YYYY-MM-DD
// ✅ Returnează timesheet-urile care au cel puțin un entry pentru farmacia respectivă
app.get("/api/pontaj/by-workplace/:workplaceId", async (req, res) => {
  try {
    const { workplaceId } = req.params;
    const { from, to } = req.query;

    console.log("🔍 [GET /api/pontaj/by-workplace] REQUEST:", {
      workplaceId,
      from,
      to,
      workplaceIdType: typeof workplaceId,
    });

    // Construiește filter pentru date
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.$gte = parseLocalDayStart(from);
      if (to) dateFilter.date.$lte = parseLocalDayEnd(to);
    }

    console.log("🔍 [GET /api/pontaj/by-workplace] QUERY FILTER:", {
      dateFilter,
      fromDate: from ? parseLocalDayStart(from).toISOString() : null,
      toDate: to ? parseLocalDayEnd(to).toISOString() : null,
    });

    // ✅ IMPORTANT: Găsește TOATE timesheet-urile pentru perioada respectivă
    // Apoi filtrez entries-urile în JavaScript pentru a accepta atât ObjectId cât și string
    // ✅ Folosim query MongoDB pentru a filtra direct entries-urile după workplaceId
    const workplaceObjectId = mongoose.Types.ObjectId.isValid(workplaceId) 
      ? new mongoose.Types.ObjectId(workplaceId)
      : null;
    
    if (!workplaceObjectId) {
      console.error("❌ [GET /api/pontaj/by-workplace] INVALID WORKPLACE ID:", workplaceId);
      return res.status(400).json({ error: "Invalid workplaceId" });
    }
    
    // ✅ IMPORTANT: Găsim TOATE timesheet-urile pentru perioada respectivă
    // Apoi filtrez entries-urile în JavaScript pentru a asigura că găsim TOATE datele
    // Query-ul MongoDB cu "entries.workplaceId" poate să nu găsească toate timesheet-urile
    // dacă ObjectId-urile nu se potrivesc exact sau dacă există probleme de tip
    const timesheets = await Timesheet.find(dateFilter)
      .select("employeeId employeeName date entries totalHours totalMinutes")
      .populate("employeeId", "name function monthlyTargetHours email workplaceId")
      .lean()
      .sort({ date: 1 });

    console.log("🔍 [GET /api/pontaj/by-workplace] ALL TIMESHEETS FROM DB:", {
      workplaceId: String(workplaceObjectId),
      dateFilter,
      totalTimesheetsFound: timesheets.length,
      sampleTimesheet: timesheets.length > 0 ? {
        _id: String(timesheets[0]._id),
        employeeId: String(timesheets[0].employeeId?._id || timesheets[0].employeeId),
        date: timesheets[0].date instanceof Date ? timesheets[0].date.toISOString().slice(0, 10) : String(timesheets[0].date).slice(0, 10),
        entriesCount: timesheets[0].entries?.length || 0,
        firstEntry: timesheets[0].entries?.[0] ? {
          workplaceId: String(timesheets[0].entries[0].workplaceId),
          workplaceIdType: typeof timesheets[0].entries[0].workplaceId,
          hoursWorked: timesheets[0].entries[0].hoursWorked,
        } : null,
      } : null,
    });

    // ✅ DEBUG: Verifică exact ce tip de date avem în entries
    if (timesheets.length > 0 && timesheets[0].entries && timesheets[0].entries.length > 0) {
      const firstEntry = timesheets[0].entries[0];
      console.log("🔍 [GET /api/pontaj/by-workplace] SAMPLE ENTRY STRUCTURE:", {
        workplaceId: firstEntry.workplaceId,
        workplaceIdType: typeof firstEntry.workplaceId,
        workplaceIdIsObjectId: firstEntry.workplaceId instanceof mongoose.Types.ObjectId,
        workplaceIdConstructor: firstEntry.workplaceId?.constructor?.name,
        workplaceIdString: firstEntry.workplaceId?.toString?.(),
        hoursWorked: firstEntry.hoursWorked,
        status: firstEntry.status,
      });
    }
    
    console.log("🔍 [GET /api/pontaj/by-workplace] TIMESHEETS FROM DB:", {
      totalTimesheets: timesheets.length,
      sampleTimesheets: timesheets.slice(0, 3).map(ts => ({
        _id: String(ts._id),
        employeeId: String(ts.employeeId?._id || ts.employeeId),
        employeeName: ts.employeeName,
        date: ts.date instanceof Date ? ts.date.toISOString().slice(0, 10) : String(ts.date).slice(0, 10),
        entriesCount: ts.entries?.length || 0,
        entries: ts.entries?.slice(0, 2).map(e => {
          const wpId = e.workplaceId;
          let wpIdStr = '';
          if (wpId instanceof mongoose.Types.ObjectId) {
            wpIdStr = wpId.toString();
          } else if (mongoose.Types.ObjectId.isValid(wpId)) {
            wpIdStr = new mongoose.Types.ObjectId(wpId).toString();
          } else {
            wpIdStr = String(wpId);
          }
          return {
            workplaceId: wpIdStr,
            workplaceIdType: typeof wpId,
            workplaceIdIsObjectId: wpId instanceof mongoose.Types.ObjectId,
            workplaceName: e.workplaceName,
            type: e.type,
            hoursWorked: e.hoursWorked,
            status: e.status,
          };
        }) || [],
      })),
    });

    // Transformă timesheet-urile în format compatibil cu frontend-ul
    const entries = [];
    const requestedWpIdStr = workplaceObjectId.toString();
    
    console.log("🔍 [GET /api/pontaj/by-workplace] NORMALIZED WORKPLACE ID:", {
      original: workplaceId,
      normalized: requestedWpIdStr,
      isObjectId: workplaceObjectId instanceof mongoose.Types.ObjectId,
    });
    
    timesheets.forEach((timesheet) => {
      // ✅ Verifică dacă angajatul face parte din farmacia selectată (farmacia lui "home")
      const employeeHomeWorkplaceId = timesheet.employeeId?.workplaceId?._id || timesheet.employeeId?.workplaceId;
      const isEmployeeFromThisWorkplace = employeeHomeWorkplaceId && compareObjectIds(employeeHomeWorkplaceId, workplaceObjectId);
      
      const allEntries = timesheet.entries || [];
      // ✅ Filtrează entries-urile pentru workplaceId-ul cerut
      // Query-ul MongoDB deja a filtrat timesheet-urile, dar trebuie să filtrez entries-urile individuale
      const relevantEntries = allEntries.filter(
        (e) => {
          const entryWpId = e.workplaceId;
          
          if (!entryWpId) {
            return false;
          }
          
          // ✅ Compară folosind funcția helper
          const matches = compareObjectIds(entryWpId, workplaceObjectId);
          
          if (matches) {
            return true;
          }
          
          // Entry de tip "visitor" pentru un angajat care face parte din farmacia selectată
          if (e.type === "visitor" && isEmployeeFromThisWorkplace) {
            return true;
          }
          
          return false;
        }
      );

      // ✅ PREVENIM DUPLICATELE: Dacă există mai multe entries pentru același workplace și tip,
      // păstrăm doar cel mai recent (ultimul) - astfel evităm adunarea orelor
      const uniqueEntries = [];
      const seenKeys = new Set();
      // Parcurgem în ordine inversă pentru a păstra ultimul entry
      for (let i = relevantEntries.length - 1; i >= 0; i--) {
        const entry = relevantEntries[i];
        const key = `${String(entry.workplaceId)}_${entry.type || 'home'}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueEntries.unshift(entry); // Adăugăm la început pentru a păstra ordinea
        }
      }
        
      // ✅ DEBUG: Log pentru timesheet-uri cu entries dar fără entries relevante
      if (allEntries.length > 0 && relevantEntries.length === 0) {
        console.log("⚠️ [GET /api/pontaj/by-workplace] TIMESHEET CU ENTRIES DAR NICIUNUL RELEVANT:", {
          employeeId: String(timesheet.employeeId?._id || timesheet.employeeId),
            employeeName: timesheet.employeeName,
          date: timesheet.date instanceof Date ? timesheet.date.toISOString().slice(0, 10) : String(timesheet.date).slice(0, 10),
          allEntriesCount: allEntries.length,
          allEntries: allEntries.map(e => {
            const wpId = e.workplaceId;
            let wpIdStr = '';
            let comparisonResult = false;
            
            if (wpId instanceof mongoose.Types.ObjectId) {
              wpIdStr = wpId.toString();
              comparisonResult = compareObjectIds(wpId, workplaceObjectId);
            } else if (mongoose.Types.ObjectId.isValid(wpId)) {
              const wpIdObj = new mongoose.Types.ObjectId(wpId);
              wpIdStr = wpIdObj.toString();
              comparisonResult = compareObjectIds(wpIdObj, workplaceObjectId);
            } else {
              wpIdStr = String(wpId);
              comparisonResult = compareObjectIds(wpId, workplaceObjectId);
            }
            
            return {
              workplaceId: wpIdStr,
              workplaceIdType: typeof wpId,
              workplaceIdIsObjectId: wpId instanceof mongoose.Types.ObjectId,
              comparisonResult: comparisonResult,
            requestedWpId: requestedWpIdStr,
              workplaceName: e.workplaceName,
              type: e.type,
            hoursWorked: e.hoursWorked,
              status: e.status,
            };
          }),
          requestedWpId: requestedWpIdStr,
          requestedWpIdObjectId: workplaceObjectId instanceof mongoose.Types.ObjectId,
        });
      }
      
      // ✅ DEBUG: Log pentru TOATE timesheet-urile (nu doar cele cu entries relevante)
      // Astfel putem vedea exact ce se întâmplă cu fiecare timesheet
      console.log("🔍 [GET /api/pontaj/by-workplace] PROCESSING TIMESHEET:", {
        employeeId: String(timesheet.employeeId?._id || timesheet.employeeId),
          employeeName: timesheet.employeeName,
        date: timesheet.date instanceof Date ? timesheet.date.toISOString().slice(0, 10) : String(timesheet.date).slice(0, 10),
        allEntriesCount: allEntries.length,
        relevantEntriesCount: relevantEntries.length,
        employeeHomeWorkplaceId: employeeHomeWorkplaceId ? String(employeeHomeWorkplaceId) : null,
        isEmployeeFromThisWorkplace: isEmployeeFromThisWorkplace,
        requestedWorkplaceId: requestedWpIdStr,
        allEntries: allEntries.map(e => ({
          workplaceId: String(e.workplaceId),
          workplaceName: e.workplaceName,
          type: e.type,
            hoursWorked: e.hoursWorked,
          status: e.status,
          matches: compareObjectIds(e.workplaceId, workplaceObjectId),
        })),
        relevantEntries: relevantEntries.map(e => ({
          workplaceId: String(e.workplaceId),
          workplaceName: e.workplaceName,
          type: e.type,
          hoursWorked: e.hoursWorked,
          status: e.status,
        })),
        });
      

      // ✅ CRITIC: Folosim dateString direct din timesheet pentru a evita problemele cu timezone
      // Nu calculăm din timesheet.date pentru că poate fi afectat de timezone și poate da date greșite
      const dateStr = timesheet.dateString || (timesheet.date ? timesheet.date.toISOString().slice(0, 10) : '');
      
      // ✅ Verificare: dacă dateStr este gol sau invalid, logăm eroarea
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        console.error("⚠️ [GET /api/pontaj/by-workplace] TIMESHEET FĂRĂ DATĂ VALIDĂ:", {
          timesheetId: String(timesheet._id),
          employeeId: String(timesheet.employeeId?._id || timesheet.employeeId),
          dateString: timesheet.dateString,
          date: timesheet.date,
          calculatedDateStr: dateStr,
        });
      }

      // ✅ Folosim uniqueEntries pentru a evita duplicatele
      uniqueEntries.forEach((entry) => {
        // ✅ Normalizează workplaceId pentru răspuns (convertește ObjectId la string)
        // CU .lean(), workplaceId este direct ObjectId
        let wpId = entry.workplaceId;
        if (wpId) {
          if (wpId instanceof mongoose.Types.ObjectId) {
            wpId = wpId.toString();
          } else if (mongoose.Types.ObjectId.isValid(wpId)) {
            wpId = new mongoose.Types.ObjectId(wpId).toString();
          } else {
            wpId = String(wpId);
          }
        } else {
          wpId = '';
        }
        
        const entryData = {
          _id: timesheet._id, // ID-ul timesheet-ului
          // ✅ Informații angajat (denormalizate)
          employeeId: timesheet.employeeId,
          employeeName: timesheet.employeeName, // ✅ Denormalizat
          // ✅ Informații farmacie (denormalizate)
          workplaceId: wpId,
          workplaceName: entry.workplaceName, // ✅ Denormalizat
          // ✅ Informații timp
          date: dateStr, // ✅ String "YYYY-MM-DD" pentru potrivire corectă cu frontend-ul
          startTime: entry.startTime, // ✅ Ora intrare
          endTime: entry.endTime, // ✅ Ora ieșire
          // ✅ Informații ore lucrate
          hoursWorked: entry.hoursWorked,
          minutesWorked: entry.minutesWorked, // ✅ Minute lucrate
          // ✅ Alte informații
          leaveType: entry.leaveType,
          status: entry.status || null, // ✅ Status: "prezent", "garda", "concediu", "liber", "medical"
          notes: entry.notes,
          type: entry.type, // "home" sau "visitor"
          // ✅ Informații suplimentare
          totalHours: timesheet.totalHours,
          totalMinutes: timesheet.totalMinutes,
          entriesCount: timesheet.entries.length,
        };
        
        entries.push(entryData);
      });
    });

    // ✅ CRITIC: Deduplicare finală pentru a preveni duplicatele
    // Grupăm după employeeId + date + workplaceId + type pentru a evita duplicatele
    const finalEntries = [];
    const finalSeenKeys = new Set();
    
    entries.forEach(entry => {
      const empId = String(entry.employeeId?._id || entry.employeeId);
      const dateKey = entry.date || '';
      const wpIdKey = String(entry.workplaceId || '');
      const typeKey = entry.type || 'home';
      
      // ✅ Cheie unică pentru deduplicare
      const uniqueKey = `${empId}_${dateKey}_${wpIdKey}_${typeKey}`;
      
      if (!finalSeenKeys.has(uniqueKey)) {
        finalSeenKeys.add(uniqueKey);
        finalEntries.push(entry);
      } else {
        console.warn("⚠️ [GET /api/pontaj/by-workplace] DUPLICATE ENTRY FILTERED:", {
          employeeId: empId,
          employeeName: entry.employeeName,
          date: dateKey,
          workplaceId: wpIdKey,
          type: typeKey,
          hoursWorked: entry.hoursWorked,
        });
      }
    });

    // ✅ DEBUG: Grupează entries după angajat pentru a vedea câte entries are fiecare
    const entriesByEmployee = {};
    finalEntries.forEach(e => {
      const empId = String(e.employeeId?._id || e.employeeId);
      if (!entriesByEmployee[empId]) {
        entriesByEmployee[empId] = {
          name: e.employeeName,
          entries: [],
          totalHours: 0,
        };
      }
      entriesByEmployee[empId].entries.push({
        date: e.date,
        hoursWorked: e.hoursWorked,
        status: e.status,
        type: e.type,
        _id: e._id,
      });
      entriesByEmployee[empId].totalHours += Number(e.hoursWorked) || 0;
    });

    console.log("✅ [GET /api/pontaj/by-workplace] RETURNING ENTRIES:", {
      workplaceId: requestedWpIdStr,
      totalEntriesBeforeDedup: entries.length,
      totalEntriesAfterDedup: finalEntries.length,
      duplicatesFiltered: entries.length - finalEntries.length,
      entriesByEmployee: Object.keys(entriesByEmployee).map(empId => ({
        employeeId: empId,
        employeeName: entriesByEmployee[empId].name,
        entriesCount: entriesByEmployee[empId].entries.length,
        totalHours: Math.round(entriesByEmployee[empId].totalHours),
        sampleEntries: entriesByEmployee[empId].entries.slice(0, 3),
      })),
      sampleEntries: finalEntries.slice(0, 5).map(e => ({
        _id: String(e._id),
        employeeId: String(e.employeeId?._id || e.employeeId),
        employeeName: e.employeeName,
        date: e.date,
        workplaceId: e.workplaceId,
        hoursWorked: e.hoursWorked,
        status: e.status,
        type: e.type,
      })),
    });

    res.json(finalEntries);
  } catch (err) {
    console.error("❌ GET PONTAJ ERROR:", err);
    res
      .status(500)
      .json({ error: "Eroare încărcare pontaj", details: err.message });
  }
});

// ✅ NOU: Endpoint optimizat pentru toate farmaciile într-un singur request
// /api/pontaj/all-workplaces?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/pontaj/all-workplaces", async (req, res) => {
  try {
    const { from, to } = req.query;

    // Construiește filter pentru date
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.$gte = parseLocalDayStart(from);
      if (to) dateFilter.date.$lte = parseLocalDayEnd(to);
    }

    // ✅ Optimizare: folosim lean() și selectăm doar câmpurile necesare
    // Nu mai avem nevoie de $or complex - luăm toate timesheet-urile din perioada respectivă
    const timesheets = await Timesheet.find(dateFilter)
      .select("employeeId employeeName date entries totalHours totalMinutes")
      .populate("employeeId", "name function monthlyTargetHours email workplaceId")
      .lean()
      .sort({ date: 1 });

    // Transformă timesheet-urile în format compatibil cu frontend-ul
    const entries = [];
    timesheets.forEach((timesheet) => {
      // Normalizăm data
      let normalizedDate = timesheet.date;
      if (!(normalizedDate instanceof Date)) {
        normalizedDate = new Date(normalizedDate);
      }
      
      const year = normalizedDate.getFullYear();
      const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
      const day = String(normalizedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Adăugăm toate entry-urile
      timesheet.entries.forEach((entry) => {
        const wpId = entry.workplaceId?._id || entry.workplaceId;
        
        entries.push({
          _id: timesheet._id,
          employeeId: timesheet.employeeId,
          employeeName: timesheet.employeeName,
          workplaceId: wpId,
          workplaceName: entry.workplaceName,
          date: dateStr,
          startTime: entry.startTime,
          endTime: entry.endTime,
          hoursWorked: entry.hoursWorked,
          minutesWorked: entry.minutesWorked,
          leaveType: entry.leaveType,
          status: entry.status || null, // ✅ Status: "prezent", "garda", "concediu", "liber", "medical"
          notes: entry.notes,
          type: entry.type,
          totalHours: timesheet.totalHours,
          totalMinutes: timesheet.totalMinutes,
          entriesCount: timesheet.entries.length,
        });
      });
    });

    res.json(entries);
  } catch (err) {
    console.error("❌ GET PONTAJ ALL WORKPLACES ERROR:", err);
    res
      .status(500)
      .json({ error: "Eroare încărcare pontaj", details: err.message });
  }
});

// ✅ NOU: Endpoint pentru statistici agregate (optimizat pentru 250+ angajați)
// /api/pontaj/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&workplaceId=xxx (optional)
// Returnează statisticile calculate direct în MongoDB, nu toate timesheet-urile
// ✅ Ștergere pontaj pentru un angajat într-o anumită dată
app.delete("/api/pontaj", async (req, res) => {
  try {
    const { employeeId, date } = req.query;

    if (!employeeId || !date) {
      return res.status(400).json({ error: "employeeId și date sunt obligatorii" });
    }

    const dayStart = parseLocalDayStart(date);
    const dayEnd = parseLocalDayEnd(date);

    // Găsește timesheet-ul pentru angajat și dată
    const timesheet = await Timesheet.findOne({
      employeeId,
      date: { $gte: dayStart, $lte: dayEnd },
    });

    if (!timesheet) {
      return res.status(404).json({ error: "Pontajul nu a fost găsit" });
    }

    // Șterge timesheet-ul complet
    await timesheet.deleteOne();

    console.log(`🗑️  Pontaj șters: ${timesheet.employeeName} (${date})`);
    // Obține informații pentru log
    const userInfo = await getUserInfoForLog(req);
    const workplaceName = await getWorkplaceName(timesheet.workplaceId);
    
    logger.info("Timesheet deleted", {
      employeeId: String(timesheet.employeeId),
      employeeName: timesheet.employeeName,
      workplaceId: String(timesheet.workplaceId),
      workplaceName: workplaceName,
      date,
      ...userInfo
    });
    res.json({ message: "Pontaj șters cu succes" });
  } catch (err) {
    console.error("❌ DELETE PONTAJ ERROR:", err);
    logger.error("Delete pontaj error", err, { employeeId, date });
    res.status(500).json({ error: "Eroare ștergere pontaj", details: err.message });
  }
});

app.get("/api/pontaj/stats", async (req, res) => {
  try {
    const { from, to, workplaceId } = req.query;

    // Construiește filter pentru date
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.$gte = parseLocalDayStart(from);
      if (to) dateFilter.date.$lte = parseLocalDayEnd(to);
    }

    // ✅ Agregare MongoDB pentru calcularea statisticilor direct în baza de date
    // Aceasta este mult mai rapidă decât să returnăm toate timesheet-urile și să le procesăm în frontend
    const pipeline = [
      // Match timesheet-urile din perioada respectivă
      { $match: dateFilter },
      
      // Unwind entries pentru a procesa fiecare entry separat
      { $unwind: "$entries" },
      
      // Filtrare pe workplace dacă este specificat
      ...(workplaceId ? [
        {
          $match: {
            $or: [
              { "entries.workplaceId": new mongoose.Types.ObjectId(workplaceId) },
              { "entries.type": "visitor" } // Include și vizitatorii pentru farmacia selectată
            ]
          }
        }
      ] : []),
      
      // Lookup pentru a obține informații despre angajat
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee"
        }
      },
      { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
      
      // Grupare pe angajat pentru a calcula totalurile
      {
        $group: {
          _id: "$employeeId",
          employeeName: { $first: "$employeeName" },
          employeeData: { $first: "$employee" },
          totalHours: { $sum: "$entries.hoursWorked" },
          totalMinutes: { $sum: "$entries.minutesWorked" },
          visitorHours: {
            $sum: {
              $cond: [
                { $eq: ["$entries.type", "visitor"] },
                "$entries.hoursWorked",
                0
              ]
            }
          }
        }
      },
      
      // Proiecție finală
      {
        $project: {
          _id: 0,
          employeeId: "$_id",
          employeeName: 1,
          workplaceId: { $ifNull: ["$employeeData.workplaceId", null] },
          monthlyTargetHours: { $ifNull: ["$employeeData.monthlyTargetHours", 160] },
          totalHours: { $round: ["$totalHours", 1] },
          totalMinutes: { $round: ["$totalMinutes", 0] },
          visitorHours: { $round: ["$visitorHours", 1] }
        }
      },
      
      // Sortare după nume
      { $sort: { employeeName: 1 } }
    ];

    const stats = await Timesheet.aggregate(pipeline);
    
    // ✅ DEBUG: Verifică câți angajați sunt în stats vs câți sunt activi
    const uniqueEmployeeIds = [...new Set(stats.map(s => String(s.employeeId)))];
    const activeEmployeesCount = await Employee.countDocuments({ isActive: true });
    const totalEmployeesCount = await Employee.countDocuments({});
    
    console.log("🔍 [GET /api/pontaj/stats] STATISTICI:", {
      statsCount: stats.length,
      uniqueEmployeeIdsInStats: uniqueEmployeeIds.length,
      activeEmployeesInDB: activeEmployeesCount,
      totalEmployeesInDB: totalEmployeesCount,
      inactiveEmployeesInDB: totalEmployeesCount - activeEmployeesCount,
      sampleStats: stats.slice(0, 5).map(s => ({
        employeeId: String(s.employeeId),
        employeeName: s.employeeName,
        totalHours: s.totalHours,
      })),
    });

    res.json(stats);
  } catch (err) {
    console.error("❌ GET PONTAJ STATS ERROR:", err);
    res
      .status(500)
      .json({ error: "Eroare calculare statistici", details: err.message });
  }
});

// ✅ NOU: /api/employees/:id/timesheet?month=YYYY-MM
// Returnează timesheet-urile unui angajat pentru o lună, cu breakdown pe farmacii
app.get("/api/employees/:id/timesheet", async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query; // format: "YYYY-MM"

    if (!month) {
      return res.status(400).json({ error: "Parametrul 'month' este obligatoriu (format: YYYY-MM)" });
    }

    const [year, monthNum] = month.split("-").map(Number);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: "Format invalid pentru 'month'. Folosește YYYY-MM" });
    }

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // Găsește toate timesheet-urile pentru angajat în luna respectivă
    const timesheets = await Timesheet.find({
      employeeId: id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("employeeId", "name function monthlyTargetHours email workplaceId")
      .populate("entries.workplaceId", "name")
      .sort({ date: 1 });

    // Calculează agregări
    let totalHours = 0;
    let totalMinutes = 0;
    const breakdown = {}; // { workplaceId: { hours, days, workplaceName } }

    timesheets.forEach((timesheet) => {
      totalHours += timesheet.totalHours || 0;
      totalMinutes += timesheet.totalMinutes || 0;

      timesheet.entries.forEach((entry) => {
        const wpId = String(entry.workplaceId?._id || entry.workplaceId);
        const wpName = entry.workplaceId?.name || "Necunoscut";

        if (!breakdown[wpId]) {
          breakdown[wpId] = {
            workplaceId: wpId,
            workplaceName: wpName,
            hours: 0,
            minutes: 0,
            days: 0,
            type: entry.type, // "home" sau "visitor"
          };
        }

        breakdown[wpId].hours += entry.hoursWorked || 0;
        breakdown[wpId].minutes += entry.minutesWorked || 0;
        breakdown[wpId].days += 1;
      });
    });

    // Convertim breakdown din object în array
    const breakdownArray = Object.values(breakdown);

    res.json({
      employeeId: id,
      month,
      totalHours: Math.round(totalHours * 100) / 100,
      totalMinutes,
      breakdown: breakdownArray,
      timesheets: timesheets.map((ts) => ({
        date: ts.date,
        totalHours: ts.totalHours,
        totalMinutes: ts.totalMinutes,
        entries: ts.entries,
        isComplete: ts.isComplete,
      })),
    });
  } catch (err) {
    console.error("❌ GET EMPLOYEE TIMESHEET ERROR:", err);
    res.status(500).json({
      error: "Eroare încărcare timesheet angajat",
      details: err.message,
    });
  }
});

/* ==========================
   MONTHLY SCHEDULE (PLANIFICARE)
   ========================== */

// GET: încarcă planificarea pentru o lună
app.get("/api/schedule/:workplaceId/:year/:month", async (req, res) => {
  try {
    const { workplaceId, year, month } = req.params;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (!workplaceId || !yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: "Parametri invalizi" });
    }

    let workplaceObjectId;
    try {
      workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);
    } catch (err) {
      return res.status(400).json({ error: "ID farmacie invalid" });
    }

    const schedule = await MonthlySchedule.findOne({
      workplaceId: workplaceObjectId,
      year: yearNum,
      month: monthNum,
    });

    if (!schedule) {
      return res.json({ schedule: {} }); // Returnează obiect gol dacă nu există
    }

    res.json({ schedule: schedule.schedule || {} });
  } catch (err) {
    console.error("❌ GET SCHEDULE ERROR:", err);
    res.status(500).json({ error: "Eroare încărcare planificare", details: err.message });
  }
});

// POST: salvează planificarea pentru o lună
app.post("/api/schedule", async (req, res) => {
  try {
    const { workplaceId, year, month, schedule } = req.body;

    if (!workplaceId || !year || !month || typeof schedule !== "object") {
      return res.status(400).json({ error: "Date invalide" });
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (!yearNum || !monthNum || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: "An sau lună invalidă" });
    }

    let workplaceObjectId;
    try {
      workplaceObjectId = new mongoose.Types.ObjectId(workplaceId);
    } catch (err) {
      return res.status(400).json({ error: "ID farmacie invalid" });
    }

    // Upsert: actualizează dacă există, creează dacă nu
    const result = await MonthlySchedule.findOneAndUpdate(
      {
        workplaceId: workplaceObjectId,
        year: yearNum,
        month: monthNum,
      },
      {
        workplaceId: workplaceObjectId,
        year: yearNum,
        month: monthNum,
        schedule: schedule || {},
      },
      {
        upsert: true,
        new: true,
      }
    );

    res.json({ message: "Planificare salvată cu succes", schedule: result.schedule });
  } catch (err) {
    console.error("❌ POST SCHEDULE ERROR:", err);
    res.status(500).json({ error: "Eroare salvare planificare", details: err.message });
  }
});

/* ==========================
   FILES (MESAJE MANAGER → ADMINI FARMACII)
   ========================== */

// ✅ Feature-ul de fișiere - poate fi dezactivat prin ENABLE_FILE_FEATURE=false
if (process.env.ENABLE_FILE_FEATURE !== "false") {
  try {
    const filesRouter = require("./routes/files");
    app.use("/api/files", filesRouter);
    console.log("✅ File feature enabled");
    logger.info("File feature enabled");
  } catch (err) {
    console.error("⚠️ File feature initialization error:", err.message);
    logger.error("File feature initialization error", err);
    // Nu oprește serverul dacă feature-ul de fișiere eșuează
  }
} else {
  console.log("⚠️ File feature disabled (ENABLE_FILE_FEATURE=false)");
}

/* ==========================
   ERROR HANDLER GLOBAL (Express)
   ========================== */
// Middleware pentru erori neprinse din route handlers
app.use((err, req, res, next) => {
  // Loghează eroarea cu detalii despre request
  logger.error("Unhandled Express error", err, {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    body: req.body && typeof req.body === 'object' ? JSON.stringify(req.body).substring(0, 500) : req.body, // Limitează la 500 caractere
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip || req.connection?.remoteAddress,
  });
  
  // Răspunde cu eroare generică (nu expune detalii în producție)
  res.status(err.status || 500).json({
    error: err.message || "Eroare internă server",
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Handler pentru rute inexistente (404)
app.use((req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
  });
  res.status(404).json({ error: "Rută inexistentă" });
});

/* ==========================
   ERROR HANDLERS GLOBAL (Process)
   ========================== */
// Prinde erori neprinse din cod sincron (ex: ReferenceError, TypeError)
process.on('uncaughtException', (err) => {
  logger.error("Uncaught Exception - Eroare critică neprinsă", err, {
    type: 'uncaughtException',
    fatal: true,
  });
  
  // Loghează și în console pentru vizibilitate imediată
  console.error('💥 UNCAUGHT EXCEPTION - Serverul va continua să ruleze, dar eroarea a fost loggată:', err);
  
  // Nu oprim serverul - doar logăm (pentru producție, poți decide să oprești)
  // process.exit(1); // Decomentează dacă vrei să oprești serverul la erori critice
});

// Prinde Promise-uri respinse fără catch
process.on('unhandledRejection', (reason, promise) => {
  logger.error("Unhandled Promise Rejection", reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'unhandledRejection',
    promise: promise?.toString?.() || 'unknown',
  });
  
  // Loghează și în console pentru vizibilitate imediată
  console.error('💥 UNHANDLED REJECTION - Promise respinsă fără catch:', reason);
});

/* ==========================
   START SERVER
   ========================== */
app.listen(PORT, () => {
  console.log(`✅ Server pornit corect pe portul ${PORT}`);
  logger.info(`Server started on port ${PORT}`);
  
  // Pornește backup scheduler dacă este activat
  if (process.env.ENABLE_BACKUP_SCHEDULER === "true" || process.env.ENABLE_BACKUP_SCHEDULER === "1") {
    try {
      const cron = require("node-cron");
    const { exec } = require("child_process");
    const path = require("path");
    const fs = require("fs");
    
    // Creează directorul pentru log-uri dacă nu există
    const logsDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Funcție pentru logare
    const logMessage = (message) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      const logFile = path.join(logsDir, "backup-scheduler.log");
      fs.appendFileSync(logFile, logMessage, "utf8");
      console.log(`[Backup Scheduler] ${message}`);
    };
    
    // Funcție pentru rularea backup-ului
    const runBackup = () => {
      logMessage("🔄 Pornire backup automat...");
      const scriptPath = path.join(__dirname, "scripts", "backup-to-google-sheets.js");
      
      exec(`node "${scriptPath}"`, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
          logMessage(`❌ Eroare la backup: ${error.message}`);
          if (stderr) {
            logMessage(`   Detalii: ${stderr}`);
          }
          return;
        }
        
        if (stdout) {
          const lines = stdout.split("\n").filter(line => line.trim());
          lines.forEach(line => logMessage(`   ${line}`));
        }
        
        logMessage("✅ Backup automat finalizat");
      });
    };
    
    // Programează backup-ul zilnic la 00:00 (ora 12 noaptea)
    const schedule = process.env.BACKUP_SCHEDULE || "0 0 * * *";
    
    logMessage(`📅 Backup scheduler activat`);
    logMessage(`   Program: zilnic la 00:00 (${schedule})`);
    logMessage(`   Timezone: Europe/Bucharest`);
    
    // Programează task-ul
    cron.schedule(schedule, () => {
      runBackup();
    }, {
      scheduled: true,
      timezone: "Europe/Bucharest"
    });
    
    // Rulează backup-ul imediat la pornire dacă este setat
    if (process.env.RUN_BACKUP_ON_START === "true" || process.env.RUN_BACKUP_ON_START === "1") {
      logMessage("🚀 Rulare backup la pornire...");
      runBackup();
    }
    } catch (err) {
      console.error("❌ Eroare la pornirea backup scheduler:", err.message);
      logger.error("Backup scheduler error", err);
      // Nu oprește serverul dacă scheduler-ul nu pornește
    }
  }
});
