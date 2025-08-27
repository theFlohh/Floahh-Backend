const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
    },
    role: { type: String, enum: ["user", "admin"], default: "user" }, // Add role with default 'user'
    createdAt: { type: Date, default: Date.now },
    totalPoints: {
      type: Number,
      default: 0,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    profileImage: {
      type: String,
      default: null,
    },
    googleId: { type: String, default: null }, // Normal signup ke liye null rehne do
    resetOtp: String,
    resetOtpExpiry: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
