const express = require("express");
const LiveStreamRoute = express.Router();
const LiveStreamController = require("../controllers/liveStream.ctrl");
const authMiddleware = require("../middleware/auth");

LiveStreamRoute.get(
  "/current",
  authMiddleware,
  LiveStreamController.getCurrent
);
LiveStreamRoute.get("/past", authMiddleware, LiveStreamController.getPast);

module.exports = LiveStreamRoute;
