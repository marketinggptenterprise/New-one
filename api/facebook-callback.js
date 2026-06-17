import { baseUrl, json, redirectUri, requireFacebookConfig, setFacebookTokens } from "./_facebook.js";

export default async function handler(req, res) {
  try {
    requireFacebookConfig();
    const code = req.query?.code;
    if (!code) return json(res, 400, { error: "Missing Facebook authorization code." });

    const shortUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    shortUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID);
    shortUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET);
    shortUrl.searchParams.set("redirect_uri", redirectUri(req));
    shortUrl.searchParams.set("code", code);

    const shortResponse = await fetch(shortUrl);
    const shortData = await shortResponse.json();
    if (!shortResponse.ok) return json(res, shortResponse.status, { error: shortData.error?.message || "Facebook OAuth failed." });

    const longUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID);
    longUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortData.access_token);

    const longResponse = await fetch(longUrl);
    const longData = await longResponse.json();
    const tokenData = longResponse.ok ? longData : shortData;

    setFacebookTokens(res, {
      access_token: tokenData.access_token,
      expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null
    });

    res.statusCode = 302;
    res.setHeader("Location", `${baseUrl(req)}/`);
    res.end();
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
