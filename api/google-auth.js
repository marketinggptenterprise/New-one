import { SCOPE, getBaseUrl, json, redirectUri, requireGoogleConfig } from "./_google.js";

export default async function handler(req, res) {
  try {
    requireGoogleConfig();
    const state = Buffer.from(JSON.stringify({ returnTo: getBaseUrl(req) + "/google" })).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    res.statusCode = 302;
    res.setHeader("Location", url.href);
    res.end();
  } catch (error) {
    json(res, 500, { error: error.message });
  }
}
