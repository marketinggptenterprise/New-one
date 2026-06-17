const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const CLOUDFLARE_TEXT_MODEL =
  process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fallbackReply(body) {
  const name = body.businessName || "our business";
  const rating = Number(body.rating || 0);
  if (rating >= 4) {
    return `Thank you for your kind review and for choosing ${name}. We truly appreciate your support and look forward to serving you again.`;
  }
  if (rating > 0 && rating <= 2) {
    return `Thank you for sharing your feedback. We are sorry your experience did not meet expectations. Please contact us directly so we can understand what happened and make it right.`;
  }
  return `Thank you for taking the time to share your feedback. We appreciate it and look forward to serving you again.`;
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
            content: "You write concise, professional Google review replies. Return only the reply."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 160
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
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = req.body || {};
  try {
    const prompt = `Write a professional Google Business Profile review reply.

Business: ${body.businessName || "Local Business"}
Rating: ${body.rating || "unknown"}
Reviewer: ${body.reviewer || "customer"}
Review text: ${body.reviewText || ""}

Rules:
- Reply as the business owner.
- Keep it warm, concise, and natural.
- Do not mention AI.
- Do not offer discounts.
- For negative reviews, apologize and invite the customer to contact the business directly.
- Maximum 450 characters.`;

    const text = (await generateWithCloudflare(prompt) || await generateWithGemini(prompt) || "").trim();
    json(res, 200, { text: text || fallbackReply(body) });
  } catch (error) {
    json(res, 200, { text: fallbackReply(body), fallback: true, providerError: error.message });
  }
}
