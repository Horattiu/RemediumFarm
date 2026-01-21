const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("../models/User");
const Workplace = require("../models/Workplace");

// Conectare MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    createWorkplaceAndAdmin();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function createWorkplaceAndAdmin() {
  try {
    console.log("═══════════════════════════════════════");
    console.log("🔄 CREARE WORKPLACE ȘI ADMIN");
    console.log("═══════════════════════════════════════\n");

    // 1️⃣ Creează workplace "remedium muncii"
    console.log("📝 Creare workplace 'remedium muncii'...");
    
    // Verifică dacă workplace-ul există deja
    let workplace = await Workplace.findOne({ 
      $or: [
        { name: "remedium muncii" },
        { name: { $regex: /remedium.*munci/i } }
      ]
    });

    if (workplace) {
      console.log(`   ⚠️  Workplace '${workplace.name}' există deja (ID: ${workplace._id})`);
    } else {
      // Creează workplace nou
      workplace = new Workplace({
        name: "remedium muncii",
        code: "MUN-001", // Cod unic pentru workplace
        location: "București", // Poți modifica locația dacă e necesar
        isActive: true,
      });

      await workplace.save();
      console.log(`   ✅ Workplace '${workplace.name}' creat cu succes (ID: ${workplace._id})`);
    }

    // 2️⃣ Creează admin user "adminmuncii"
    console.log("\n📝 Creare admin user 'adminmuncii'...");
    
    // Verifică dacă user-ul există deja
    let adminUser = await User.findOne({ 
      $or: [
        { name: "adminmuncii" },
        { name: { $regex: /admin.*munci/i } }
      ]
    });

    // Parola pentru admin - aceeași ca pentru alți admini
    const plainPassword = process.env.ADMIN_DEFAULT_PASSWORD || "rem123!!";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    if (adminUser) {
      console.log(`   ⚠️  User '${adminUser.name}' există deja (ID: ${adminUser._id})`);
      
      // Actualizează user-ul existent
      adminUser.password = hashedPassword;
      adminUser.role = "admin";
      adminUser.workplaceId = workplace._id;
      adminUser.isActive = true;
      
      await adminUser.save();
      console.log(`   ✅ User '${adminUser.name}' actualizat cu succes`);
      console.log(`   ✅ Parolă resetată: ${plainPassword}`);
      console.log(`   ✅ Legat la workplace: ${workplace.name}`);
    } else {
      // Creează user nou
      adminUser = new User({
        name: "adminmuncii",
        password: hashedPassword,
        role: "admin",
        workplaceId: workplace._id,
        isActive: true,
      });

      await adminUser.save();
      console.log(`   ✅ User 'adminmuncii' creat cu succes (ID: ${adminUser._id})`);
      console.log(`   ✅ Parolă: ${plainPassword}`);
      console.log(`   ✅ Legat la workplace: ${workplace.name}`);
    }

    console.log("\n═══════════════════════════════════════");
    console.log("✅ CREARE COMPLETATĂ");
    console.log("═══════════════════════════════════════");
    console.log(`\n📋 DETALII:`);
    console.log(`   Workplace: ${workplace.name} (${workplace.code})`);
    console.log(`   Location: ${workplace.location}`);
    console.log(`   Admin User: ${adminUser.name}`);
    console.log(`   Parolă: ${plainPassword}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Workplace ID: ${workplace._id}`);
    console.log(`   User ID: ${adminUser._id}`);
    console.log("\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ EROARE:", err);
    process.exit(1);
  }
}

