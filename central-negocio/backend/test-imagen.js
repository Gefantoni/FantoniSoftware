require('dotenv').config();
const axios = require('axios');

async function check() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
            {
                instances: [{ prompt: "A photorealistic pizza" }],
                parameters: { sampleCount: 1 }
            },
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log("Success! Fast model works.");
    } catch (err) {
        console.log("Error testing fast model:");
        console.log(err.response?.data || err.message);
    }
}
check();
