const mongoose = require("mongoose");

const ManagerNoteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const MonthlyScheduleSchema = new mongoose.Schema(
  {
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    // Structură: { [employeeId]: { [dateKey: YYYY-MM-DD]: "shift1"|"shift2"|"shift3"|null } }
    // "shift1" = Tură 1 (07:00-15:00)
    // "shift2" = Tură 2 (08:00-16:00)
    // "shift3" = Tură 3 (09:00-17:00)
    // null sau undefined = absent
    schedule: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Comentarii manager pe planificare (vizibile pe tabel); expiră automat după durată setată */
    managerNotes: {
      type: [ManagerNoteSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ✅ Index unic: o planificare per farmacie per lună
MonthlyScheduleSchema.index({ workplaceId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlySchedule", MonthlyScheduleSchema);

