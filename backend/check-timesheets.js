const mongoose = require("mongoose");
const readline = require("readline");
require("dotenv").config();

// Importă modelele
const Timesheet = require("./models/Timesheet");
const Employee = require("./models/Employee");

// Funcție pentru a cere input de la utilizator
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Funcție pentru a verifica timesheet-urile unui angajat
async function checkTimesheets(employeeName, year = 2026, month = 2) {
  try {
    // Conectare la MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/remedium";
    await mongoose.connect(mongoUri);
    console.log("✅ Conectat la MongoDB\n");

    // Găsește angajatul după nume
    console.log(`🔍 Căutare angajat: "${employeeName}"...`);
    const employees = await Employee.find({
      name: { $regex: employeeName, $options: "i" }, // Căutare case-insensitive
      isActive: true,
    })
      .select("_id name email workplaceId")
      .lean();

    if (employees.length === 0) {
      console.log(`❌ Nu s-a găsit niciun angajat cu numele "${employeeName}"`);
      await mongoose.disconnect();
      process.exit(1);
    }

    if (employees.length > 1) {
      console.log(`\n⚠️  S-au găsit ${employees.length} angajați cu nume similar:`);
      employees.forEach((emp, index) => {
        console.log(`   ${index + 1}. ${emp.name} (ID: ${emp._id})`);
      });
      console.log(`\n📝 Se vor căuta timesheet-urile pentru TOȚI acești angajați.\n`);
    } else {
      console.log(`✅ Angajat găsit: ${employees[0].name} (ID: ${employees[0]._id})\n`);
    }

    // Calculează intervalul pentru februarie 2026
    const startDate = new Date(year, month - 1, 1); // 1 februarie 2026
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // 28 februarie 2026 23:59:59

    console.log(`📅 Perioadă: ${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`);
    console.log(`   Luna: ${month}/${year}\n`);

    // Găsește timesheet-urile pentru toți angajații găsiți
    const employeeIds = employees.map(emp => emp._id);
    let allTimesheets = [];

    for (const employee of employees) {
      const employeeObjectId = new mongoose.Types.ObjectId(employee._id);

      // Găsește toate timesheet-urile pentru angajat în perioada respectivă
      const timesheets = await Timesheet.find({
        employeeId: employeeObjectId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .lean()
        .sort({ date: 1 });

      // Adaugă informații despre angajat la fiecare timesheet
      timesheets.forEach(ts => {
        ts.employeeInfo = {
          _id: employee._id,
          name: employee.name,
        };
      });

      allTimesheets = allTimesheets.concat(timesheets);
    }

    console.log(`📊 REZULTATE: ${allTimesheets.length} timesheet-uri găsite pentru ${employees.length} angajat(i)\n`);

    if (allTimesheets.length === 0) {
      console.log("❌ Nu există timesheet-uri pentru acest(acești) angajat(i) în perioada selectată.");
      await mongoose.disconnect();
      return;
    }

    // Calculează totaluri
    let totalHours = 0;
    let totalEntries = 0;

    // Grupează timesheet-urile pe angajat
    const timesheetsByEmployee = {};
    allTimesheets.forEach(ts => {
      const empId = String(ts.employeeId);
      if (!timesheetsByEmployee[empId]) {
        timesheetsByEmployee[empId] = [];
      }
      timesheetsByEmployee[empId].push(ts);
    });

    // Afișează detalii pentru fiecare angajat
    Object.keys(timesheetsByEmployee).forEach((empId, empIndex) => {
      const employee = employees.find(e => String(e._id) === empId);
      const timesheets = timesheetsByEmployee[empId];
      
      console.log(`\n${"=".repeat(60)}`);
      console.log(`👤 ANGAJAT ${empIndex + 1}: ${employee?.name || 'N/A'} (ID: ${empId})`);
      console.log(`   Timesheet-uri: ${timesheets.length}`);
      console.log(`${"=".repeat(60)}\n`);

      // Afișează detalii pentru fiecare timesheet
      timesheets.forEach((ts, index) => {
        const dateStr = ts.date instanceof Date 
          ? ts.date.toISOString().slice(0, 10) 
          : new Date(ts.date).toISOString().slice(0, 10);
        
        console.log(`\n📅 Timesheet ${index + 1}:`);
        console.log(`   ID: ${ts._id}`);
        console.log(`   Data: ${dateStr}`);
        console.log(`   Angajat: ${ts.employeeName || 'N/A'}`);
        console.log(`   Total ore: ${ts.totalHours || 0}`);
        console.log(`   Total minute: ${ts.totalMinutes || 0}`);
        console.log(`   Entries: ${ts.entries?.length || 0}`);

        if (ts.entries && ts.entries.length > 0) {
          ts.entries.forEach((entry, entryIndex) => {
            console.log(`\n   Entry ${entryIndex + 1}:`);
            console.log(`      Workplace ID: ${entry.workplaceId}`);
            console.log(`      Workplace Name: ${entry.workplaceName || 'N/A'}`);
            console.log(`      Type: ${entry.type || 'home'}`);
            console.log(`      Start Time: ${entry.startTime || 'N/A'}`);
            console.log(`      End Time: ${entry.endTime || 'N/A'}`);
            console.log(`      Hours Worked: ${entry.hoursWorked || 0}`);
            console.log(`      Minutes Worked: ${entry.minutesWorked || 0}`);
            console.log(`      Status: ${entry.status || 'N/A'}`);
            console.log(`      Leave Type: ${entry.leaveType || 'N/A'}`);
            
            totalHours += entry.hoursWorked || 0;
          });
          totalEntries += ts.entries.length;
        }
      });
    });

    // Afișează sumar
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMAR GENERAL:");
    console.log(`   Angajați verificați: ${employees.length}`);
    console.log(`   Total timesheet-uri: ${allTimesheets.length}`);
    console.log(`   Total entries: ${totalEntries}`);
    console.log(`   Total ore (suma entries.hoursWorked): ${Math.round(totalHours)}`);
    console.log(`   Total ore (suma timesheet.totalHours): ${Math.round(allTimesheets.reduce((sum, ts) => sum + (ts.totalHours || 0), 0))}`);
    console.log("=".repeat(60) + "\n");

    // Deconectare
    await mongoose.disconnect();
    console.log("✅ Deconectat de la MongoDB");

  } catch (error) {
    console.error("❌ EROARE:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Funcție principală
async function main() {
  console.log("=".repeat(60));
  console.log("🔍 VERIFICARE TIMESHEET-URI - FEBRUARIE 2026");
  console.log("=".repeat(60));
  console.log("\n");

  // Cere numele angajatului
  const employeeName = await askQuestion("📝 Introdu numele angajatului: ");

  if (!employeeName || employeeName.trim() === "") {
    console.log("❌ Numele nu poate fi gol!");
    process.exit(1);
  }

  // Rulează verificarea pentru februarie 2026
  await checkTimesheets(employeeName.trim(), 2026, 2);
}

// Rulează scriptul
main().catch((error) => {
  console.error("❌ EROARE:", error);
  process.exit(1);
});

