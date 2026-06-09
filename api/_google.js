const TOKEN_COOKIE = "gbp_tokens";
const SCOPE = "https://www.googleapis.com/auth/business.manage";

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

export function redirectUri(req) {
  return process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/google-callback`;
}

export function requireGoogleConfig() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in Vercel.");
  }
}

export function encodeCookie(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCookie(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function readTokens(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  return decodeCookie(match?.[1]);
}

export function setTokens(res, tokens) {
  res.setHeader("Set-Cookie", `${TOKEN_COOKIE}=${encodeCookie(tokens)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
}

export async function refreshTokensIfNeeded(req, res) {
  const tokens = readTokens(req);
  if (!tokens?.access_token) return null;

  if (!tokens.expires_at || Date.now() < tokens.expires_at - 60000) return tokens;
  if (!tokens.refresh_token) return tokens;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok) return null;

  const next = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000
  };
  setTokens(res, next);
  return next;
}

export async function googleFetch(req, res, url, options = {}) {
  const tokens = await refreshTokensIfNeeded(req, res);
  if (!tokens) {
    const error = new Error("Connect Gmail first.");
    error.status = 401;
    throw error;
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || "Google API request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export { SCOPE };
