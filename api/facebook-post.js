function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = req.body || {};
    const pageId = String(body.pageId || "").trim();
    const pageAccessToken = String(body.pageAccessToken || "").trim();
    const message = String(body.message || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    if (!pageId) return json(res, 400, { error: "Facebook Page ID is required." });
    if (!pageAccessToken) return json(res, 400, { error: "Facebook Page Access Token is required." });
    if (!message && !imageUrl) return json(res, 400, { error: "Add a caption or image before posting." });

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v20.0/${pageId}/photos`
      : `https://graph.facebook.com/v20.0/${pageId}/feed`;

    const payload = new URLSearchParams({
      access_token: pageAccessToken
    });

    if (imageUrl) {
      payload.set("url", imageUrl);
      if (message) payload.set("caption", message);
    } else {
      payload.set("message", message);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body: payload
    });

    const data = await response.json();
    if (!response.ok) {
      return json(res, response.status, {
        error: data.error?.message || "Facebook post failed.",
        details: data.error
      });
    }

    json(res, 200, data);
  } catch (error) {
    json(res, 500, { error: error.message || "Facebook post failed." });
  }
}
