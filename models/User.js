const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" }, // Add role with default 'user'
  createdAt: { type: Date, default: Date.now },
  totalPoints: {
  type: Number,
  default: 0
},
});

module.exports = mongoose.model("User", UserSchema);
