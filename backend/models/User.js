const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // permite null/undefined în unique index
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["superuser", "superadmin", "admin", "employee", "accountancy"],
      required: true,
    },

    function: {
      type: String, // farmacist, asistent, etc
    },

    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ NOU — target ore / lună
    monthlyTargetHours: {
      type: Number,
      default: 160, // sau 160, cum vrei tu
    },

    // ✅ Setare pentru notificări email
    emailNotificationsEnabled: {
      type: Boolean,
      default: true, // Default: activat
    },

    // Indicator pentru panoul superuser (nu expune parola, doar faptul că a fost setată din modulul tehnic)
    adminPasswordSet: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
