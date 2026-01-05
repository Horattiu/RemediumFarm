const mongoose = require("mongoose");

/**
 * Employee Model
 * Reprezintă angajații creați pentru pontaj și concedii
 * SEPARAT de conturile de autentificare (users)
 */
const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // permite null/undefined în unique index
    },

    function: {
      type: String, // farmacist, asistent, etc
    },

    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      required: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Target ore / lună
    monthlyTargetHours: {
      type: Number,
      default: 160,
    },
  },
  { timestamps: true }
);

// Index compus pentru query-uri frecvente
employeeSchema.index({ workplaceId: 1, isActive: 1 });
employeeSchema.index({ name: 1 }); // pentru căutare rapidă

module.exports = mongoose.model("Employee", employeeSchema);

