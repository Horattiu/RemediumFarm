const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // ✅ Referință la Employee, nu User
      required: true,
    },

    // ✅ Denormalizat: numele angajatului pentru claritate în MongoDB
    name: {
      type: String,
      required: true,
      index: true,
    },

    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      required: true,
    },

    function: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["odihna", "medical", "fara_plata", "eveniment"],
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    days: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["În așteptare", "Aprobată", "Respinsă"],
      default: "În așteptare",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // ✅ TEMPORAR FĂRĂ AUTH
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);
