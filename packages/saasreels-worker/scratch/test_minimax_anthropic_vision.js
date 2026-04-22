import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const API_KEY = process.env.MINIMAX_RELAY_API_KEY;
const BASE_URL = process.env.MINIMAX_RELAY_BASE_URL;
const MODEL = process.env.MINIMAX_RELAY_MODEL;

console.log("Testing Anthropic-style Vision on MiniMax Relay:");
console.log("Model:", MODEL);

async function testAnthropicVision() {
  const payload = {
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
            },
          },
          {
            type: "text",
            text: "这张图片里是什么颜色？",
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${BASE_URL}/messages`, {
      // Note: Anthropic endpoint
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY, // Anthropic uses x-api-key
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("--- Anthropic Response ---");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error("--- Anthropic Error Response ---");
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testAnthropicVision();
