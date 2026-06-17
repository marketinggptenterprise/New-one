import { FB_SCOPES, json, redirectUri, requireFacebookConfig } from "./_facebook.js";

export default async function handler(req, res) {
  try {
    requireFacebookConfig();
    const url = new URL("https://www.facebook.com/v20.0/dialog/oauth");
    url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri(req));
    url.searchParams.set("scope", FB_SCOPES);
    url.searchParams.set("response_type", "code");
    res.statusCode = 302;
    res.setHeader("Location", url.href);
    res.end();
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
