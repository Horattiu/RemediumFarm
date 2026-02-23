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
    status: {
      type: String,
      default: null, // null, "prezent", "garda", "concediu", "liber", "medical"
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
    // ✅ Denormalizat: data ca string "YYYY-MM-DD" pentru ușurința citirii în MongoDB
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    // ✅ Denormalizat: data și ora creării în timezone local (pentru audit ușor de citit)
    createdAtLocal: {
      type: String,
      default: null, // Se setează automat în pre-save hook
    },
    // ✅ Denormalizat: data și ora ultimei modificări în timezone local (pentru audit ușor de citit)
    updatedAtLocal: {
      type: String,
      default: null, // Se setează automat în pre-save hook
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

// ✅ Helper: formatează dată în timezone local ca string "YYYY-MM-DD HH:mm:ss"
const formatLocalDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  // ✅ Folosim metodele locale pentru a obține data/ora în timezone-ul local
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// ✅ Middleware pentru calcularea automată a totalurilor și actualizarea câmpurilor denormalizate
TimesheetSchema.pre("save", async function () {
  // ✅ 0. Asigură-te că dateString este setat corect (CRITIC pentru query-uri corecte)
  if (!this.dateString && this.date) {
    // ✅ CRITIC: Folosim UTC pentru a evita problemele cu timezone
    // Dacă dateString lipsește dar avem date, generăm dateString din date folosind UTC
    // Astfel evităm problemele când MongoDB salvează datele în UTC
    const d = new Date(this.date);
    // ✅ Folosim metodele UTC pentru a obține data corectă, indiferent de timezone
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    this.dateString = `${year}-${month}-${day}`;
  }

  // ✅ 1. Calculează totalHours și totalMinutes
  if (this.entries && this.entries.length > 0) {
    // ✅ IMPORTANT: Calculăm doar din hoursWorked (ore întregi), ignorăm minutele
    // Sumăm direct orele și rotunjim la număr întreg
    this.totalHours = this.entries.reduce(
      (sum, entry) => {
        const hours = entry.hoursWorked ? Math.round(Number(entry.hoursWorked)) : 0;
        return sum + hours;
      },
      0
    );
    // Convertim la minute doar pentru compatibilitate (nu folosim minutele)
    this.totalMinutes = this.totalHours * 60;
  } else {
    this.totalMinutes = 0;
    this.totalHours = 0;
  }

  // ✅ 2. Actualizează createdAtLocal și updatedAtLocal pentru citire ușoară în MongoDB
  const now = new Date();
  
  // ✅ createdAtLocal: doar la creare (când nu există _id sau createdAt)
  if (this.isNew || !this.createdAt) {
    this.createdAtLocal = formatLocalDateTime(now);
  } else if (!this.createdAtLocal && this.createdAt) {
    // Dacă există createdAt dar nu createdAtLocal (pentru documente existente)
    this.createdAtLocal = formatLocalDateTime(this.createdAt);
  }
  
  // ✅ updatedAtLocal: mereu la salvare (se actualizează automat)
  this.updatedAtLocal = formatLocalDateTime(now);
});

module.exports = mongoose.model("Timesheet", TimesheetSchema);

