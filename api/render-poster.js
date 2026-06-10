export default async function handler(req, res) {
  const prompt = String(req.query?.prompt || "professional local business social media poster").slice(0, 500);
  const businessName = String(req.query?.businessName || "Local Business").slice(0, 70);
  const offerMatch = prompt.match(/Offer: ([^.]+)/);
  const locationMatch = prompt.match(/Location: ([^.]+)/);
  const offer = String(offerMatch?.[1] || "Fresh updates for your local customers").slice(0, 92);
  const location = String(locationMatch?.[1] || "").slice(0, 80);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" x2="1">
      <stop offset="0" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#fef3c7"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="844" cy="156" r="118" fill="#ffffff" opacity=".08"/>
  <circle cx="156" cy="838" r="180" fill="#f59e0b" opacity=".16"/>
  <rect x="82" y="92" width="860" height="840" rx="48" fill="#ffffff" opacity=".94"/>
  <rect x="126" y="136" width="772" height="752" rx="32" fill="#f8fafc"/>
  <rect x="126" y="136" width="772" height="18" fill="url(#gold)"/>
  <text x="512" y="268" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#0f766e">LOCAL BUSINESS UPDATE</text>
  <foreignObject x="166" y="326" width="692" height="190">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial, Helvetica, sans-serif;font-size:58px;line-height:1.05;font-weight:900;color:#111827;text-align:center;word-wrap:break-word;">${escapeHtml(businessName)}</div>
  </foreignObject>
  <foreignObject x="178" y="560" width="668" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial, Helvetica, sans-serif;font-size:38px;line-height:1.18;font-weight:800;color:#334155;text-align:center;word-wrap:break-word;">${escapeHtml(offer)}</div>
  </foreignObject>
  <rect x="246" y="746" width="532" height="78" rx="39" fill="#0f766e"/>
  <text x="512" y="797" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#ffffff">Contact Us Today</text>
  <text x="512" y="868" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#64748b">${escapeHtml(location)}</text>
</svg>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(svg);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
