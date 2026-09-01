const express = require("express");
const cors = require("cors");
require("dotenv").config();
const fileUpload = require("express-fileupload");
const { connectDB, isDatabaseConnected } = require("./database/mongoose");
const app = express();

const origin = process.env.ORIGIN || "http://localhost:5173";

//middle wares
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 5 * 1024 * 1024 },
  }),
);
app.use(
  cors({
    origin: [
      origin,
      "http://localhost:5174",
      "https://firearm-precision.netlify.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//routes
const UserRoute = require("./routes/user.route");
const AdminRoute = require("./routes/admin.route");
const GameRoute = require("./routes/game.route");
const LiveStreamRoute = require("./routes/liveStream.route");

app.get("/", (req, res) => {
  return res.status(200).json({
    status: true,
    message: "Game Server is Running",
    database: isDatabaseConnected() ? "connected" : "disconnected",
  });
});

// Ensure MongoDB is connected before API controllers run
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    return res.status(503).json({
      status: false,
      message: "Database connection is currently unavailable",
    });
  }
});

app.use("/api/user", UserRoute);
app.use("/api/admin", AdminRoute);
app.use("/api/game", GameRoute);
app.use("/api/live-stream", LiveStreamRoute);

//server startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
