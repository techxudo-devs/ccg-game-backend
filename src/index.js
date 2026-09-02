const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const fileUpload = require("express-fileupload");
const { connectDB, getDbStatus } = require("./config/db");
const ensureDbConnection = require("./middleware/db");

const app = express();

const origin = process.env.ORIGIN || "http://localhost:5173";

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
      "http://localhost:5173",
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

const UserRoute = require("./routes/user.route");
const AdminRoute = require("./routes/admin.route");
const GameRoute = require("./routes/game.route");

app.get("/", async (req, res) => {
  try {
    await connectDB();
    return res.status(200).json({
      status: true,
      message: "Game Server is Running",
      database: getDbStatus(),
    });
  } catch (error) {
    return res.status(503).json({
      status: false,
      message: "Game Server is Running",
      database: "disconnected",
      error: error.message,
    });
  }
});

// Ensure MongoDB is connected before any API route runs (critical on Vercel serverless).
app.use("/api", ensureDbConnection);
app.use("/api/user", UserRoute);
app.use("/api/admin", AdminRoute);
app.use("/api/game", GameRoute);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    });
}

module.exports = app;
