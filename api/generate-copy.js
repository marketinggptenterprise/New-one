const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const CLOUDFLARE_TEXT_MODEL =
  process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function cleanCaption(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*(\d+\.|[-*])\s*(Google Business Profile Caption|Ten Local SEO Keywords|Ten Hashtags|Local SEO Keywords|Hashtags).*$/gim, "")
    .replace(/^\s*-{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateWithCloudflare(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_TEXT_MODEL}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You write concise, ready-to-paste Google Business Profile captions. Return only the final caption."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 220
      })
    }
  );

  const data = await response.json();
  if (!response.ok || !data.success) return null;
  return data.result?.response || data.result?.text || data.result?.generated_text || "";
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    }
  );

  const data = await response.json();
  if (!response.ok) return null;
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const prompt = `Write ONE ready-to-paste Google Business Profile caption for this business.

Business: ${body.businessName || "Local Business"}
Industry: ${body.industry || "Local service business"}
Location: ${body.location || "Local area"}
Topic: ${body.topic || "New post"}

Strict output rules:
- Return only the final caption text.
- Do not add headings.
- Do not add numbering.
- Do not add bullet points.
- Do not add separate SEO keyword lists.
- Do not add explanations.
- Naturally include important local SEO keyword phrases inside the caption sentence, such as service + city, business category + area, and nearby/local terms.
- Include 5 to 8 relevant hashtags naturally at the end of the same caption.
- Keep the full caption under 700 characters.
- Use a useful, natural, non-spammy tone.
- Make it ready to copy and paste directly.`;

    const generated = await generateWithCloudflare(prompt) || await generateWithGemini(prompt);
    if (!generated) {
      return json(res, 500, { error: "Text generation failed. Check CLOUDFLARE_API_TOKEN or GEMINI_API_KEY." });
    }

    const text = cleanCaption(generated);
    return json(res, 200, { text: text || "No copy returned." });
  } catch (error) {
    return json(res, 500, { error: error.message || "Unexpected server error." });
  }
}
