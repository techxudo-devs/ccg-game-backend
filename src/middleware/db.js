const { connectDB } = require("../config/db");

async function ensureDbConnection(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database middleware error:", error.message);
    return res.status(503).json({
      message: "Database connection failed. Please try again in a moment.",
    });
  }
}

module.exports = ensureDbConnection;
