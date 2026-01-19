const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Creează directorul pentru log-uri dacă nu există
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Funcție pentru logare
const logMessage = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  const logFile = path.join(logsDir, "backup-scheduler.log");
  
  // Scrie în fișier
  fs.appendFileSync(logFile, logMessage, "utf8");
  
  // Afișează în consolă
  console.log(logMessage.trim());
};

// Funcție pentru rularea backup-ului
const runBackup = () => {
  logMessage("🔄 Pornire backup automat...");
  
  const scriptPath = path.join(__dirname, "backup-to-google-sheets.js");
  
  exec(`node "${scriptPath}"`, { cwd: path.join(__dirname, "..") }, (error, stdout, stderr) => {
    if (error) {
      logMessage(`❌ Eroare la backup: ${error.message}`);
      if (stderr) {
        logMessage(`   Detalii: ${stderr}`);
      }
      return;
    }
    
    if (stdout) {
      // Loghează output-ul
      const lines = stdout.split("\n").filter(line => line.trim());
      lines.forEach(line => logMessage(`   ${line}`));
    }
    
    logMessage("✅ Backup automat finalizat");
  });
};

// Verifică dacă scheduler-ul este activat
const ENABLE_SCHEDULER = process.env.ENABLE_BACKUP_SCHEDULER === "true" || 
                         process.env.ENABLE_BACKUP_SCHEDULER === "1";

if (!ENABLE_SCHEDULER) {
  console.log("ℹ️  Backup scheduler este dezactivat. Setează ENABLE_BACKUP_SCHEDULER=true în .env pentru a-l activa.");
  process.exit(0);
}

// Programează backup-ul zilnic la 00:00 (ora 12 noaptea)
// Format cron: minute hour day month dayOfWeek
// "0 0 * * *" = la fiecare zi la 00:00
const schedule = process.env.BACKUP_SCHEDULE || "0 0 * * *";

logMessage(`📅 Backup scheduler activat`);
logMessage(`   Program: zilnic la 00:00 (${schedule})`);
logMessage(`   Prima rulare va fi la următoarea oră programată`);

// Programează task-ul
const task = cron.schedule(schedule, () => {
  runBackup();
}, {
  scheduled: true,
  timezone: "Europe/Bucharest" // Timezone pentru România
});

// Rulează backup-ul imediat la pornire dacă este setat
if (process.env.RUN_BACKUP_ON_START === "true" || process.env.RUN_BACKUP_ON_START === "1") {
  logMessage("🚀 Rulare backup la pornire...");
  runBackup();
}

// Gestionează oprirea curată
process.on("SIGINT", () => {
  logMessage("🛑 Oprire scheduler...");
  task.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logMessage("🛑 Oprire scheduler...");
  task.stop();
  process.exit(0);
});

// Păstrează procesul activ
logMessage("✅ Scheduler pornit și așteaptă programarea...");

