const express = require("express");
const AdminRoute = express.Router();
const AdminController = require("../controllers/admin.ctrl");
const RoleValidation = require("../middleware/roleValidator");
const authMiddleware = require("../middleware/auth");
const { handleImageUpload } = require("../middleware/upload");

AdminRoute.post(
  "/createGame",
  authMiddleware,
  RoleValidation(["admin"]),
  handleImageUpload,
  AdminController.createGame
);
AdminRoute.post(
  "/declare-random-winners",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.declareRandomWinners
);
AdminRoute.post(
  "/declareWinners",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.declareWinners
);
AdminRoute.post(
  "/endGame/:gameId",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.EndGame
);
AdminRoute.get(
  "/listAllGames",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.ListAllGames
);
AdminRoute.get(
  "/listAllSeats/:gameId",
  authMiddleware,
  RoleValidation(["admin", "user"]),
  AdminController.ListAllSeats
);
AdminRoute.get(
  "/listAllPendingRequest/:gameId",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.ListAllPendingRequest
);
AdminRoute.post(
  "/update/requestStatus/:requestId",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.RequestStatusUpdate
);
AdminRoute.put(
  "/update-profile",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.UpdateProfile
);
// Add image upload route
AdminRoute.post(
  "/upload-image",
  authMiddleware,
  RoleValidation(["admin"]),
  handleImageUpload,
  AdminController.uploadImage
);
AdminRoute.get(
  "/getAllUsers",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.getAllUsers
);

AdminRoute.get(
  "/settings",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.getSettings
);

AdminRoute.put(
  "/settings",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.updateSettings
);

AdminRoute.get(
  "/searchPlayer",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.searchPlayerByName
);

AdminRoute.delete(
  "/removePlayer/:userId",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.removePlayerFromSite
);

AdminRoute.post(
  "/removePlayerFromFreebieGame",
  authMiddleware,
  RoleValidation(["admin"]),
  AdminController.removePlayerFromFreebieGame
);

module.exports = AdminRoute;
