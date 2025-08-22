const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");
const DailyScore = require("../models/DailyScore");
const Artist = require("../models/Artist");
const path = require("path");

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "supersecret";

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ error: "Email already in use" });

    const hash = await bcrypt.hash(password, 10);
    let userRole = "user";
    console.log("Requested role:", role);
    console.log("x-admin-secret header:", req.headers["x-admin-secret"]);
    if (role === "admin" && req.headers["x-admin-secret"] === ADMIN_SECRET) {
      userRole = "admin";
    }
    console.log("Final userRole to save:", userRole);
    const user = await User.create({
      name,
      email,
      password: hash,
      role: userRole,
    });
    console.log("User created:", user);

    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    user.loginCount += 1;
    await user.save();
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
};

exports.getUserPointsBreakdown = async (req, res) => {
  const userId = req.user._id;

  try {
    const team = await UserTeam.findOne({ userId });
    if (!team) return res.status(404).json({ error: "User team not found" });

    const members = await TeamMember.find({ teamId: team._id });

    const artistIds = members.map((m) => m.artistId);

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // All-time
    const total = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      { $group: { _id: null, totalPoints: { $sum: "$totalScore" } } },
    ]);

    // Weekly
    const weekly = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $gte: weekAgo } } },
      { $group: { _id: null, weeklyPoints: { $sum: "$totalScore" } } },
    ]);

    // Daily
    const daily = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $gte: todayStart } } },
      { $group: { _id: null, dailyPoints: { $sum: "$totalScore" } } },
    ]);

    res.json({
      totalPoints: total[0]?.totalPoints || 0,
      weeklyPoints: weekly[0]?.weeklyPoints || 0,
      dailyPoints: daily[0]?.dailyPoints || 0,
    });
  } catch (err) {
    console.error("Error fetching user points breakdown:", err.message);
    res.status(500).json({ error: "Failed to fetch points" });
  }
};

exports.fetchAllUsers = async (req, res) => {
  try {
    // Only fetch users with role "user" (exclude admins)
    const users = await User.find({ role: "user" }, { password: 0 });

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const userTeam = await UserTeam.findOne({ userId: user._id });

        if (!userTeam) {
          return {
            ...user.toObject(),
            draftedTeam: null,
          };
        }

        const rawMembers = await TeamMember.find({ teamId: userTeam._id }).lean();
        const artistIds = rawMembers.map(m => m.artistId).filter(Boolean);
        const artists = await Artist.find({ _id: { $in: artistIds } }).lean();
        const artistById = new Map(artists.map(a => [a._id.toString(), a]));

        const enrichedMembers = await Promise.all(
          rawMembers.map(async (member) => {
            const artistObjectId = member.artistId;
            const scoreAgg = await DailyScore.aggregate([
              { $match: { artistId: artistObjectId } },
              { $group: { _id: null, totalScore: { $sum: "$totalScore" } } },
            ]);
            const totalScore = scoreAgg[0]?.totalScore || 0;

            const baseArtist = artistById.get(String(artistObjectId)) || { _id: artistObjectId };

            return {
              ...member,
              artistId: {
                ...baseArtist,
                totalScore,
              },
            };
          })
        );

        return {
          ...user.toObject(),
          draftedTeam: {
            teamName: userTeam.teamName,
            userTeam,
            teamMembers: enrichedMembers,
          },
        };
      })
    );

    res.json(enrichedUsers);
  } catch (err) {
    console.error("Error in fetchAllUsers:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
 exports.updateUser = async (req, res) => {
  const userId = req.user._id;
  const { name, email, password } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Check if email is being updated and already taken
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: "Email already in use" });
      }
      user.email = email;
    }

    // ✅ Update fields if provided
    if (name) user.name = name;

    // ✅ Handle profile image from multer (S3 URL use karo)
    if (req.file?.s3Url) {
      user.profileImage = req.file.s3Url;
    }

    // ✅ Hash new password if provided
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      user.password = hash;
    }

    await user.save();

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ error: "Failed to update user" });
  }
};

  exports.getUserDetails = async (req, res) => {
    const userId = req.user._id; // JWT middleware se aata hai

    try {
      const user = await User.findById(userId).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        password: user.password, // ⚠️ hashed password
        role: user.role,
        profileImage: user.profileImage,
        totalPoints: user.totalPoints,
        loginCount: user.loginCount,
        createdAt: user.createdAt,
      });
    } catch (err) {
      console.error("Get user details error:", err.message);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  };




