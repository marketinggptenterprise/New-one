import { googleFetch, json } from "./_google.js";

function localPostPath(locationName) {
  const match = String(locationName || "").match(/^locations\/(.+)$/);
  if (!match) return null;
  return match[1];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = req.body || {};
    const locationId = localPostPath(body.locationName);
    if (!locationId) return json(res, 400, { error: "Choose a valid Google Business Profile location." });
    if (!body.summary) return json(res, 400, { error: "Caption is required." });

    const post = {
      languageCode: "en-US",
      summary: body.summary,
      topicType: "STANDARD"
    };

    if (body.imageUrl) {
      post.media = [{ mediaFormat: "PHOTO", sourceUrl: body.imageUrl }];
    }

    if (body.buttonUrl) {
      post.callToAction = {
        actionType: body.actionType || "LEARN_MORE",
        url: body.buttonUrl
      };
    }

    const accountId = String(body.accountName || "").replace(/^accounts\//, "");
    if (!accountId) return json(res, 400, { error: "Choose the profile again so the account ID is included." });

    const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`;

    const result = await googleFetch(req, res, url, {
      method: "POST",
      body: JSON.stringify(post)
    });

    json(res, 200, result);
  } catch (error) {
    json(res, error.status || 500, { error: error.message });
  }
}
