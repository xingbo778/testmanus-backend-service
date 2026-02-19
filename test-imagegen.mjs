import dotenv from 'dotenv';
dotenv.config();

const yunwuUrl = process.env.YUNWU_API_URL;
const yunwuKey = process.env.YUNWU_API_KEY;
const apiUrl = yunwuUrl.replace(/\/$/, '') + '/v1/chat/completions';

console.log('Testing image generation...');
console.log('API URL:', apiUrl);

try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + yunwuKey,
    },
    body: JSON.stringify({
      model: 'gemini-3-pro-image-preview',
      messages: [
        { role: 'user', content: 'Generate an image: A simple red circle on white background. Only output the image.' }
      ],
      max_tokens: 8192,
    }),
    signal: controller.signal,
  });
  
  clearTimeout(timeoutId);
  console.log('Status:', resp.status);
  
  if (resp.ok) {
    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log('Content length:', content.length);
    console.log('Has base64:', content.includes('base64'));
    console.log('First 100 chars:', content.substring(0, 100));
  } else {
    const text = await resp.text();
    console.log('Error body:', text.substring(0, 500));
  }
} catch (e) {
  console.log('Error:', e.message);
  console.log('Error type:', e.constructor.name);
}
