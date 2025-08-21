const express = require("express");
const router = express.Router();
const {authMiddleware} = require("../middleware/authMiddleware"); // Import the middleware

const { uploadProfileImage } = require("../middleware/uploadMiddleware");
const {
  getDraftableArtists,
  submitDraft,
  getUserDraft,
  getUserTeamById,
  lockDraft,
  updateDraft, // Add updateDraft
} = require("../controllers/draftController");

// Apply authMiddleware to routes that require authentication
router.get("/artists", getDraftableArtists);
router.post("/drafts", authMiddleware, submitDraft); // Protect this route
router.get("/user_draft", authMiddleware, getUserDraft); // Protect this route
router.get("/user_team/:userId", getUserTeamById); // Get user team by ID
router.put("/drafts/lock", authMiddleware, lockDraft); // Protect this route
router.put("/drafts/update", authMiddleware, uploadProfileImage.single("avatar"), updateDraft); // Add update draft route

module.exports = router;
