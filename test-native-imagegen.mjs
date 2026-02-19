import dotenv from "dotenv";
dotenv.config();

const YUNWU_API_KEY = process.env.YUNWU_API_KEY;
const YUNWU_API_URL = process.env.YUNWU_API_URL || "https://yunwu.ai";

const model = "gemini-2.5-flash-image-preview";
const apiUrl = `${YUNWU_API_URL.replace(/\/$/, "")}/v1beta/models/${model}:generateContent?key=${YUNWU_API_KEY}`;

console.log(`Testing native Gemini image generation...`);
console.log(`URL: ${apiUrl.replace(YUNWU_API_KEY, "***")}`);

const body = {
  contents: [
    {
      role: "user",
      parts: [
        {
          text: "Generate a simple portrait of a young Asian man with short black hair, white background, realistic cinematic style",
        },
      ],
    },
  ],
  generationConfig: {
    responseModalities: ["TEXT", "IMAGE"],
  },
};

try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  console.log(`HTTP Status: ${response.status}`);

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Error: ${detail}`);
    process.exit(1);
  }

  const result = await response.json();
  
  if (result.candidates && result.candidates.length > 0) {
    const parts = result.candidates[0].content?.parts || [];
    console.log(`Parts count: ${parts.length}`);
    for (const part of parts) {
      if (part.inline_data) {
        console.log(`✅ Got image! mime: ${part.inline_data.mime_type}, data length: ${part.inline_data.data.length}`);
      }
      if (part.text) {
        console.log(`Text: ${part.text.substring(0, 200)}`);
      }
    }
  } else {
    console.error("No candidates in response");
    console.log(JSON.stringify(result).substring(0, 500));
  }
} catch (e) {
  console.error(`Failed: ${e.message}`);
}
