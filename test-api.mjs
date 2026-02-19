import dotenv from 'dotenv';
dotenv.config();

const yunwuUrl = process.env.YUNWU_API_URL;
const yunwuKey = process.env.YUNWU_API_KEY;

console.log('YUNWU_API_URL:', yunwuUrl);
console.log('YUNWU_API_KEY exists:', !!yunwuKey);
console.log('YUNWU_API_KEY length:', yunwuKey?.length);

try {
  const resp = await fetch(yunwuUrl + '/v1/models', {
    headers: { Authorization: 'Bearer ' + yunwuKey },
    signal: AbortSignal.timeout(10000),
  });
  console.log('Status:', resp.status);
  const body = await resp.text();
  console.log('Body (first 200):', body.substring(0, 200));
} catch (e) {
  console.log('Error:', e.message);
}
