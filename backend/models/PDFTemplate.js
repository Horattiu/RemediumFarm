const mongoose = require("mongoose");

/**
 * PDFTemplate Model
 * Stochează template-urile pentru popularea PDF-urilor de cereri de concediu
 * Un singur template activ la un moment dat
 */
const pdfTemplateSchema = new mongoose.Schema(
  {
    // Versiunea template-ului
    version: {
      type: String,
      default: "2.0",
    },

    // Înălțimea paginii PDF (în points)
    pageHeight: {
      type: Number,
      default: 841.89, // A4 height in points
    },

    // Câmpurile mapate cu coordonatele lor
    fields: {
      type: Map,
      of: {
        x: Number,
        y: Number,
        fontSize: Number,
      },
      required: true,
    },

    // Data creării/actualizării
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index pentru a găsi rapid template-ul activ
pdfTemplateSchema.index({ version: 1 });

module.exports = mongoose.model("PDFTemplate", pdfTemplateSchema);

