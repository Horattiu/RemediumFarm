const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index compus pentru query-uri după an și dată
holidaySchema.index({ year: 1, date: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);

