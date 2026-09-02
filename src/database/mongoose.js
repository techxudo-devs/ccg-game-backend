const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

const MONGO_URI = process.env.MONGO_URI;

// Reuse connection across Vercel serverless invocations.
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      })
      .then((mongooseInstance) => {
        console.log("MongoDB connected");
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function getDbStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] || "unknown";
}

module.exports = { connectDB, isDatabaseConnected, getDbStatus };
