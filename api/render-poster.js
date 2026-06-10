export default async function handler(req, res) {
  const prompt = String(req.query?.prompt || "professional local business social media poster").slice(0, 500);
  const width = String(req.query?.width || "1024");
  const height = String(req.query?.height || "1024");
  const seed = String(req.query?.seed || Date.now());

  const params = new URLSearchParams({
    width,
    height,
    nologo: "true",
    enhance: "true",
    seed
  });

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "PosterCreatorSuite/1.0"
      }
    });

    if (!response.ok) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain");
      res.end("Image provider failed");
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(buffer);
  } catch {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain");
    res.end("Image provider failed");
  }
}
