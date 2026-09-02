const mongoose = require("mongoose");

const liveStreamSchema = new mongoose.Schema(
  {
    youtubeVideoId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    isLive: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

liveStreamSchema.index(
  { isLive: 1 },
  { unique: true, partialFilterExpression: { isLive: true } }
);
liveStreamSchema.index({ endedAt: 1 });

const LiveStream = mongoose.model("LiveStream", liveStreamSchema);
module.exports = LiveStream;
