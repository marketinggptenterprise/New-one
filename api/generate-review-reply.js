const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 200, { text: fallbackReply(body), fallback: true });

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    if (!response.ok) return json(res, 200, { text: fallbackReply(body), fallback: true, providerError: data.error?.message });

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    json(res, 200, { text: text || fallbackReply(body) });
  } catch (error) {
    json(res, 200, { text: fallbackReply(body), fallback: true, providerError: error.message });
  }
}
