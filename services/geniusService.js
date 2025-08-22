const axios = require("axios");

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

// Recursive function to extract plain text from Genius description DOM
function extractPlainText(domNode) {
  if (!domNode) return "";

  if (typeof domNode === "string") {
    return domNode; // direct text
  }

  if (Array.isArray(domNode)) {
    return domNode.map(extractPlainText).join("");
  }

  if (domNode.children) {
    return extractPlainText(domNode.children);
  }

  return "";
}

async function getGeniusDescription(artistName) {
  try {
    // Step 1: Search artist by name
    const searchRes = await axios.get("https://api.genius.com/search", {
      params: { q: artistName },
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });
console.log(searchRes, "step1")
    const hits = searchRes.data.response.hits;
    if (!hits || hits.length === 0) return "No description available";
console.log(hits,"step2")
    const artistId = hits[0].result.primary_artist.id;
console.log(artistId, "step3")
    // Step 2: Fetch artist details by ID
    const artistRes = await axios.get(`https://api.genius.com/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });
console.log(artistRes, "step4")
    const descriptionDom = artistRes.data.response.artist.description?.dom;
    if (!descriptionDom) return "No description available";
console.log(descriptionDom,"step5")
    // Step 3: Convert DOM-like object into plain text
    const description = extractPlainText(descriptionDom);
console.log(description,"step6")
    return description || "No description available";
  } catch (err) {
    console.error("Genius API error:", err.message);
    return "No description available";
  }
}

module.exports = { getGeniusDescription };
