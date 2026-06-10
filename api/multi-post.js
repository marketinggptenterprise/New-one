import googlePostHandler from "./google-post.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function createSubResponse() {
  let statusCode = 200;
  let payload = null;
  return {
    get statusCode() {
      return statusCode;
    },
    set statusCode(value) {
      statusCode = value;
    },
    setHeader() {},
    end(value) {
      try {
        payload = value ? JSON.parse(value) : null;
      } catch {
        payload = value;
      }
    },
    json(value) {
      payload = value;
    },
    get payload() {
      return payload;
    }
  };
}

async function postFacebook(body) {
  const pageId = String(body.facebookPageId || "").trim();
  const pageAccessToken = String(body.facebookPageAccessToken || "").trim();
  const message = String(body.summary || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();

  if (!pageId || !pageAccessToken) {
    return { skipped: true, error: "Facebook Page ID or token missing." };
  }

  const endpoint = imageUrl
    ? `https://graph.facebook.com/v20.0/${pageId}/photos`
    : `https://graph.facebook.com/v20.0/${pageId}/feed`;
  const payload = new URLSearchParams({ access_token: pageAccessToken });

  if (imageUrl) {
    payload.set("url", imageUrl);
    if (message) payload.set("caption", message);
  } else {
    payload.set("message", message);
  }

  const response = await fetch(endpoint, { method: "POST", body: payload });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error?.message || "Facebook post failed.", details: data.error };
  }
  return { ok: true, data };
}

async function postGoogle(req, body) {
  const locations = Array.isArray(body.googleTargets) ? body.googleTargets : [];
  const results = [];

  for (const target of locations) {
    const subReq = {
      ...req,
      method: "POST",
      body: {
        locationName: target.locationName,
        accountName: target.accountName,
        summary: body.summary,
        imageUrl: body.imageUrl,
        actionType: body.actionType,
        buttonUrl: body.buttonUrl
      }
    };
    const subRes = createSubResponse();
    await googlePostHandler(subReq, subRes);
    results.push({
      title: target.title,
      locationName: target.locationName,
      status: subRes.statusCode,
      ok: subRes.statusCode >= 200 && subRes.statusCode < 300,
      result: subRes.payload
    });
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = req.body || {};
    const [facebook, google] = await Promise.all([
      postFacebook(body),
      postGoogle(req, body)
    ]);

    json(res, 200, { facebook, google });
  } catch (error) {
    json(res, 500, { error: error.message || "Multi-post failed." });
  }
}
