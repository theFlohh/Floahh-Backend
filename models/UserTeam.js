    const mongoose = require("mongoose");

    const UserTeamSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User ", required: true },
    teamName: { type: String },
    isLocked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date },
    });

    module.exports = mongoose.model("UserTeam", UserTeamSchema);
