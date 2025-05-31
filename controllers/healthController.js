const { getLastScoringTime } = require("../jobs/dailyScoringJob");

exports.getScoringStatus = (req, res) => {
  const lastRun = getLastScoringTime();

  if (lastRun) {
    res.json({
      status: "ok",
      lastRun: lastRun.toISOString(),
    });
  } else {
    res.status(503).json({
      status: "not_run_yet",
      message: "Scoring job has not run since server started.",
    });
  }
};
