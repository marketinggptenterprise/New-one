import { googleFetch, json } from "./_google.js";

function idsFrom(locationName, accountName) {
  const accountId = String(accountName || "").replace(/^accounts\//, "");
  const locationId = String(locationName || "").replace(/^locations\//, "");
  if (!accountId || !locationId) return null;
  return { accountId, locationId };
}

export default async function handler(req, res) {
  try {
    const ids = idsFrom(req.query?.locationName, req.query?.accountName);
    if (!ids) return json(res, 400, { error: "Choose a valid business profile first." });

    const reviews = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({ pageSize: "50" });
      if (pageToken) params.set("pageToken", pageToken);
      const url = `https://mybusiness.googleapis.com/v4/accounts/${ids.accountId}/locations/${ids.locationId}/reviews?${params.toString()}`;
      const data = await googleFetch(req, res, url);
      reviews.push(...(data.reviews || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    json(res, 200, { reviews });
  } catch (error) {
    json(res, error.status || 500, { error: error.message });
  }
}
