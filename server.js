const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cron = require("node-cron");
const path = require("path");
const spotifyRoutes = require("./routes/spotifyRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const artistRoutes = require("./routes/artistRoutes");
const {runDailyScoring} = require("./jobs/dailyScoringJob");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const tierRoutes = require("./routes/tierRoutes");
const draftRoutes = require("./routes/draftRoutes");
const userStatsRoutes = require("./routes/userStatsRoutes");
const runWeeklyTiering = require("./jobs/weeklyTieringJob");
const passport = require("./config/passport");
const session = require("express-session");
const contactUsRoutes = require("./routes/contactUsRoutes")

dotenv.config();
const app = express();
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(cors());
app.use(express.json());
// Serve static uploads (profile images, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(passport.initialize());
app.use(passport.session());
mongoose
.connect(process.env.MONGO_URI, {})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("Mongo error:", err));

app.get("/", (req, res) => {
  res.send("FLOHH API is running.");
});

app.use("/api/auth", authRoutes);
app.use("/api/spotify", spotifyRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/artist", artistRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/tier", tierRoutes);
app.use("/api/draft", draftRoutes);
app.use("/api/user-stats", userStatsRoutes);
app.use("/api/contact", contactUsRoutes);

// runDailyScoring();
// 

// 🕒 Schedule to run every day at 2 AM server time
cron.schedule("0 2 * * *", async () => {
  console.log("⏰ Running scheduled daily scoring job...");
  await runDailyScoring();
});

// runWeeklyTiering();
cron.schedule("0 3 * * 1", async () => {
  console.log("🕒 Running Weekly Tiering Job...");
  await runWeeklyTiering();
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
