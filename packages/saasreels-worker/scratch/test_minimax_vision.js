import dotenv from "dotenv";
import path from "path";

// Force load .env from the root
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const API_KEY = process.env.MINIMAX_RELAY_API_KEY;
const BASE_URL = process.env.MINIMAX_RELAY_BASE_URL;
const MODEL = process.env.MINIMAX_RELAY_MODEL;

console.log("Testing MiniMax Vision with:");
console.log("Base URL:", BASE_URL);
console.log("Model:", MODEL);

async function testVision() {
  const payload = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "这张图片是什么颜色的？请用中文简单回答。",
          },
          {
            type: "image_url",
            image_url: {
              // A small red dot base64
              url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
            },
          },
        ],
      },
    ],
    max_tokens: 300,
  };

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("--- Response ---");
      console.log(JSON.stringify(data, null, 2));
      console.log("\nResult Text:", data.choices[0].message.content);
    } else {
      console.error("--- Error Response ---");
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testVision();
