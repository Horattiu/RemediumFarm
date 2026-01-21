const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");

// Conectare MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    renameUser();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

async function renameUser() {
  try {
    console.log("═══════════════════════════════════════");
    console.log("🔄 RENUMIRE CONT 'contabilitate' → 'remediumhr'");
    console.log("═══════════════════════════════════════\n");

    // 1️⃣ Caută user-ul cu numele "contabilitate"
    console.log("📝 Căutare user 'contabilitate'...");
    
    const user = await User.findOne({ 
      $or: [
        { name: "contabilitate" },
        { name: { $regex: /^contabilitate$/i } }
      ]
    });

    if (!user) {
      console.log("   ⚠️  User 'contabilitate' nu a fost găsit!");
      console.log("   🔍 Căutare useri cu rol 'accountancy'...");
      
      const accountancyUsers = await User.find({ role: "accountancy" }).select("name email role").lean();
      
      if (accountancyUsers.length > 0) {
        console.log("   📋 Useri cu rol 'accountancy' găsiți:");
        accountancyUsers.forEach(u => console.log(`      - ${u.name} (${u.email || 'fără email'})`));
        console.log("   ℹ️  Va fi actualizat primul user găsit.");
        
        // Actualizează primul user găsit
        const firstUser = await User.findById(accountancyUsers[0]._id);
        if (firstUser) {
          firstUser.name = "remediumhr";
          await firstUser.save();
          
          console.log(`\n   ✅ User '${accountancyUsers[0].name}' → 'remediumhr' actualizat cu succes`);
          console.log(`   ✅ Parola a rămas neschimbată`);
          console.log(`   ✅ User ID: ${firstUser._id}`);
        }
      } else {
        console.log("   ❌ Nu s-au găsit useri cu rol 'accountancy'!");
        process.exit(1);
      }
    } else {
      // Actualizează numele user-ului
      const oldName = user.name;
      user.name = "remediumhr";
      await user.save();
      
      console.log(`   ✅ User '${oldName}' → 'remediumhr' actualizat cu succes`);
      console.log(`   ✅ Parola a rămas neschimbată`);
      console.log(`   ✅ User ID: ${user._id}`);
      console.log(`   ✅ Email: ${user.email || 'N/A'}`);
      console.log(`   ✅ Role: ${user.role}`);
    }

    console.log("\n═══════════════════════════════════════");
    console.log("✅ RENUMIRE COMPLETATĂ");
    console.log("═══════════════════════════════════════\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ EROARE:", err);
    process.exit(1);
  }
}

