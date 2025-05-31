const axios = require("axios");

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_ID = "clockworks/free-tiktok-scraper"; // updated actor

async function triggerTikTokScraper(username) {
  try {
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${ACTOR_ID.replace("/", "~")}/runs?token=${APIFY_TOKEN}`,
      {
        input: {
          usernames: [username], // no @, just the username
          resultsLimit: 1
        }
      }
    );

    const runId = runResponse.data.data.id;

    let runStatus = "RUNNING";
    let output = null;

    while (runStatus === "RUNNING" || runStatus === "READY") {
      const statusRes = await axios.get(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );

      runStatus = statusRes.data.data.status;
      if (runStatus === "SUCCEEDED") {
        const datasetId = statusRes.data.data.defaultDatasetId;

        const dataRes = await axios.get(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
        );

        output = dataRes.data?.[0] || null;
        break;
      }

      await new Promise((r) => setTimeout(r, 5000)); // Wait 5s before polling again
    }

    return output;
  } catch (err) {
    console.error("❌ TikTok scraper error:", err);
    return null;
  }
}

module.exports = { triggerTikTokScraper };
