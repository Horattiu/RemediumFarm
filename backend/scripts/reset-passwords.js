const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const User = require("../models/User");
const Workplace = require("../models/Workplace");

// Conectare MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    resetPasswords();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function resetPasswords() {
  try {
    console.log("═══════════════════════════════════════");
    console.log("🔄 ÎNCEPUTE RESET PAROLE");
    console.log("═══════════════════════════════════════");

    // 1️⃣ Resetare parole pentru toți adminii farmaciilor (role: "admin")
    console.log("\n📝 Resetare parole pentru adminii farmaciilor...");
    const adminUsers = await User.find({ role: "admin" }).select("_id name email role workplaceId");

    const credentials = [];

    for (const user of adminUsers) {
      const plainPassword = "rem123!!";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      await User.findByIdAndUpdate(user._id, {
        $set: { password: hashedPassword },
      });

      const workplaceName = user.workplaceId 
        ? (await Workplace.findById(user.workplaceId).select("name").lean())?.name || "N/A"
        : "N/A";

      credentials.push({
        type: "Admin Farmacie",
        name: user.name,
        email: user.email || "N/A",
        workplace: workplaceName,
        password: plainPassword,
      });

      console.log(`   ✅ ${user.name} (${workplaceName}) - parola resetată`);
    }

    // 2️⃣ Resetare/Creare parola pentru "adminovidiu" (manager)
    console.log("\n📝 Resetare/Creare parola pentru manager 'adminovidiu'...");
    let managerUser = await User.findOne({ 
      $or: [
        { name: "adminovidiu" },
        { name: { $regex: /^admin\s*ovidiu$/i } }
      ]
    });

    const plainPasswordManager = "removidiu2026";

    if (managerUser) {
      // Resetare parola pentru user existent
      const hashedPassword = await bcrypt.hash(plainPasswordManager, 10);

      await User.findByIdAndUpdate(managerUser._id, {
        $set: { password: hashedPassword, name: "adminovidiu" },
      });

      credentials.push({
        type: "Manager",
        name: "adminovidiu",
        email: managerUser.email || "N/A",
        workplace: "N/A",
        password: plainPasswordManager,
      });

      console.log(`   ✅ ${managerUser.name} → 'adminovidiu' - parola resetată`);
    } else {
      // Creează user nou dacă nu există
      console.log("   ⚠️  User 'adminovidiu' nu a fost găsit - va fi creat...");
      
      // Verifică dacă există user cu nume similar sau superadmin
      const similarUsers = await User.find({ 
        $or: [
          { name: { $regex: /admin.*ovidiu|ovidiu.*admin/i } },
          { role: "superadmin" }
        ]
      }).select("name email role");

      if (similarUsers.length > 0) {
        console.log("   🔍 Useri similari/superadmin găsiți:");
        similarUsers.forEach(u => console.log(`      - ${u.name} (${u.role})`));
        console.log("   ℹ️  Va fi resetată parola pentru primul superadmin găsit.");
        
        // Dacă există superadmin, resetează parola pentru el
        const superadmin = similarUsers.find(u => u.role === "superadmin") || similarUsers[0];
        const hashedPassword = await bcrypt.hash(plainPasswordManager, 10);
        
        await User.findByIdAndUpdate(superadmin._id, {
          $set: { password: hashedPassword, name: "adminovidiu" },
        });

        credentials.push({
          type: "Manager",
          name: "adminovidiu",
          email: superadmin.email || "N/A",
          workplace: "N/A",
          password: plainPasswordManager,
        });

        console.log(`   ✅ ${superadmin.name} → 'adminovidiu' - parola resetată`);
      } else {
        // Creează user nou
        const hashedPassword = await bcrypt.hash(plainPasswordManager, 10);
        
        managerUser = new User({
          name: "adminovidiu",
          password: hashedPassword,
          role: "superadmin",
          isActive: true,
        });

        await managerUser.save();

        credentials.push({
          type: "Manager",
          name: "adminovidiu",
          email: "N/A",
          workplace: "N/A",
          password: plainPasswordManager,
        });

        console.log(`   ✅ User 'adminovidiu' creat cu succes`);
      }
    }

    // 3️⃣ Resetare parola pentru "contabilitaterem" (contabilitate)
    console.log("\n📝 Resetare parola pentru contabilitate 'contabilitaterem'...");
    const accountancyUser = await User.findOne({ 
      $or: [
        { name: "contabilitaterem" },
        { role: "accountancy" }
      ]
    });

    if (accountancyUser) {
      const plainPassword = "contarem2026!";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      await User.findByIdAndUpdate(accountancyUser._id, {
        $set: { password: hashedPassword },
      });

      credentials.push({
        type: "Contabilitate",
        name: accountancyUser.name,
        email: accountancyUser.email || "N/A",
        workplace: "N/A",
        password: plainPassword,
      });

      console.log(`   ✅ ${accountancyUser.name} - parola resetată`);
    } else {
      console.log("   ⚠️  User 'contabilitaterem' nu a fost găsit!");
      
      // Verifică dacă există useri cu rol accountancy
      const accountancyUsers = await User.find({ role: "accountancy" }).select("name email");

      if (accountancyUsers.length > 0) {
        console.log("   🔍 Useri cu rol 'accountancy' găsiți:");
        accountancyUsers.forEach(u => console.log(`      - ${u.name}`));
        console.log("   ℹ️  Va fi resetată parola pentru primul user găsit.");
      }
    }

    // 4️⃣ Generează fișier temporar cu credențialele
    console.log("\n📄 Generare fișier cu credențiale...");
    const credentialsFile = path.join(__dirname, "..", "CREDENTIALS_TEMP.txt");

    let fileContent = "═══════════════════════════════════════════════════════════\n";
    fileContent += "CREDENȚIALE CONTOARE - REMEDIUM CONCEDII\n";
    fileContent += `Generat la: ${new Date().toLocaleString("ro-RO")}\n`;
    fileContent += "═══════════════════════════════════════════════════════════\n\n";

    // Grupează după tip
    const byType = {
      "Admin Farmacie": credentials.filter(c => c.type === "Admin Farmacie"),
      "Manager": credentials.filter(c => c.type === "Manager"),
      "Contabilitate": credentials.filter(c => c.type === "Contabilitate"),
    };

    // Admini farmacii
    if (byType["Admin Farmacie"].length > 0) {
      fileContent += "┌─────────────────────────────────────────────────────────────┐\n";
      fileContent += "│ ADMINI FARMACII (Parola: rem123!!)                        │\n";
      fileContent += "└─────────────────────────────────────────────────────────────┘\n\n";

      byType["Admin Farmacie"].forEach((cred, index) => {
        fileContent += `${index + 1}. ${cred.name}\n`;
        fileContent += `   Farmacie: ${cred.workplace}\n`;
        fileContent += `   Email: ${cred.email}\n`;
        fileContent += `   Parolă: ${cred.password}\n\n`;
      });
    }

    // Manager
    if (byType["Manager"].length > 0) {
      fileContent += "┌─────────────────────────────────────────────────────────────┐\n";
      fileContent += "│ MANAGER                                                    │\n";
      fileContent += "└─────────────────────────────────────────────────────────────┘\n\n";

      byType["Manager"].forEach((cred) => {
        fileContent += `User: ${cred.name}\n`;
        fileContent += `Email: ${cred.email}\n`;
        fileContent += `Parolă: ${cred.password}\n\n`;
      });
    }

    // Contabilitate
    if (byType["Contabilitate"].length > 0) {
      fileContent += "┌─────────────────────────────────────────────────────────────┐\n";
      fileContent += "│ CONTABILITATE                                              │\n";
      fileContent += "└─────────────────────────────────────────────────────────────┘\n\n";

      byType["Contabilitate"].forEach((cred) => {
        fileContent += `User: ${cred.name}\n`;
        fileContent += `Email: ${cred.email}\n`;
        fileContent += `Parolă: ${cred.password}\n\n`;
      });
    }

    fileContent += "═══════════════════════════════════════════════════════════\n";
    fileContent += "⚠️  ATENȚIE: Acest fișier conține parole în plain text!\n";
    fileContent += "⚠️  Păstrează-l în siguranță și șterge-l după ce l-ai copiat!\n";
    fileContent += "═══════════════════════════════════════════════════════════\n";

    fs.writeFileSync(credentialsFile, fileContent, "utf8");
    console.log(`   ✅ Fișier generat: ${credentialsFile}`);

    console.log("\n═══════════════════════════════════════");
    console.log("✅ RESET PAROLE COMPLETAT");
    console.log(`   Total admini resetate: ${byType["Admin Farmacie"].length}`);
    console.log(`   Manageri resetați: ${byType["Manager"].length}`);
    console.log(`   Contabilitate resetată: ${byType["Contabilitate"].length}`);
    console.log("═══════════════════════════════════════\n");

    // Afișează rezumat în consolă
    console.log("📋 REZUMAT CREDENȚIALE:\n");
    credentials.forEach((cred, index) => {
      console.log(`${index + 1}. ${cred.type}: ${cred.name}`);
      console.log(`   Parolă: ${cred.password}\n`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ EROARE:", err);
    process.exit(1);
  }
}
