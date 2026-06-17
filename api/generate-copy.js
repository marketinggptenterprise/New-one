const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: "GEMINI_API_KEY is not configured in Vercel." });
  }

  try {
    const body = req.body || {};
    const prompt = `Write local SEO marketing copy for this business.

Business: ${body.businessName || "Local Business"}
Industry: ${body.industry || "Local service business"}
Location: ${body.location || "Local area"}
Topic: ${body.topic || "New post"}

Return:
1. One Google Business Profile caption under 700 characters.
2. Ten local SEO keywords.
3. Ten hashtags.
Use a useful, natural, non-spammy tone.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return json(res, response.status, { error: data.error?.message || "Copy generation failed." });
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    return json(res, 200, { text: text || "No copy returned." });
  } catch (error) {
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
}
