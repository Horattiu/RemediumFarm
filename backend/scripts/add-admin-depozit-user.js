require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Workplace = require("../models/Workplace");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/remedium";

async function addAdminDepozitUser() {
  try {
    // Conectare la MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectat la MongoDB");

    // Găsește workplace-ul "Remedium Depozit" sau "Depozit"
    const workplace = await Workplace.findOne({
      $or: [
        { name: { $regex: /depozit/i } },
        { name: "Remedium Depozit" },
        { name: "Depozit" }
      ],
      isActive: true
    });

    if (!workplace) {
      console.error("❌ Nu s-a găsit workplace-ul 'Depozit'. Verifică numele în baza de date.");
      process.exit(1);
    }

    console.log(`✅ Workplace găsit: ${workplace.name} (ID: ${workplace._id})`);

    // Hash-uiește parola
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash("rem123!!", saltRounds);
    console.log("✅ Parolă hash-uită");

    // Verifică dacă user-ul există deja și îl actualizează sau îl creează
    const existingUser = await User.findOne({ name: "admindepozit" });
    
    if (existingUser) {
      console.log("⚠️ User-ul 'admindepozit' există deja. Se actualizează...");
      existingUser.password = hashedPassword;
      existingUser.role = "admin";
      existingUser.workplaceId = workplace._id;
      existingUser.isActive = true;
      existingUser.monthlyTargetHours = 160;
      existingUser.emailNotificationsEnabled = true;
      existingUser.function = null;
      existingUser.email = null;
      
      await existingUser.save();
      console.log("✅ User actualizat cu succes!");
      console.log(`   Nume: ${existingUser.name}`);
      console.log(`   Rol: ${existingUser.role}`);
      console.log(`   Workplace: ${workplace.name}`);
      console.log(`   ID: ${existingUser._id}`);
    } else {
      // Creează user-ul
      const newUser = new User({
        name: "admindepozit",
        password: hashedPassword,
        role: "admin",
        workplaceId: workplace._id,
        isActive: true,
        monthlyTargetHours: 160,
        emailNotificationsEnabled: true,
        function: null,
        email: null
      });

      await newUser.save();
      console.log("✅ User creat cu succes!");
      console.log(`   Nume: ${newUser.name}`);
      console.log(`   Rol: ${newUser.role}`);
      console.log(`   Workplace: ${workplace.name}`);
      console.log(`   ID: ${newUser._id}`);
    }

    await mongoose.connection.close();
    console.log("✅ Conexiune închisă");
    process.exit(0);
  } catch (error) {
    console.error("❌ Eroare:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

addAdminDepozitUser();
