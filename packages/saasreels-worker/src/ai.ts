export interface AiFetchOptions {
  apiKey: string;
  model: string;
  endpoint: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callAiModel(prompt: string, options: AiFetchOptions): Promise<string> {
  const { apiKey, model, endpoint, systemPrompt, temperature = 0.7, maxTokens = 4000 } = options;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI model call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI model returned empty response");
  }

  return content;
}
