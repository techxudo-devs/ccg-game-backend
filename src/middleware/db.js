const { connectDB } = require("../database/mongoose");

async function ensureDbConnection(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database middleware error:", error.message);
    return res.status(503).json({
      status: false,
      message: "Database connection failed. Please try again in a moment.",
    });
  }
}

module.exports = ensureDbConnection;
