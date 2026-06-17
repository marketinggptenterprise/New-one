const FB_COOKIE = "fb_tokens";
const FB_VERSION = "v20.0";
const FB_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"].join(",");

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export function redirectUri(req) {
  return process.env.FACEBOOK_REDIRECT_URI || `${baseUrl(req)}/api/facebook-callback`;
}

export function requireFacebookConfig() {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    throw new Error("FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured in Vercel.");
  }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function readFacebookTokens(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`${FB_COOKIE}=([^;]+)`));
  return decode(match?.[1]);
}

export function setFacebookTokens(res, tokens) {
  res.setHeader(
    "Set-Cookie",
    `${FB_COOKIE}=${encode(tokens)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=5184000`
  );
}

export async function facebookFetch(req, path, params = {}) {
  const tokens = readFacebookTokens(req);
  if (!tokens?.access_token) {
    const error = new Error("Connect Facebook first.");
    error.status = 401;
    throw error;
  }

  const url = new URL(`https://graph.facebook.com/${FB_VERSION}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, value);
  });
  url.searchParams.set("access_token", tokens.access_token);

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Facebook API request failed.");
    error.status = response.status;
    error.details = data.error;
    throw error;
  }
  return data;
}

export { FB_SCOPES, FB_VERSION };
