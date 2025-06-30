const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");
const Artist = require("../models/Artist");
const Tier = require("../models/Tier"); // Import the Tier model
const DailyScore = require("../models/DailyScore");
const { determineCategory } = require("../utils/draftUtils");

exports.getDraftableArtists = async (req, res) => {
  const { category } = req.query; // category can be 'Legend', 'Trending', or 'Breakout'
  console.log("category is", category);
  
  try {
    // Find artists that belong to the specified category
    const tiers = await Tier.find({ tier: category }).populate("artistId");
    console.log("tiers are", tiers);
    
    const artists = tiers.map(tier => tier.artistId); // Extract the artist objects
    res.json(artists);
  } catch (err) {
    console.error("Error fetching draftable artists:", err.message);
    res.status(500).json({ error: "Failed to fetch draftable artists" });
  }
};

// exports.submitDraft = async (req, res) => {
//   const { draftedArtists } = req.body; // draftedArtists should be an array of artist IDs
//   const userId = req.user._id;
//   console.log("user Id is", userId);
  
//   try {
//     const userTeam = await UserTeam.create({ userId });
//     console.log("userTeam is", userTeam);
    
//     // Use Promise.all to await all category determinations
//     const teamMembers = await Promise.all(
//       draftedArtists.map(async (artistId) => {
//         const category = await determineCategory(artistId); // Await the category determination
//         return {
//           teamId: userTeam._id,
//           artistId,
//           category,
//         };
//       })
//     );

//     await TeamMember.insertMany(teamMembers);
//     res.status(201).json({ message: "Draft submitted successfully", teamId: userTeam._id });
//   } catch (err) {
//     console.error("Error submitting draft:", err.message);
//     res.status(500).json({ error: "Failed to submit draft" });
//   }
// };


exports.submitDraft = async (req, res) => {
  const { draftedArtists } = req.body; // draftedArtists should be an array of artist IDs
  const userId = req.user._id;
  console.log("User  ID is", userId);
  
  try {
    // Create the user team
    const userTeam = await UserTeam.create({ userId });
    console.log("User  Team created:", userTeam);
    
    // Use Promise.all to await all category determinations
    const teamMembers = await Promise.all(
      draftedArtists.map(async (artistId) => {
        const category = await determineCategory(artistId); // Await the category determination
        return {
          teamId: userTeam._id, // Link to the created user team
          artistId,
          category,
        };
      })
    );

    // Insert team members and get their IDs
    const insertedMembers = await TeamMember.insertMany(teamMembers);
    console.log("Inserted Team Members:", insertedMembers);
    
    // No need to update userTeam with teamMembers since we are using teamId in TeamMember
    res.status(201).json({ message: "Draft submitted successfully", teamId: userTeam._id });
  } catch (err) {
    console.error("Error submitting draft:", err.message);
    res.status(500).json({ error: "Failed to submit draft" });
  }
};



// exports.getUserDraft = async (req, res) => {
//   const  userId  = req.user._id; // Assuming user is authenticated
//   console.log("user id is", req.user);
  
//   try {
//     // Find the user's team
//     const userTeam = await UserTeam.findOne({ userId });
//     console.log("user team is", userTeam);
    
    
//     if (!userTeam) {
//       return res.status(404).json({ error: "User  team not found" });
//     }

//     // Find team members associated with the user's team
//     const teamMembers = await TeamMember.find({ teamId: userTeam._id }).populate("artistId");
//     console.log("team members are", teamMembers);
    

//     // Return the user team along with its team members
//     res.json({ userTeam, teamMembers });
//   } catch (err) {
//     console.error("Error fetching user draft:", err.message);
//     res.status(500).json({ error: "Failed to fetch user draft" });
//   }
// };




exports.getUserDraft = async (req, res) => {
  const userId = req.user._id;

  try {
    const userTeam = await UserTeam.findOne({ userId });

    if (!userTeam) {
      return res.status(404).json({ error: "User team not found" });
    }

    // Fetch team members with artist data
    const teamMembers = await TeamMember.find({ teamId: userTeam._id }).populate("artistId");

    // Fetch totalScores for each artist in parallel
    const enriched = await Promise.all(
      teamMembers.map(async (member) => {
        const scoreAgg = await DailyScore.aggregate([
          { $match: { artistId: member.artistId._id } },
          { $group: { _id: null, totalScore: { $sum: "$totalScore" } } },
        ]);
        const totalScore = scoreAgg[0]?.totalScore || 0;

        return {
          ...member.toObject(),
          artistId: {
            ...member.artistId.toObject(),
            totalScore,
          },
        };
      })
    );

    res.json({ userTeam, teamMembers: enriched });
  } catch (err) {
    console.error("Error fetching user draft:", err.message);
    res.status(500).json({ error: "Failed to fetch user draft" });
  }
};


exports.lockDraft = async (req, res) => {
  const userId = req.user._id; // Assuming user is authenticated
  try {
    const userTeam = await UserTeam.findOneAndUpdate(
      { userId },
      { isLocked: true },
      { new: true }
    );
    res.json({ message: "Draft locked successfully", team: userTeam });
  } catch (err) {
    console.error("Error locking draft:", err.message);
    res.status(500).json({ error: "Failed to lock draft" });
  }
};

exports.updateDraft = async (req, res) => {
  const userId = req.user._id;
  const { draftedArtists } = req.body; // draftedArtists should be an array of artist IDs
  try {
    // Find the user's team
    const userTeam = await UserTeam.findOne({ userId });
    if (!userTeam) {
      return res.status(404).json({ error: "User team not found" });
    }
    // Check if 12 hours have passed since creation
    const now = new Date();
    const createdAt = new Date(userTeam.createdAt);
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff < 12) {
      return res.status(403).json({ error: "You can only update your draft within 12 hours from creation." });
    }
    // Remove old team members
    await TeamMember.deleteMany({ teamId: userTeam._id });
    // Add new team members
    const teamMembers = await Promise.all(
      draftedArtists.map(async (artistId) => {
        const category = await determineCategory(artistId);
        return {
          teamId: userTeam._id,
          artistId,
          category,
        };
      })
    );
    await TeamMember.insertMany(teamMembers);
    res.status(200).json({ message: "Draft updated successfully" });
  } catch (err) {
    console.error("Error updating draft:", err.message);
    res.status(500).json({ error: "Failed to update draft" });
  }
};
