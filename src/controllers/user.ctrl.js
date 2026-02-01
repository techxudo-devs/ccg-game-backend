const UserModel = require("../models/user.model");
const RequestModel = require("../models/request.model");
const GameModel = require("../models/game.model");
const SeatModel = require("../models/seat.model");
const SettingModel = require("../models/Setting.model");
const { sendStatusUpdate } = require("../services/Email.service");
const PaymentService = require("../services/payment.service");
const EmailService = require("../services/Email.service");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");

const UserController = {
  TestBookSeat: async (req, res) => {
    const { gameId, seatNumber } = req.body;
    const userId = req.user._id;

    if (!gameId || !seatNumber) {
      return res
        .status(400)
        .json({ message: "Please provide gameId and seatNumber" });
    }

    try {
      const game = await GameModel.findById(gameId).populate("seats");
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.status === "ended") {
        return res.status(400).json({ message: "Game has already ended" });
      }

      // Check if user has already booked a seat in this game
      const existingBooking = game.seats.find(
        (seat) => seat.userId && seat.userId.toString() === userId.toString()
      );
      if (existingBooking) {
        return res
          .status(400)
          .json({ message: "You have already booked a seat in this game" });
      }

      // Find the selected seat
      const seat = game.seats.find(
        (seat) => seat.seatNumber === Number(seatNumber)
      );
      if (!seat) {
        return res.status(404).json({ message: "Seat not found" });
      }

      if (seat.isOccupied) {
        return res.status(400).json({ message: "Seat is already occupied" });
      }

      // Update seat status directly without payment
      await SeatModel.findByIdAndUpdate(seat._id, {
        isOccupied: true,
        userId: userId,
        BookedAt: new Date(),
      });

      // Check if all seats are occupied
      const updatedGame = await GameModel.findById(gameId).populate("seats");
      const allSeatsOccupied = updatedGame.seats.every(
        (seat) => seat.isOccupied
      );
      if (allSeatsOccupied) {
        updatedGame.status = "ended";
        await updatedGame.save();
      }

      return res.status(200).json({
        message: "Seat booked successfully (TEST MODE)",
        seat: await SeatModel.findById(seat._id),
        gameStatus: updatedGame.status,
      });
    } catch (error) {
      console.error("Error in TestBookSeat:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email, role } = req.body;

      if (!email || !role || typeof email !== "string") {
        return res.status(400).json({ message: "Invalid email or role" });
      }

      // Find user with email and role
      const user = await UserModel.findOne({
        email: email.trim(),
        role: role.trim(),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Hash OTP before saving
      const hashedOTP = await bcrypt.hash(otp, 10);

      // Save OTP and expiry to user document
      user.resetPasswordOTP = hashedOTP;
      user.resetPasswordOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
      await user.save();

      // Send OTP via email
      await EmailService.sendOTPEmail(email, otp);

      res.status(200).json({ message: "OTP sent successfully to your email" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;

      const user = await UserModel.findOne({
        email,
        resetPasswordOTPExpiry: { $gt: Date.now() },
      });

      if (!user) {
        return res
          .status(400)
          .json({ message: "Invalid request or OTP expired" });
      }

      // Verify OTP
      const isValidOTP = await bcrypt.compare(otp, user.resetPasswordOTP);
      if (!isValidOTP) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Generate temporary token for password reset
      const tempToken = jwt.sign(
        { userId: user._id, purpose: "reset-password" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      res.status(200).json({ message: "OTP verified successfully", tempToken });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ message: "Error verifying OTP" });
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { newPassword } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res
          .status(401)
          .json({ message: "No authorization header provided" });
      }

      const tokenParts = authHeader.split(" ");
      if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
        return res
          .status(401)
          .json({ message: "Invalid authorization header format" });
      }

      const tempToken = tokenParts[1];
      if (!tempToken) {
        return res.status(401).json({ message: "No token provided" });
      }

      // Verify temp token
      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (decoded.purpose !== "reset-password") {
        return res.status(401).json({ message: "Invalid token purpose" });
      }

      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate new password
      if (!newPassword || newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters long" });
      }

      // Set the new password (it will be hashed by the pre-save middleware)
      user.password = newPassword;
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpiry = undefined;
      await user.save();

      res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Password reset error:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Invalid token" });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired" });
      }
      res
        .status(500)
        .json({ message: "Error resetting password: " + error.message });
    }
  },

  register: async (req, res) => {
    const { username, password, email, role, name, address, city, state, zipCode } = req.body;
    if (!username || !password || !email || !role || !name) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    try {
      const User = await UserModel.findOne({ username });
      if (User) {
        return res.status(400).json({ message: "User already exists" });
      }

      const newUser = new UserModel({
        username,
        password,
        email,
        role,
        name,
        address: address || "",
        city: city || "",
        state: state || "",
        zipCode: zipCode || "",
      });
      await newUser.save();
      return res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      console.error(error.message);
      return res.status(500).json({ message: error.message });
    }
  },
  login: async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    try {
      if (role !== "user" && role !== "admin") {
        return res.status(400).json({ message: "Invalid role" });
      }

      if (role === "admin") {
        const admin = await UserModel.findOne({ email, role });
        if (!admin) {
          return res.status(400).json({ message: "Admin not found" });
        }
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
          return res.status(400).json({ message: "Invalid credentials" });
        }
        const token = admin.generateAuthToken();
        return res.status(200).json({
          token,
          user: {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
          },
        });
      }

      const user = await UserModel.findOne({ email, role });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      const token = user.generateAuthToken();
      return res.status(200).json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          address: user.address,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  MakeRequest: async (req, res) => {
    const { gameId } = req.body;
    const userId = req.user._id;
    if (!gameId) {
      return res.status(400).json({ message: "Please fill all the fields" });
    }
    try {
      const request = await RequestModel.findOne({ userId, gameId });
      if (request) {
        return res.status(400).json({ message: "Request already exists" });
      }

      const newRequest = new RequestModel({
        userId,
        gameId,
      });

      if (!newRequest) {
        return res.status(400).json({ message: "Request not created" });
      }

      await newRequest.save();

      const game = await GameModel.findById(gameId);
      if (!game) {
        return res.status(400).json({ message: "Game not found" });
      }

      // Check for auto-approval setting
      const settings = await SettingModel.findOne();
      if (settings && settings.autoAcceptRequests) {
        newRequest.status = "approved";
        await newRequest.save();

        game.Approved_Users.push(userId);

        const user = await UserModel.findById(userId);
        if (user && user.email) {
          const subject = "Request Approved";
          const text =
            "Your request to join the game has been automatically approved.";
          await sendStatusUpdate(user.email, subject, text);
        }

        await game.save();
        return res
          .status(200)
          .json({ message: "Request automatically approved" });
      }

      // Original behavior: save as pending
      game.Pending_Requests.push(newRequest._id);
      await game.save();
      return res.status(201).json({ message: "Request created successfully" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
  CreatePaymentIntent: async (req, res) => {
    const { gameId, seatNumber } = req.body;
    console.log("Received gameId:", gameId);
    console.log("Received seatNumber:", seatNumber, "Type:", typeof seatNumber);
    try {
      const game = await GameModel.findById(gameId).populate("seats");
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.status === "ended") {
        return res.status(400).json({ message: "Game has already ended" });
      }

      console.log("Found game:", game);
      console.log("Game seats:", JSON.stringify(game.seats, null, 2));

      // Log each seat's number and type for debugging
      game.seats.forEach((seat) => {
        console.log(`Seat ${seat._id}:`, {
          seatNumber: seat.seatNumber,
          type: typeof seat.seatNumber,
        });
      });

      const seat = game.seats.find((seat) => {
        console.log(
          `Comparing: ${
            seat.seatNumber
          } (${typeof seat.seatNumber}) === ${seatNumber} (${typeof seat.seatNumber})`
        );
        return seat.seatNumber === Number(seatNumber);
      });

      if (!seat) {
        return res.status(404).json({ message: "Seat not found" });
      }

      if (seat.isOccupied) {
        return res.status(400).json({ message: "Seat is already occupied" });
      }

      const paymentIntent = await PaymentService.createPaymentIntent(
        seat.price,
        seat._id,
        gameId
      );

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        amount: seat.price,
      });
    } catch (error) {
      console.error("Error in CreatePaymentIntent:", error);
      return res
        .status(500)
        .json({ message: "Failed to create payment intent" });
    }
  },

  SelectSeat: async (req, res) => {
    const { gameId, seatNumber, paymentIntentId } = req.body;
    const userId = req.user._id;

    if (!gameId || !seatNumber || !paymentIntentId) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    try {
      const game = await GameModel.findOne({ gameId }).populate("seats");
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (game.status === "ended") {
        return res.status(400).json({ message: "Game has already ended" });
      }

      // Check if user has already booked a seat in this game
      const existingBooking = game.seats.find(
        (seat) => seat.userId && seat.userId.toString() === userId.toString()
      );
      if (existingBooking) {
        return res
          .status(400)
          .json({ message: "You have already booked a seat in this game" });
      }

      // Find the selected seat
      const seat = game.seats.find(
        (seat) => seat.seatNumber === Number(seatNumber)
      );
      if (!seat) {
        return res.status(404).json({ message: "Seat not found" });
      }

      if (seat.isOccupied) {
        return res.status(400).json({ message: "Seat is already occupied" });
      }

      // Confirm payment intent first
      try {
        await PaymentService.confirmPaymentIntent(paymentIntentId);
        await PaymentService.recordPayment(
          userId,
          seat.price,
          paymentIntentId,
          seat._id,
          gameId
        );
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Payment failed: " + error.message });
      }

      // Update seat status
      await SeatModel.findByIdAndUpdate(seat._id, {
        isOccupied: true,
        userId: userId,
        BookedAt: new Date(),
      });

      // Check if all seats are occupied
      const updatedGame = await GameModel.findOne({ gameId }).populate("seats");
      const allSeatsOccupied = updatedGame.seats.every(
        (seat) => seat.isOccupied
      );
      if (allSeatsOccupied) {
        updatedGame.status = "ended";
        await updatedGame.save();
      }

      return res.status(200).json({
        message: "Seat booked successfully",
        seat: await SeatModel.findById(seat._id),
        gameStatus: updatedGame.status,
      });
    } catch (error) {
      console.error("Error in SelectSeat:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  ProcessPayment: async (req, res) => {
    const { transactionId, cardDetails } = req.body;
    const userId = req.user._id;

    if (!transactionId || !cardDetails) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    // Validate card details
    if (
      !cardDetails.number ||
      !/^\d{16}$/.test(cardDetails.number.replace(/\s/g, ""))
    ) {
      return res.status(400).json({ message: "Invalid card number" });
    }
    if (!cardDetails.expiry || !/^\d{4}$/.test(cardDetails.expiry)) {
      return res.status(400).json({ message: "Invalid expiry date" });
    }
    if (!cardDetails.cvc || !/^\d{3}$/.test(cardDetails.cvc)) {
      return res.status(400).json({ message: "Invalid CVC" });
    }

    try {
      // Process payment with SwipeSimple
      const response = await axios.post(
        "https://api.swipesimple.com/v1/transactions/process",
        {
          transaction_id: transactionId,
          card: {
            number: cardDetails.number,
            expiry: cardDetails.expiry,
            cvc: cardDetails.cvc,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SWIPESIMPLE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "completed") {
        return res.status(200).json({
          status: "success",
          message: "Payment processed successfully",
        });
      } else {
        return res.status(400).json({
          status: "failed",
          message: "Payment processing failed",
        });
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      return res.status(500).json({
        status: "failed",
        message: error.response?.data?.message || "Failed to process payment",
      });
    }
  },

  UpdateProfile: async (req, res) => {
    const userId = req.user._id;
    const {
      username,
      email,
      name,
      currentPassword,
      newPassword,
      address,
      city,
      state,
      zipCode,
    } = req.body;

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      }

      // Check if email is already taken by another user
      if (email !== user.email) {
        const emailExists = await UserModel.findOne({
          email,
          _id: { $ne: userId },
        });
        if (emailExists) {
          return res.status(400).json({ message: "Email is already in use" });
        }
      }

      // Check if username is already taken by another user
      if (username !== user.username) {
        const usernameExists = await UserModel.findOne({
          username,
          _id: { $ne: userId },
        });
        if (usernameExists) {
          return res
            .status(400)
            .json({ message: "Username is already in use" });
        }
      }

      // Update user data
      user.username = username;
      user.email = email;
      user.name = name;
      user.address = address || "";
      user.city = city || "";
      user.state = state || "";
      user.zipCode = zipCode || "";
      if (newPassword) {
        user.password = newPassword;
      }

      await user.save();

      // Generate new token with updated information
      const token = user.generateAuthToken();

      return res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          address: user.address,
          city: user.city,
          state: user.state,
          zipCode: user.zipCode,
        },
        token,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  updateAddress: async (req, res) => {
    const userId = req.user._id;
    const { address, city, state, zipCode } = req.body;

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.address = address || "";
      user.city = city || "";
      user.state = state || "";
      user.zipCode = zipCode || "";
      await user.save();

      return res.status(200).json({
        message: "Address updated successfully",
        address: user.address,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
      });
    } catch (error) {
      console.error("Error updating address:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};

module.exports = UserController;
