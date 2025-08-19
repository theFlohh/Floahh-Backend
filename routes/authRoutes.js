const express = require("express");
const router = express.Router();
const { register, login, getUserPointsBreakdown, fetchAllUsers, updateUser,getUserDetails } = require("../controllers/authController");
const { authMiddleware, requireAdmin, requireUser } = require("../middleware/authMiddleware");
const { uploadProfileImage } = require("../middleware/uploadMiddleware"); // <-- tumhari file ka naam

// Middleware imported and ready for use in other routes if needed
router.post("/register", register);
router.post("/login", login);
router.get("/user-points", authMiddleware, getUserPointsBreakdown);
router.get('/all-users', fetchAllUsers);
router.put('/update', authMiddleware,  uploadProfileImage.single("profileImage"),updateUser);

router.get("/me", authMiddleware,getUserDetails);
module.exports = router;
