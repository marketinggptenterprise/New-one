import { getBaseUrl, json, redirectUri, requireGoogleConfig, setTokens } from "./_google.js";

export default async function handler(req, res) {
  try {
    requireGoogleConfig();
    const code = req.query?.code;
    if (!code) return json(res, 400, { error: "Missing Google authorization code." });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(req),
        grant_type: "authorization_code"
      })
    });
    const data = await response.json();
    if (!response.ok) return json(res, response.status, { error: data.error_description || data.error || "OAuth failed." });

    setTokens(res, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000
    });

    res.statusCode = 302;
    res.setHeader("Location", getBaseUrl(req) + "/");
    res.end();
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
