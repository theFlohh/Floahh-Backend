const express = require("express");
const router = express.Router();
const { getScoringStatus } = require("../controllers/healthController");

router.get("/scoring-status", getScoringStatus);

module.exports = router;
