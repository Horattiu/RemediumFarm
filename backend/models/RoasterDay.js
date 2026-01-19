const mongoose = require("mongoose");

const RosterDaySchema = new mongoose.Schema(
  {
    workplaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workplace",
      required: true,
      index: true,
    },

    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true,
    },

    visitorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

RosterDaySchema.index({ workplaceId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("RosterDay", RosterDaySchema);
