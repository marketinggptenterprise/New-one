import { googleFetch, json } from "./_google.js";

function idsFrom(body) {
  const accountId = String(body.accountName || "").replace(/^accounts\//, "");
  const locationId = String(body.locationName || "").replace(/^locations\//, "");
  const reviewId = String(body.reviewId || "").replace(/^.*\/reviews\//, "");
  if (!accountId || !locationId || !reviewId) return null;
  return { accountId, locationId, reviewId };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = req.body || {};
    const ids = idsFrom(body);
    const comment = String(body.comment || "").trim();
    if (!ids) return json(res, 400, { error: "Choose a valid review first." });
    if (!comment) return json(res, 400, { error: "Reply text is required." });

    const url = `https://mybusiness.googleapis.com/v4/accounts/${ids.accountId}/locations/${ids.locationId}/reviews/${ids.reviewId}/reply`;
    const result = await googleFetch(req, res, url, {
      method: "PUT",
      body: JSON.stringify({ comment })
    });

    json(res, 200, result);
  } catch (error) {
    json(res, error.status || 500, { error: error.message });
  }
}
