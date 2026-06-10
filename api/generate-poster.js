const configuredModel = process.env.GEMINI_IMAGE_MODEL;
const IMAGE_MODEL =
  configuredModel && configuredModel !== "gemini-2.5-flash-image-preview"
    ? configuredModel
    : "gemini-2.5-flash-image";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "auto";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const CLOUDFLARE_IMAGE_MODEL =
  process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

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
  const compactPrompt = prompt
    .replace(/\s+/g, " ")
    .replace(/Business name:/g, "Business:")
    .replace(/Offer or topic:/g, "Offer:")
    .slice(0, 360);
  const params = new URLSearchParams({
    prompt: compactPrompt,
    businessName: compactPrompt.match(/Business: ([^\n.]+)/)?.[1] || "",
    width: "1024",
    height: "1024",
    seed: String(Date.now())
  });
  return `/api/render-poster?${params.toString()}`;
}

async function uploadToBlob(buffer, contentType = "image/png") {
  const { put } = await import("@vercel/blob");
  const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const blob = await put(`posters/poster-${Date.now()}.${extension}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true
  });
  return blob.url;
}

async function generateWithCloudflare(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be configured in Vercel.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        width: 1024,
        height: 1024,
        num_steps: 4
      })
    }
  );

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const errorData = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { errors: [{ message: await response.text().catch(() => "") }] };
    throw new Error(errorData.errors?.[0]?.message || "Cloudflare image generation failed.");
  }

  if (contentType.startsWith("image/")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return await uploadToBlob(buffer, contentType);
  }

  const data = await response.json();
  const base64 =
    data.result?.image ||
    data.result?.b64_json ||
    data.result?.[0]?.image ||
    data.result?.[0]?.b64_json;
  if (!base64) {
    throw new Error("Cloudflare did not return an image.");
  }

  const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  return await uploadToBlob(buffer, "image/png");
}

async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Vercel.");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: "1024x1024"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI image generation failed.");
  }

  const item = data.data?.[0];
  if (item?.url) return item.url;
  if (!item?.b64_json) throw new Error("OpenAI did not return an image.");

  const buffer = Buffer.from(item.b64_json, "base64");
  const blobUrl = await uploadToBlob(buffer, "image/png");
  if (!blobUrl) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return blobUrl;
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

    if (IMAGE_PROVIDER === "cloudflare" || (IMAGE_PROVIDER === "auto" && process.env.CLOUDFLARE_API_TOKEN)) {
      try {
        const image = await generateWithCloudflare(prompt);
        return json(res, 200, {
          image,
          note: "Generated with Cloudflare Workers AI and stored in Vercel Blob."
        });
      } catch (error) {
        if (IMAGE_PROVIDER === "cloudflare") {
          return json(res, 500, { error: error.message });
        }
      }
    }

    if (IMAGE_PROVIDER === "openai" || (IMAGE_PROVIDER === "auto" && process.env.OPENAI_API_KEY)) {
      try {
        const image = await generateWithOpenAI(prompt);
        return json(res, 200, {
          image,
          note: image.startsWith("http") ? "Generated with OpenAI and stored as a public image URL." : "Generated with OpenAI."
        });
      } catch (error) {
        if (IMAGE_PROVIDER === "openai") {
          return json(res, 500, { error: error.message });
        }
      }
    }

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
