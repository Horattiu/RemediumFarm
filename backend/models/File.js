/**
 * File Model
 * Stochează DOAR metadata despre fișiere
 * Fișierele reale sunt stocate în Google Drive sau alt storage extern
 */

const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    // Metadata fișier
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    hash: {
      type: String,
      required: true,
      index: true, // Pentru deduplicare
    },

    // Storage (abstract - nu depinde de implementare)
    storageType: {
      type: String,
      required: true,
      enum: ["googledrive", "local", "s3"], // Extensibil
    },
    storageFileId: {
      type: String,
      required: true,
      index: true,
    },
    storagePath: {
      type: String,
      required: true,
    },

    // Destinatar
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      default: null,
      index: true,
    },
    workplaceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workplace",
      },
    ],

    // Sursă
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploadedByName: {
      type: String,
      required: true,
    },

    // Metadata
    category: {
      type: String,
      enum: ["document", "image", "instruction", "other"],
      default: "other",
    },
    description: {
      type: String,
      default: "",
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        workplaceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Workplace",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
        readBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Expirare (opțional)
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexuri pentru query-uri rapide
fileSchema.index({ workplaceId: 1, isActive: 1, createdAt: -1 });
fileSchema.index({ hash: 1 }); // Pentru deduplicare
fileSchema.index({ uploadedBy: 1, createdAt: -1 });
fileSchema.index({ category: 1, isActive: 1 });
fileSchema.index({ expiresAt: 1 }); // Pentru cleanup

module.exports = mongoose.model("File", fileSchema);


