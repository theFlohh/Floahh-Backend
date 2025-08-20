const express = require("express");
const passport = require("passport");
const router = express.Router();
const jwt = require("jsonwebtoken");

const {
  register,
  login,
  getUserPointsBreakdown,
  fetchAllUsers,
  updateUser,
  getUserDetails,
} = require("../controllers/authController");

const {
  authMiddleware,
  requireAdmin,
  requireUser,
} = require("../middleware/authMiddleware");

const { uploadProfileImage } = require("../middleware/uploadMiddleware");

// ------------------ Existing Routes ------------------
router.post("/register", register);
router.post("/login", login);
router.get("/user-points", authMiddleware, getUserPointsBreakdown);
router.get("/all-users", fetchAllUsers);
router.put(
  "/update",
  authMiddleware,
  uploadProfileImage.single("profileImage"),
  updateUser
);
router.get("/me", authMiddleware, getUserDetails);

// ------------------ Google OAuth Routes ------------------

// Step 1: Redirect user to Google login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
        console.log("User after Google login:", req.user);
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
console.log("Generated JWT token:", token);
res.redirect(`https://floahh-frontend.onrender.com/login?token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
console.log("Redirecting to client with token and user data");
    // res.json({
    //   message: "Google login successful",
    //   user: req.user,
    // });
  }
);

// Step 3: Logout
router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Step 4: Current user from session (for testing without JWT)
router.get("/google/me", (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: "Not authenticated with Google" });
  }
});

module.exports = router;
