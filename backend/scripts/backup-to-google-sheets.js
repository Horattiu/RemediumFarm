const mongoose = require("mongoose");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Conectare MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/remedium";
mongoose.connect(MONGODB_URI);

// Import modele
const Employee = require("../models/Employee");
const Leave = require("../models/Leave");
const Timesheet = require("../models/Timesheet");
const Workplace = require("../models/Workplace");
const User = require("../models/User");
const MonthlySchedule = require("../models/MonthlySchedule");

// Configurare Google Sheets API
const credentialsPath = path.join(__dirname, "..", "google-drive-credentials.json");
const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ID-ul spreadsheet-ului (poate fi setat în .env, ca argument sau hardcodat)
const SPREADSHEET_ID = process.argv[2] || process.env.GOOGLE_SHEETS_ID || "";

// Funcție helper pentru a formata header-ul (primul rând) cu fundal albastru
async function formatHeaderRow(spreadsheetId, sheetName) {
  try {
    // Obține informații despre spreadsheet pentru a găsi sheet ID-ul
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    const sheet = spreadsheet.data.sheets.find((s) => s.properties.title === sheetName);
    if (!sheet) {
      console.warn(`⚠️ Sheet "${sheetName}" nu a fost găsit pentru formatare`);
      return;
    }

    const sheetId = sheet.properties.sheetId;

    // Obține numărul de coloane din sheet (sau folosește un număr mare)
    const columnCount = sheet.properties.gridProperties?.columnCount || 100;

    // Formatează primul rând (header) cu fundal albastru și text bold/alb
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.6,
                    blue: 1.0,
                    alpha: 1.0,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 1.0,
                      alpha: 1.0,
                    },
                    bold: true,
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
        ],
      },
    });

    console.log(`   🎨 Header formatat pentru "${sheetName}"`);
  } catch (err) {
    console.warn(`⚠️ Nu s-a putut formata header-ul pentru "${sheetName}":`, err.message);
  }
}

async function backupToGoogleSheets() {
  try {
    console.log("🔄 Încep backup-ul în Google Sheets...");

    if (!SPREADSHEET_ID) {
      console.error("❌ Eroare: ID-ul spreadsheet-ului nu este setat!");
      console.log("\n📝 Utilizare:");
      console.log("   node scripts/backup-to-google-sheets.js <SPREADSHEET_ID>");
      console.log("   SAU");
      console.log("   Setează GOOGLE_SHEETS_ID în fișierul .env");
      console.log("\n💡 Pentru a obține ID-ul spreadsheet-ului:");
      console.log("   1. Deschide spreadsheet-ul în Google Sheets");
      console.log("   2. ID-ul este în URL: https://docs.google.com/spreadsheets/d/<ID>/edit");
      process.exit(1);
    }

    console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID.substring(0, 20)}...`);
    console.log(`🔄 Backup-ul va șterge datele vechi și va scrie doar datele existente în MongoDB`);

    // Numele sheet-urilor trebuie să fie EXACT ca numele colecțiilor din MongoDB
    const requiredSheets = ["Employee", "Leave", "Timesheet", "Workplace", "User", "MonthlySchedule"];

    // Verifică și creează sheet-uri dacă nu există (ÎNAINTE de a scrie datele)
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const existingSheets = spreadsheet.data.sheets.map((s) => s.properties.title);

      for (const sheetName of requiredSheets) {
        if (!existingSheets.includes(sheetName)) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName,
                    },
                  },
                },
              ],
            },
          });
          console.log(`✅ Sheet "${sheetName}" creat`);
        }
      }

      // Șterge sheet-urile duplicate/vechi dacă există
      const sheetsToDelete = [];
      spreadsheet.data.sheets.forEach((sheet) => {
        const title = sheet.properties.title;
        // Șterge sheet-urile vechi care nu mai sunt necesare
        if (["Angajati", "Employees", "Concedii", "Leaves", "Pontaj", "Timesheets", "Farmacii", "Workplaces"].includes(title)) {
          sheetsToDelete.push(sheet.properties.sheetId);
        }
      });

      if (sheetsToDelete.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: sheetsToDelete.map(sheetId => ({
              deleteSheet: { sheetId }
            })),
          },
        });
        console.log(`🗑️  Șterse ${sheetsToDelete.length} sheet-uri duplicate/vechi`);
      }
    } catch (err) {
      console.warn("⚠️ Nu s-au putut verifica/crea sheet-urile:", err.message);
    }

    // 1. Backup Employee (exact ca numele colecției)
    console.log("📋 Export Employee...");
    const employees = await Employee.find()
      .populate("workplaceId", "name")
      .lean();
    
    const employeesData = [
      ["ID", "Nume", "Email", "Funcție", "Farmacie (Nume)", "Workplace ID", "Target Ore Lunar", "Is Active", "Data Creării", "Data Actualizării"]
    ];
    
    employees.forEach((emp) => {
      employeesData.push([
        emp._id.toString(),
        emp.name || "",
        emp.email || "",
        emp.function || "",
        emp.workplaceId?.name || "", // Nume farmacie
        emp.workplaceId?._id?.toString() || emp.workplaceId?.toString() || "", // ID farmacie
        emp.monthlyTargetHours?.toString() || "160",
        emp.isActive ? "Da" : "Nu",
        emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("ro-RO") : "",
        emp.updatedAt ? new Date(emp.updatedAt).toLocaleDateString("ro-RO") : "",
      ]);
    });

    // Șterge TOATE datele vechi din sheet
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Employee!A1:ZZ10000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    const resultEmployees = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Employee!A1",
      valueInputOption: "RAW",
      resource: { values: employeesData },
    });

    console.log(`✅ ${employees.length} angajați exportați`);
    console.log(`   📊 Celule actualizate: ${resultEmployees.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru
    await formatHeaderRow(SPREADSHEET_ID, "Employee");

    // 2. Backup Leave (exact ca numele colecției)
    console.log("📋 Export Leave...");
    const leaves = await Leave.find()
      .populate("employeeId", "name isActive") // Include și isActive pentru a verifica starea employee-ului
      .populate("workplaceId", "name")
      .populate("createdBy", "name")
      .lean();
    
    const leavesData = [
      ["ID", "Angajat (Nume)", "Employee ID", "Employee Is Active", "Farmacie (Nume)", "Workplace ID", "Funcție", "Tip", "Data Început", "Data Sfârșit", "Zile", "Status", "Motiv", "Nume Șef Direct", "Created By (Nume)", "Created By ID", "Data Creării", "Data Actualizării"]
    ];
    
    leaves.forEach((leave) => {
      // Verifică dacă employee-ul asociat este activ
      const employeeIsActive = leave.employeeId?.isActive !== false ? "Da" : "Nu";
      
      leavesData.push([
        leave._id.toString(),
        leave.employeeId?.name || leave.name || "", // Nume angajat
        leave.employeeId?._id?.toString() || leave.employeeId?.toString() || "", // ID angajat
        employeeIsActive, // Is Active bazat pe employee-ul asociat
        leave.workplaceId?.name || "", // Nume farmacie
        leave.workplaceId?._id?.toString() || leave.workplaceId?.toString() || "", // ID farmacie
        leave.function || "",
        leave.type || "",
        leave.startDate ? new Date(leave.startDate).toLocaleDateString("ro-RO") : "",
        leave.endDate ? new Date(leave.endDate).toLocaleDateString("ro-RO") : "",
        leave.days?.toString() || "",
        leave.status || "",
        leave.reason || "",
        leave.directSupervisorName || "",
        leave.createdBy?.name || "", // Nume user care a creat
        leave.createdBy?._id?.toString() || leave.createdBy?.toString() || "", // ID user
        leave.createdAt ? new Date(leave.createdAt).toLocaleDateString("ro-RO") : "",
        leave.updatedAt ? new Date(leave.updatedAt).toLocaleDateString("ro-RO") : "",
      ]);
    });

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Leave!A1:ZZ10000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    const resultLeaves = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Leave!A1",
      valueInputOption: "RAW",
      resource: { values: leavesData },
    });

    console.log(`✅ ${leaves.length} concedii exportate`);
    console.log(`   📊 Celule actualizate: ${resultLeaves.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru
    await formatHeaderRow(SPREADSHEET_ID, "Leave");

    // 3. Backup Timesheet (exact ca numele colecției)
    console.log("📋 Export Timesheet...");
    const timesheets = await Timesheet.find()
      .populate("employeeId", "name isActive") // Include și isActive pentru a verifica starea employee-ului
      .sort({ date: -1 })
      .lean();
    
    console.log(`   📊 Găsite ${timesheets.length} înregistrări pontaj în baza de date`);
    
    const timesheetsData = [
      ["ID", "Angajat (Nume)", "Employee ID", "Employee Is Active", "Data", "Ore Totale", "Minute Totale", "Entry-uri Count", "Is Complete", "Data Creării", "Data Actualizării"]
    ];
    
    // Pentru volume mari, procesăm în batch-uri pentru a evita probleme de memorie
    const BATCH_SIZE = 1000;
    let processedCount = 0;
    
    for (let i = 0; i < timesheets.length; i += BATCH_SIZE) {
      const batch = timesheets.slice(i, i + BATCH_SIZE);
      batch.forEach((ts) => {
        // Verifică dacă employee-ul asociat este activ
        const employeeIsActive = ts.employeeId?.isActive !== false ? "Da" : "Nu";
        
        timesheetsData.push([
          ts._id.toString(),
          ts.employeeId?.name || ts.employeeName || "", // Nume angajat
          ts.employeeId?._id?.toString() || ts.employeeId?.toString() || "", // ID angajat
          employeeIsActive, // Is Active bazat pe employee-ul asociat
          ts.date ? new Date(ts.date).toLocaleDateString("ro-RO") : "",
          ts.totalHours?.toString() || "0",
          ts.totalMinutes?.toString() || "0",
          ts.entries?.length?.toString() || "0",
          ts.isComplete ? "Da" : "Nu",
          ts.createdAt ? new Date(ts.createdAt).toLocaleDateString("ro-RO") : "",
          ts.updatedAt ? new Date(ts.updatedAt).toLocaleDateString("ro-RO") : "",
        ]);
      });
      processedCount += batch.length;
      if (processedCount % 5000 === 0) {
        console.log(`   ⏳ Procesat ${processedCount}/${timesheets.length} înregistrări...`);
      }
    }

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Timesheet!A1:ZZ100000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    console.log(`   📝 Scriere ${timesheetsData.length} rânduri în Google Sheets...`);
    
    const resultTimesheets = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Timesheet!A1",
      valueInputOption: "RAW",
      resource: { values: timesheetsData },
    });

    console.log(`✅ ${timesheets.length} înregistrări pontaj exportate`);
    console.log(`   📊 Celule actualizate: ${resultTimesheets.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru
    await formatHeaderRow(SPREADSHEET_ID, "Timesheet");

    // 4. Backup Workplace (exact ca numele colecției)
    console.log("📋 Export Workplace...");
    const workplaces = await Workplace.find().lean();
    
    const workplacesData = [
      ["ID", "Nume", "Code", "Location", "Is Active", "Data Creării", "Data Actualizării"]
    ];
    
    workplaces.forEach((wp) => {
      workplacesData.push([
        wp._id.toString(),
        wp.name || "",
        wp.code || "",
        wp.location || "",
        wp.isActive ? "Da" : "Nu",
        wp.createdAt ? new Date(wp.createdAt).toLocaleDateString("ro-RO") : "",
        wp.updatedAt ? new Date(wp.updatedAt).toLocaleDateString("ro-RO") : "",
      ]);
    });

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Workplace!A1:ZZ10000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    const resultWorkplaces = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Workplace!A1",
      valueInputOption: "RAW",
      resource: { values: workplacesData },
    });

    console.log(`✅ ${workplaces.length} farmacii exportate`);
    console.log(`   📊 Celule actualizate: ${resultWorkplaces.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru
    await formatHeaderRow(SPREADSHEET_ID, "Workplace");

    // 5. Backup User
    console.log("📋 Export User...");
    const users = await User.find()
      .populate("workplaceId", "name")
      .lean();
    
    const usersData = [
      ["ID", "Nume", "Email", "Role", "Funcție", "Farmacie (Nume)", "Workplace ID", "Target Ore Lunar", "Is Active", "Data Creării", "Data Actualizării"]
    ];
    
    users.forEach((user) => {
      usersData.push([
        user._id.toString(),
        user.name || "",
        user.email || "",
        user.role || "",
        user.function || "",
        user.workplaceId?.name || "", // Nume farmacie
        user.workplaceId?._id?.toString() || user.workplaceId?.toString() || "", // ID farmacie
        user.monthlyTargetHours?.toString() || "160",
        user.isActive ? "Da" : "Nu",
        user.createdAt ? new Date(user.createdAt).toLocaleDateString("ro-RO") : "",
        user.updatedAt ? new Date(user.updatedAt).toLocaleDateString("ro-RO") : "",
      ]);
    });

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "User!A1:ZZ10000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    const resultUsers = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "User!A1",
      valueInputOption: "RAW",
      resource: { values: usersData },
    });

    console.log(`✅ ${users.length} utilizatori exportați`);
    console.log(`   📊 Celule actualizate: ${resultUsers.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru (deja formatat, dar verificăm din nou)
    await formatHeaderRow(SPREADSHEET_ID, "User");

    // 6. Backup MonthlySchedule
    console.log("📋 Export MonthlySchedule...");
    const schedules = await MonthlySchedule.find()
      .populate("workplaceId", "name")
      .lean();
    
    const schedulesData = [
      ["ID", "Farmacie (Nume)", "Workplace ID", "An", "Lună", "Schedule (JSON)", "Data Creării", "Data Actualizării"]
    ];
    
    schedules.forEach((schedule) => {
      schedulesData.push([
        schedule._id.toString(),
        schedule.workplaceId?.name || "", // Nume farmacie
        schedule.workplaceId?._id?.toString() || schedule.workplaceId?.toString() || "", // ID farmacie
        schedule.year?.toString() || "",
        schedule.month?.toString() || "",
        JSON.stringify(schedule.schedule || {}), // Schedule ca JSON string
        schedule.createdAt ? new Date(schedule.createdAt).toLocaleDateString("ro-RO") : "",
        schedule.updatedAt ? new Date(schedule.updatedAt).toLocaleDateString("ro-RO") : "",
      ]);
    });

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "MonthlySchedule!A1:ZZ10000",
      });
    } catch (err) {
      console.warn("⚠️ Nu s-au putut șterge datele vechi (poate sheet-ul este gol):", err.message);
    }
    
    const resultSchedules = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "MonthlySchedule!A1",
      valueInputOption: "RAW",
      resource: { values: schedulesData },
    });

    console.log(`✅ ${schedules.length} planificări lunare exportate`);
    console.log(`   📊 Celule actualizate: ${resultSchedules.data.updatedCells || 'N/A'}`);
    
    // Formatează header-ul cu fundal albastru (deja formatat, dar verificăm din nou)
    await formatHeaderRow(SPREADSHEET_ID, "MonthlySchedule");

    console.log("✅ Backup completat cu succes!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Eroare la backup:", err);
    process.exit(1);
  }
}

// Rulează backup-ul
backupToGoogleSheets();
