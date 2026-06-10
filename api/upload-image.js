function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) return null;
  return {
    contentType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64")
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) return json(res, 400, { error: "Upload a PNG, JPG, or WebP image." });
    if (parsed.buffer.length > 4 * 1024 * 1024) {
      return json(res, 413, { error: "Image is too large. Use an image under 4 MB." });
    }

    const { put } = await import("@vercel/blob");
    const extension = parsed.contentType.includes("webp")
      ? "webp"
      : parsed.contentType.includes("png")
        ? "png"
        : "jpg";

    const blob = await put(`posters/upload-${Date.now()}.${extension}`, parsed.buffer, {
      access: "public",
      contentType: parsed.contentType,
      addRandomSuffix: true
    });

    json(res, 200, { url: blob.url, pathname: blob.pathname });
  } catch (error) {
    json(res, 500, { error: error.message || "Upload failed." });
  }
}
