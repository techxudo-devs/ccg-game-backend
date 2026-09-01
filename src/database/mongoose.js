const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

let mongoConnectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose
      .connect(process.env.MONGO_URI, {
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => {
        console.log("MongoDB connected");
        return mongoose.connection;
      })
      .catch((error) => {
        mongoConnectionPromise = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  return mongoConnectionPromise;
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDatabaseConnected };
