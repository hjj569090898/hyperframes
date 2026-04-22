import fs from "node:fs/promises";
import path from "node:path";

export interface AiFetchOptions {
  apiKey: string;
  model: string;
  endpoint: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  imageUrls?: string[]; // New: support for vision
}

export async function callAiModel(prompt: string, options: AiFetchOptions): Promise<string> {
  const {
    apiKey,
    model,
    endpoint,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    imageUrls = [],
  } = options;

  const isMoonshot = endpoint.includes("moonshot.cn") || model.includes("moonshot");
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Handle multi-modal content
  if (imageUrls.length > 0) {
    const content: any[] = [{ type: "text", text: prompt }];

    for (const url of imageUrls) {
      if (isMoonshot) {
        // Moonshot requires Base64 for images
        let success = false;
        let attempts = 0;
        while (attempts < 3 && !success) {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType =
              response.headers.get("content-type") ||
              (url.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
            content.push({
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64}` },
            });
            console.log(
              `[AI] Converted ${url.split("/").pop()} to Base64 (Attempt ${attempts + 1})`,
            );
            success = true;
          } catch (e) {
            attempts++;
            console.warn(`[AI] Fetch failed for ${url}, retry ${attempts}/3...`);
            if (attempts >= 3) throw e;
            await new Promise((r) => setTimeout(r, 1000 * attempts)); // Backoff
          }
        }
      } else {
        content.push({
          type: "image_url",
          image_url: { url },
        });
      }
    }
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const startTime = Date.now();
  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(isMoonshot ? {} : { response_format: { type: "json_object" } }),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    await logAiCall({
      endpoint,
      model,
      duration,
      request: requestBody,
      response: errorText,
      success: false,
    });
    throw new Error(`AI model call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;

  await logAiCall({
    endpoint,
    model,
    duration,
    request: requestBody,
    response: data,
    success: true,
  });

  if (content) {
    // Robustly extract JSON if there's surrounding text or markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
  }

  if (!content) {
    throw new Error("AI model returned empty response");
  }

  return content;
}

/**
 * Logs AI request/response to a local file for debugging.
 */
async function logAiCall(data: any) {
  try {
    const logDir = path.join(process.cwd(), "logs");
    await fs.mkdir(logDir, { recursive: true });

    // Scrape Base64 images for logs to keep it readable
    const cleanRequest = JSON.parse(JSON.stringify(data.request));
    if (cleanRequest.messages) {
      for (const m of cleanRequest.messages) {
        if (Array.isArray(m.content)) {
          for (const c of m.content) {
            if (c.image_url?.url?.startsWith("data:")) {
              c.image_url.url = "[BASE64_IMAGE_DATA_TRUNCATED]";
            }
          }
        }
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...data,
      request: cleanRequest,
    };

    const logFile = path.join(logDir, "ai_calls.log");
    await fs.appendFile(logFile, JSON.stringify(logEntry, null, 2) + "\n---\n");
  } catch (e) {
    console.error("[Logger] Failed to write AI log:", e);
  }
}
