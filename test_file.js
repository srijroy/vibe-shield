// Test file with various API keys for VibeShield testing

const axios = require('axios');

// OpenAI API key (high entropy - should be detected)
const openaiKey = "sk-proj-abcdef1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

// Brevo API key (high entropy - should be detected)
const brevoApiKey = "xkeysib-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2";

// Fake placeholder (low entropy - should be ignored)
const fakeKey = "YOUR_API_KEY_HERE";

// Another placeholder (should be ignored)
const testKey = "test123test123";

// Google API key (high entropy - should be detected)
const googleApiKey = "AIzaSyD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// GitHub token (high entropy - should be detected)
const githubToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz1234";

// Real-looking key in object
const config = {
  apiKey: "sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN",
  endpoint: "https://api.openai.com/v1"
};

// Function using the key
async function makeRequest() {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }]
    },
    {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}

module.exports = { makeRequest };