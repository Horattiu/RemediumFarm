const mongoose = require("mongoose");

const workplaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true, // ex: FAR-001
    },
    location: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    leaveFiltersProtectionEnabled: {
      type: Boolean,
      default: false,
    },
    leaveFiltersPasswordHash: {
      type: String,
      default: null,
      select: false,
    },
    leaveFiltersPasswordSet: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workplace", workplaceSchema);
