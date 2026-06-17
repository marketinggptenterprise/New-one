import { googleFetch, json } from "./_google.js";

async function isUsableImage(url) {
  if (!/^https:\/\//i.test(url)) return false;
  if (url.includes("/api/render-poster")) return false;
  try {
    const response = await fetch(url, { method: "GET" });
    const type = response.headers.get("content-type") || "";
    return response.ok && /^image\/(png|jpe?g|webp)/i.test(type);
  } catch {
    return false;
  }
}

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

    if (body.imageUrl && await isUsableImage(String(body.imageUrl).trim())) {
      post.media = [{ mediaFormat: "PHOTO", sourceUrl: body.imageUrl }];
    }

    const actionType = String(body.actionType || "").trim();
    const buttonUrl = String(body.buttonUrl || "").trim();
    if (actionType === "CALL") {
      post.callToAction = {
        actionType: "CALL"
      };
    } else if (actionType && actionType !== "NONE" && buttonUrl && /^https:\/\//i.test(buttonUrl) && !buttonUrl.includes("yourwebsite.com")) {
      post.callToAction = {
        actionType,
        url: buttonUrl
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
