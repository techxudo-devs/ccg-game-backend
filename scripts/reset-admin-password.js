/**
 * One-time script to reset the admin password in MongoDB.
 * Usage: node scripts/reset-admin-password.js
 * Requires MONGO_URI in src/.env or environment.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../src/.env") });

const mongoose = require("mongoose");
const User = require("../src/models/user.model");

const ADMIN_EMAIL = "firearm@admin.com";
const NEW_PASSWORD = process.env.ADMIN_RESET_PASSWORD || "admin1234";

async function resetAdminPassword() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { bufferCommands: false });
  console.log("Connected to MongoDB");

  const admin = await User.findOne({ email: ADMIN_EMAIL, role: "admin" });
  if (!admin) {
    console.error(`No admin found with email: ${ADMIN_EMAIL}`);
    process.exit(1);
  }

  admin.password = NEW_PASSWORD;
  await admin.save();

  console.log(`Password reset for ${ADMIN_EMAIL} (id: ${admin._id})`);
  console.log(`New password: ${NEW_PASSWORD}`);

  await mongoose.disconnect();
}

resetAdminPassword().catch((err) => {
  console.error(err);
  process.exit(1);
});
