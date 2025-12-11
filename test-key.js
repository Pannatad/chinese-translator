
const apiKey = 'AIzaSyCwvHr0D6ATQiV1pBLIpSAmkhhthsG63p4';
const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

const models = [
    'gemini-1.5-flash',
    'gemini-2.5-flash' // The problematic one
];

async function testModel(model) {
    console.log(`\n--- Testing ${model}WithHeader ---`);
    const url = `${baseUrl}/${model}:generateContent`;
    const cleanKey = apiKey.trim();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': cleanKey // Testing header auth specifically
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const json = await response.json().catch(e => ({ error: 'Invalid JSON' }));
            console.log('Error Body:', JSON.stringify(json, null, 2));
        } else {
            console.log('SUCCESS! This model works.');
            const json = await response.json();
            console.log('Response:', json.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 20) + '...');
        }
    } catch (e) {
        console.log('Network Error:', e.message);
    }
}

async function runTests() {
    for (const model of models) {
        await testModel(model);
    }
}

runTests();
