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

function dataUrlToBuffer(value) {
  const parsed = cleanDataUrl(value);
  if (!parsed?.mimeType?.startsWith("image/")) return null;
  return {
    mimeType: parsed.mimeType,
    buffer: Buffer.from(parsed.data, "base64")
  };
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

function buildBackgroundPrompt(body) {
  return [
    "Create a premium commercial poster background for a local business advertisement.",
    "No words, no letters, no numbers, no logo, no signage, no readable text.",
    "Use realistic, brand-safe visuals that fit the business category.",
    "Leave clean open space for a headline, offer, logo, and contact details.",
    `Business name for context only, do not render it: ${body.businessName || "Local Business"}`,
    `Industry: ${body.industry || "local business"}`,
    `Offer context: ${body.topic || "promotional update"}`,
    `Location context: ${body.location || "local area"}`,
    `Style: ${body.style || "clean, premium, modern"}`,
    body.colors ? `Color palette: ${body.colors}` : "",
    "Professional social media design, high contrast, polished lighting."
  ].filter(Boolean).join("\n");
}

function safeText(value, fallback, max = 90) {
  return String(value || fallback).replace(/[<>]/g, "").slice(0, max);
}

function escapeSvg(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FONT_STACK = "DejaVu Sans, Liberation Sans, Arial, sans-serif";

function wrapLines(text, maxChars, maxLines) {
  const words = safeText(text, "", 160).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function posterOverlaySvg(body) {
  const business = wrapLines(body.businessName || "Local Business", 20, 3);
  const industry = safeText(body.industry || "Local business", "Local business", 44);
  const topic = wrapLines(body.topic || "New offer available now", 30, 3);
  const location = wrapLines(body.location || "", 46, 2);
  const businessSize = business.length > 2 ? 64 : 78;
  const topicSize = topic.length > 2 ? 38 : 46;

  const businessText = business.map((line, index) =>
    `<text x="512" y="${230 + index * (businessSize + 8)}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${businessSize}" font-weight="900" fill="#ffffff">${escapeSvg(line)}</text>`
  ).join("");
  const topicText = topic.map((line, index) =>
    `<text x="512" y="${548 + index * (topicSize + 8)}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${topicSize}" font-weight="800" fill="#12312d">${escapeSvg(line)}</text>`
  ).join("");
  const locationText = location.map((line, index) =>
    `<text x="512" y="${840 + index * 34}" text-anchor="middle" font-family="${FONT_STACK}" font-size="28" font-weight="700" fill="#e5f7f5">${escapeSvg(line)}</text>`
  ).join("");

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity=".62"/>
      <stop offset=".45" stop-color="#000000" stop-opacity=".18"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".58"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#shade)"/>
  <rect x="72" y="72" width="880" height="880" rx="46" fill="none" stroke="#ffffff" stroke-opacity=".78" stroke-width="6"/>
  <rect x="118" y="122" width="788" height="314" rx="34" fill="#0f172a" opacity=".86"/>
  <text x="512" y="174" text-anchor="middle" font-family="${FONT_STACK}" font-size="26" font-weight="800" fill="#7dd3fc">${escapeSvg(industry.toUpperCase())}</text>
  ${businessText}
  <rect x="118" y="482" width="788" height="190" rx="28" fill="#f8fafc" opacity=".96"/>
  ${topicText}
  <rect x="302" y="724" width="420" height="76" rx="38" fill="#0f766e"/>
  <text x="512" y="774" text-anchor="middle" font-family="${FONT_STACK}" font-size="32" font-weight="900" fill="#ffffff">Contact Us Today</text>
  ${locationText}
</svg>`);
}

async function prepareLogo(buffer) {
  if (!buffer) return null;
  const sharp = (await import("sharp")).default;
  return await sharp(buffer)
    .resize(150, 150, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function textSafePosterFromBuffer(backgroundBuffer, body, assets = {}) {
  const sharp = (await import("sharp")).default;
  const base = backgroundBuffer
    ? sharp(backgroundBuffer).resize(1024, 1024, { fit: "cover" })
    : sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: "#0f766e"
        }
      });

  const composites = [{ input: posterOverlaySvg(body), top: 0, left: 0 }];
  const logo = await prepareLogo(assets.logoBuffer);
  if (logo) {
    composites.push({
      input: logo,
      top: 146,
      left: 756
    });
  }

  return await base
    .composite(composites)
    .png()
    .toBuffer();
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

async function generateWithCloudflare(prompt, body, assets = {}) {
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
        prompt: [
          buildBackgroundPrompt(body),
          assets.referenceBuffer
            ? "Use the uploaded reference only as design inspiration: similar mood, colors, and composition, but do not copy any text from it."
            : ""
        ].filter(Boolean).join("\n"),
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
    const backgroundBuffer = Buffer.from(await response.arrayBuffer());
    const posterBuffer = await textSafePosterFromBuffer(backgroundBuffer, body, assets);
    return await uploadToBlob(posterBuffer, "image/png");
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

  const backgroundBuffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const posterBuffer = await textSafePosterFromBuffer(backgroundBuffer, body, assets);
  return await uploadToBlob(posterBuffer, "image/png");
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
  if (!apiKey && !["pollinations", "cloudflare", "openai"].includes(IMAGE_PROVIDER)) {
    return json(res, 500, { error: "GEMINI_API_KEY is not configured in Vercel." });
  }

  try {
    const body = req.body || {};
    const prompt = buildPrompt(body);
    const logoAsset = dataUrlToBuffer(body.logo);
    const referenceAsset = dataUrlToBuffer(body.referenceImage);
    const assets = {
      logoBuffer: logoAsset?.buffer,
      referenceBuffer: referenceAsset?.buffer
    };

    if (IMAGE_PROVIDER === "cloudflare" || (IMAGE_PROVIDER === "auto" && process.env.CLOUDFLARE_API_TOKEN)) {
      try {
        const image = await generateWithCloudflare(prompt, body, assets);
        return json(res, 200, {
          image,
          note: referenceAsset
            ? "Created from your reference image, logo, exact business details, and stored in Vercel Blob."
            : "Generated with Cloudflare Workers AI background, logo, exact business details, and stored in Vercel Blob."
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
