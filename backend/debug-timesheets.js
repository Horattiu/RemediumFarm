const mongoose = require("mongoose");
require("dotenv").config();

const Timesheet = require("./models/Timesheet");
const Employee = require("./models/Employee");

async function debugTimesheets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectat la MongoDB\n");

    const emp = await Employee.findOne({ name: /oltean/i });
    if (!emp) {
      console.log("❌ Angajat negasit");
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log("👤 Angajat:", emp.name, "ID:", emp._id);
    console.log("🏢 Workplace ID:", emp.workplaceId);
    console.log("\n");

    const timesheets = await Timesheet.find({
      employeeId: emp._id,
      date: {
        $gte: new Date(2026, 1, 1),
        $lte: new Date(2026, 1, 28, 23, 59, 59),
      },
    }).lean();

    console.log(`📊 Total timesheets: ${timesheets.length}\n`);

    let totalHours = 0;
    let entriesByWorkplace = {};

    timesheets.forEach((ts, index) => {
      const dateStr = ts.date instanceof Date 
        ? ts.date.toISOString().slice(0, 10) 
        : new Date(ts.date).toISOString().slice(0, 10);
      
      console.log(`\n📅 Timesheet ${index + 1}: ${dateStr}`);
      console.log(`   Total Hours: ${ts.totalHours}`);
      console.log(`   Entries: ${ts.entries.length}`);

      ts.entries.forEach((e, eIndex) => {
        const wpIdStr = String(e.workplaceId);
        if (!entriesByWorkplace[wpIdStr]) {
          entriesByWorkplace[wpIdStr] = { count: 0, hours: 0 };
        }
        entriesByWorkplace[wpIdStr].count++;
        entriesByWorkplace[wpIdStr].hours += Number(e.hoursWorked) || 0;
        totalHours += Number(e.hoursWorked) || 0;

        console.log(`   Entry ${eIndex + 1}:`);
        console.log(`      Workplace ID: ${wpIdStr}`);
        console.log(`      Type: ${e.type || "home"}`);
        console.log(`      Hours: ${e.hoursWorked}`);
        console.log(`      Status: ${e.status || "N/A"}`);
      });
    });

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMAR:");
    console.log(`   Total timesheets: ${timesheets.length}`);
    console.log(`   Total ore (suma entries.hoursWorked): ${totalHours}`);
    console.log(`   Total ore (suma timesheet.totalHours): ${timesheets.reduce((sum, ts) => sum + (ts.totalHours || 0), 0)}`);
    console.log("\n📊 Entries grupate după Workplace ID:");
    Object.keys(entriesByWorkplace).forEach((wpId) => {
      console.log(`   Workplace ${wpId}: ${entriesByWorkplace[wpId].count} entries, ${entriesByWorkplace[wpId].hours} ore`);
    });
    console.log(`\n🏢 Employee Workplace ID: ${emp.workplaceId}`);
    console.log("=".repeat(60) + "\n");

    await mongoose.disconnect();
    console.log("✅ Deconectat de la MongoDB");
  } catch (error) {
    console.error("❌ EROARE:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

debugTimesheets();

