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

    directSupervisorName: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["În așteptare", "Aprobată", "Respinsă"],
      default: "În așteptare",
    },

    // ✅ Evidențiere modificări cerere
    wasModified: {
      type: Boolean,
      default: false,
    },
    modifiedAt: {
      type: Date,
      default: null,
    },
    previousStartDate: {
      type: Date,
      default: null,
    },
    previousEndDate: {
      type: Date,
      default: null,
    },
    modificationNote: {
      type: String,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // ✅ TEMPORAR FĂRĂ AUTH
    },
  },
  { timestamps: true }
);

// Index optimizat pentru verificarea concediului aprobat la pontaj
leaveSchema.index({
  employeeId: 1,
  workplaceId: 1,
  status: 1,
  startDate: 1,
  endDate: 1,
});

// Index util pentru listări pe farmacie/perioadă
leaveSchema.index({
  workplaceId: 1,
  status: 1,
  startDate: 1,
  endDate: 1,
});

module.exports = mongoose.model("Leave", leaveSchema);
