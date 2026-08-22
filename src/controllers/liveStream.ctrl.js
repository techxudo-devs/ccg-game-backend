const mongoose = require("mongoose");
const LiveStreamModel = require("../models/liveStream.model");
const { extractYouTubeVideoId } = require("../utils/youtube");

const INVALID_YOUTUBE_MESSAGE =
  "Invalid YouTube URL or video ID. Paste a watch, live, embed, or youtu.be link, or the 11-character video ID.";

function serializeAdminStream(doc) {
  return {
    _id: doc._id,
    youtubeVideoId: doc.youtubeVideoId,
    title: doc.title,
    isLive: doc.isLive,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializePastStream(doc) {
  return {
    _id: doc._id,
    videoId: doc.youtubeVideoId,
    title: doc.title,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
  };
}

async function findByIdParam(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid stream id" });
    return null;
  }
  const stream = await LiveStreamModel.findById(id);
  if (!stream) {
    res.status(404).json({ message: "Live stream not found" });
    return null;
  }
  return stream;
}

const LiveStreamController = {
  create: async (req, res) => {
    const { youtubeUrl, title } = req.body;
    if (!youtubeUrl || !title || !String(title).trim()) {
      return res
        .status(400)
        .json({ message: "Please provide youtubeUrl and title" });
    }

    const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
    if (!youtubeVideoId) {
      return res.status(400).json({ message: INVALID_YOUTUBE_MESSAGE });
    }

    try {
      const stream = await LiveStreamModel.create({
        youtubeVideoId,
        title: String(title).trim(),
        isLive: false,
        startedAt: null,
        endedAt: null,
      });
      return res.status(201).json({
        message: "Live stream saved",
        stream: serializeAdminStream(stream),
      });
    } catch (error) {
      console.error("Error creating live stream:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  listAdmin: async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    try {
      const [streams, total, currentLive] = await Promise.all([
        LiveStreamModel.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        LiveStreamModel.countDocuments(),
        LiveStreamModel.findOne({ isLive: true }),
      ]);

      return res.status(200).json({
        message: "Live streams",
        streams: streams.map(serializeAdminStream),
        total,
        page,
        limit,
        currentLive: currentLive ? serializeAdminStream(currentLive) : null,
      });
    } catch (error) {
      console.error("Error listing live streams:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  goLive: async (req, res) => {
    try {
      const stream = await findByIdParam(req.params.id, res);
      if (!stream) return;

      if (stream.isLive) {
        return res.status(200).json({
          message: "Stream is already live",
          stream: serializeAdminStream(stream),
        });
      }

      const now = new Date();

      // Unset any currently-live stream first (never two live at once).
      // If the next save fails, we end up with zero live streams, not two.
      await LiveStreamModel.updateMany(
        { isLive: true, _id: { $ne: stream._id } },
        { $set: { isLive: false, endedAt: now } }
      );

      stream.isLive = true;
      stream.startedAt = now;
      stream.endedAt = null;
      await stream.save();

      return res.status(200).json({
        message: "Stream is now live",
        stream: serializeAdminStream(stream),
      });
    } catch (error) {
      console.error("Error going live:", error);
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Another stream is already live. Please try again.",
        });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  end: async (req, res) => {
    try {
      const stream = await findByIdParam(req.params.id, res);
      if (!stream) return;

      if (!stream.isLive) {
        return res.status(400).json({ message: "This stream is not live" });
      }

      stream.isLive = false;
      stream.endedAt = new Date();
      await stream.save();

      return res.status(200).json({
        message: "Stream ended",
        stream: serializeAdminStream(stream),
      });
    } catch (error) {
      console.error("Error ending live stream:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  update: async (req, res) => {
    const { title, youtubeUrl } = req.body;

    try {
      const stream = await findByIdParam(req.params.id, res);
      if (!stream) return;

      if (title !== undefined) {
        const trimmed = String(title).trim();
        if (!trimmed) {
          return res.status(400).json({ message: "Title cannot be empty" });
        }
        stream.title = trimmed;
      }

      if (youtubeUrl !== undefined) {
        const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
        if (!youtubeVideoId) {
          return res.status(400).json({ message: INVALID_YOUTUBE_MESSAGE });
        }
        stream.youtubeVideoId = youtubeVideoId;
      }

      await stream.save();
      return res.status(200).json({
        message: "Live stream updated",
        stream: serializeAdminStream(stream),
      });
    } catch (error) {
      console.error("Error updating live stream:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  remove: async (req, res) => {
    try {
      const stream = await findByIdParam(req.params.id, res);
      if (!stream) return;

      await stream.deleteOne();
      return res.status(200).json({ message: "Live stream deleted" });
    } catch (error) {
      console.error("Error deleting live stream:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  getCurrent: async (req, res) => {
    try {
      const stream = await LiveStreamModel.findOne({ isLive: true }).lean();
      if (!stream) {
        return res.status(200).json({ isLive: false });
      }
      return res.status(200).json({
        isLive: true,
        videoId: stream.youtubeVideoId,
        title: stream.title,
        startedAt: stream.startedAt,
      });
    } catch (error) {
      console.error("Error fetching current live stream:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  getPast: async (req, res) => {
    try {
      const streams = await LiveStreamModel.find({
        endedAt: { $ne: null },
      })
        .sort({ endedAt: -1 })
        .lean();

      return res.status(200).json({
        message: "Past streams",
        streams: streams.map(serializePastStream),
      });
    } catch (error) {
      console.error("Error fetching past live streams:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = LiveStreamController;
