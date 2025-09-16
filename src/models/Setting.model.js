const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    autoAcceptRequests: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);
module.exports = Setting;
