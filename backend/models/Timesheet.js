const mongoose = require("mongoose");

const TimesheetEntrySchema = new mongoose.Schema(
  {
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      required: true,
    },
    // ✅ Denormalizat: numele farmaciei pentru claritate în MongoDB
    workplaceName: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      default: "08:00",
    },
    endTime: {
      type: String,
      default: "16:00",
    },
    hoursWorked: {
      type: Number,
      default: 0,
    },
    minutesWorked: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ["home", "visitor"],
      default: "home",
    },
    leaveType: {
      type: String,
      default: null, // null, "odihna", "medical", "liber"
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false } // nu vrem _id pentru subdocumente
);

const TimesheetSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // ✅ Referință la Employee, nu User
      required: true,
      index: true,
    },
    // ✅ Denormalizat: numele angajatului pentru claritate în MongoDB
    employeeName: {
      type: String,
      required: true,
      index: true, // index pentru căutare rapidă
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    entries: [TimesheetEntrySchema],
    totalHours: {
      type: Number,
      default: 0,
    },
    totalMinutes: {
      type: Number,
      default: 0,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ✅ Index unic: un timesheet per angajat per zi
TimesheetSchema.index({ employeeId: 1, date: 1 }, { unique: true });
// Notă: Există deja index pe `date` (linia 65), deci query-urile după dată sunt optimizate

// ✅ Middleware pentru calcularea automată a totalurilor
TimesheetSchema.pre("save", async function () {
  if (this.entries && this.entries.length > 0) {
    this.totalMinutes = this.entries.reduce(
      (sum, entry) => sum + (entry.minutesWorked || 0),
      0
    );
    this.totalHours = this.totalMinutes / 60;
  } else {
    this.totalMinutes = 0;
    this.totalHours = 0;
  }
});

module.exports = mongoose.model("Timesheet", TimesheetSchema);

