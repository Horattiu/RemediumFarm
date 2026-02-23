const mongoose = require("mongoose");

/**
 * Announcement Model
 * Mesaje/anunțuri de la manager către farmacii
 */
const announcementSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ Dacă este null sau gol, mesajul este pentru toate farmaciile
    // Altfel, array cu ID-urile farmaciilor țintă
    workplaceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workplace",
      },
    ],

    // ✅ Cine a creat mesajul
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ✅ Numele creatorului (pentru afișare rapidă, fără populate)
    createdByName: {
      type: String,
      required: true,
    },

    // ✅ Perioada de activitate
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    // ✅ Status: activ sau arhivat
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// ✅ Index pentru query-uri eficiente
announcementSchema.index({ workplaceIds: 1, isActive: 1, startDate: 1, endDate: 1 });
announcementSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model("Announcement", announcementSchema);

