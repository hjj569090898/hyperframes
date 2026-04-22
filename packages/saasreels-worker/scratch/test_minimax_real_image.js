import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "../../.env") });

const API_KEY = process.env.MINIMAX_RELAY_API_KEY;
const BASE_URL = process.env.MINIMAX_RELAY_BASE_URL;

// Test both model names
const MODELS = ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"];

async function testVision(model) {
  console.log(`\n--- Testing Model: ${model} ---`);

  const payload = {
    model: model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "这张图片里有一个什么动物？请用中文回答。",
          },
          {
            type: "image_url",
            image_url: {
              // A clear image of a red panda
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Red_Panda_%2825193861686%29.jpg/640px-Red_Panda_%2825193861686%29.jpg",
            },
          },
        ],
      },
    ],
    max_tokens: 500,
    // Add the extra_body as noted in official docs
    extra_body: {
      reasoning_split: true,
    },
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
      console.log("Result Text:", data.choices[0].message.content);
      if (data.choices[0].message.reasoning_details) {
        console.log("Reasoning:", data.choices[0].message.reasoning_details[0].text);
      }
    } else {
      console.error("Error Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function run() {
  for (const model of MODELS) {
    await testVision(model);
  }
}

run();
