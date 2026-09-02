require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/user.model");

const ADMIN_EMAIL = "firearm@admin.com";
const ADMIN_PASSWORD = "Admin@147";
const ADMIN_USERNAME = "firearm-admin";

async function resetAdmin() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  let admin = await User.findOne({ email: ADMIN_EMAIL });

  if (!admin) {
    admin = await User.findOne({ role: "admin" });
  }

  if (admin) {
    admin.email = ADMIN_EMAIL;
    admin.role = "admin";
    admin.password = ADMIN_PASSWORD;
    admin.resetPasswordOTP = undefined;
    admin.resetPasswordOTPExpiry = undefined;
    await admin.save();
    console.log(`Updated existing admin (${admin.username})`);
  } else {
    const usernameTaken = await User.findOne({ username: ADMIN_USERNAME });
    admin = await User.create({
      username: usernameTaken ? `admin-${Date.now()}` : ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: "Admin",
      role: "admin",
    });
    console.log(`Created admin (${admin.username})`);
  }

  console.log("Admin login:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

resetAdmin()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("Failed to reset admin:", err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
