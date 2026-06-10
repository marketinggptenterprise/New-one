const configuredModel = process.env.GEMINI_IMAGE_MODEL;
const IMAGE_MODEL =
  configuredModel && configuredModel !== "gemini-2.5-flash-image-preview"
    ? configuredModel
    : "gemini-2.5-flash-image";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "auto";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function cleanDataUrl(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

function buildPrompt(body) {
  return [
    "Create a polished social media poster for a local business.",
    "The poster should look premium, readable, modern, and ready for Google Business Profile or Instagram.",
    `Business name: ${body.businessName || "Local Business"}`,
    `Industry: ${body.industry || "Local service business"}`,
    `Offer or topic: ${body.topic || "Promotional update"}`,
    `Location: ${body.location || "Local area"}`,
    `Style: ${body.style || "clean, high-converting, professional"}`,
    body.colors ? `Preferred colors: ${body.colors}` : "",
    "Include short headline-style text, leave good spacing, and avoid clutter."
  ].filter(Boolean).join("\n");
}

function pollinationsImage(prompt) {
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    nologo: "true",
    enhance: "true",
    seed: String(Date.now())
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && IMAGE_PROVIDER !== "pollinations") {
    return json(res, 500, { error: "GEMINI_API_KEY is not configured in Vercel." });
  }

  try {
    const body = req.body || {};
    const prompt = buildPrompt(body);

    if (IMAGE_PROVIDER === "pollinations") {
      return json(res, 200, {
        image: pollinationsImage(prompt),
        note: "Generated with Pollinations."
      });
    }

    const logo = cleanDataUrl(body.logo);
    const reference = cleanDataUrl(body.referenceImage);

    const parts = [{ text: prompt }];
    if (logo) parts.push({ inlineData: logo });
    if (reference) parts.push({ inlineData: reference });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const message = data.error?.message || "Poster generation failed.";
      if (IMAGE_PROVIDER === "auto" && /quota|not found|not supported|rate/i.test(message)) {
        return json(res, 200, {
          image: pollinationsImage(prompt),
          note: `Gemini was unavailable, so this used Pollinations instead. Gemini said: ${message}`
        });
      }
      return json(res, response.status, {
        error: message,
        model: IMAGE_MODEL
      });
    }

    const partsOut = data.candidates?.[0]?.content?.parts || [];
    const image = partsOut.find((part) => part.inlineData?.data);
    const text = partsOut.find((part) => part.text)?.text || "";

    if (!image) {
      return json(res, 502, { error: "Gemini did not return an image.", details: text });
    }

    return json(res, 200, {
      image: `data:${image.inlineData.mimeType || "image/png"};base64,${image.inlineData.data}`,
      note: text
    });
  } catch (error) {
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
}
