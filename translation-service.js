
import { GoogleGenerativeAI } from "@google/generative-ai";

export class TranslationService {
    constructor() {
        this.apiKey = null;
        this.genAI = null;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        if (apiKey) {
            console.log(`API Key configured (Length: ${apiKey.length})`);
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    /**
     * Translates text or image with optional streaming support
     * @param {string|object} input - Text string OR Image Data object { mimeType, data }
     * @param {string} targetLanguage - Target language
     * @param {function} onStreamUpdate - Optional callback for streaming updates (Text only)
     * @returns {Promise<string>} - Final translated text
     */
    async translate(input, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.apiKey || !this.genAI) {
            throw new Error('API key not configured. Please check your settings.');
        }

        const languageName = targetLanguage === 'thai' ? 'Thai (ภาษาไทย)' : 'English';

        let payload;

        if (typeof input === 'string') {
            // Text mode - simple string prompt works
            payload = `Translate this text to ${languageName}:\n${input}`;
        } else if (typeof input === 'object' && input.data) {
            // Vision Mode - Per Google Docs, array format requires objects
            // https://ai.google.dev/gemini-api/docs/image-understanding
            const imagePart = {
                inlineData: {
                    mimeType: input.mimeType || "image/jpeg",
                    data: input.data
                }
            };
            // Text MUST be wrapped as { text: "..." } in array format!
            // UPDATED: Ask to preserve layout (bullet points, line breaks)
            const textPart = {
                text: `Transcribe and translate the text in this image to ${languageName}. 
IMPORTANT: Preserve the original layout structure. If the text has bullet points, keep each item on a separate line with a bullet (•). 
If there are multiple lines, translate each line separately and maintain the line breaks.
Output ONLY the translation, maintaining the same visual structure as the original.` };

            payload = [imagePart, textPart]; // Docs show image first, then text
        }

        console.time('TranslationAPI');

        try {
            // STRATEGY: Speed-First Daisy Chain
            // 1. Try gemini-2.5-flash (FAST - Recommended)
            // 2. Fallback to gemini-3-pro-preview (Slow but powerful)
            // 3. Last Resort: gemini-1.5-flash (Reliable)

            try {
                // Priority 1 - FAST
                console.log('Attempting Priority 1: gemini-2.5-flash (Fast)');
                const model = this.genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    generationConfig: { temperature: 0.1, candidateCount: 1 }
                });
                const result = await this._generateWithTimeout(model, payload, onStreamUpdate, 45000); // 45s timeout
                console.timeEnd('TranslationAPI');
                return result;

            } catch (error1) {
                console.warn("Priority 1 failed:", error1.message);

                try {
                    // Priority 2 - Powerful but slow
                    console.log('Attempting Priority 2: gemini-3-pro-preview');
                    const model2 = this.genAI.getGenerativeModel({
                        model: "gemini-3-pro-preview",
                        generationConfig: { temperature: 0.1, candidateCount: 1 }
                    });
                    const result = await this._generateWithTimeout(model2, payload, onStreamUpdate, 60000); // 60s timeout
                    console.timeEnd('TranslationAPI');
                    return result;

                } catch (error2) {
                    console.warn("Priority 2 failed:", error2.message);

                    // Priority 3 (Guaranteed Fallback)
                    console.log('Attempting Priority 3: gemini-1.5-flash (Reliable)');
                    const model3 = this.genAI.getGenerativeModel({
                        model: "gemini-1.5-flash",
                        generationConfig: { temperature: 0.1, candidateCount: 1 }
                    });

                    // No timeout for the safe model
                    const result = await this._generateWithRetry(model3, payload, onStreamUpdate);
                    console.timeEnd('TranslationAPI');
                    return result;
                }
            }

        } catch (error) {
            console.error('All translation attempts failed:', error);
            throw new Error(`System Failure: ${error.message}`);
        }
    }

    /**
     * Translates image with word-by-word mapping for highlighting feature
     * @param {object} imageData - Image Data object { mimeType, data }
     * @param {string} targetLanguage - Target language
     * @returns {Promise<object>} - { fullTranslation, wordPairs: [{chinese, pinyin, english}] }
     */
    async translateWithWordPairs(imageData, targetLanguage = 'english') {
        if (!this.apiKey || !this.genAI) {
            throw new Error('API key not configured. Please check your settings.');
        }

        const languageName = targetLanguage === 'thai' ? 'Thai' : 'English';

        const imagePart = {
            inlineData: {
                mimeType: imageData.mimeType || "image/jpeg",
                data: imageData.data
            }
        };

        const textPart = {
            text: `Analyze the Chinese text in this image and provide a translation with word-by-word mapping.

Return a JSON object in this EXACT format (no markdown, just raw JSON):
{
  "originalText": "The original Chinese text as seen in the image",
  "fullTranslation": "The complete ${languageName} translation",
  "wordPairs": [
    {"chinese": "你好", "pinyin": "nǐ hǎo", "translation": "hello"},
    {"chinese": "今天", "pinyin": "jīn tiān", "translation": "today"}
  ]
}

Important rules:
1. Include ALL significant words/phrases from the Chinese text
2. Group multi-character words appropriately (don't split 今天 into 今 and 天)
3. Provide accurate pinyin with tone marks
4. The translation should be in ${languageName}
5. Return ONLY the JSON object, no explanations or markdown`
        };

        const payload = [imagePart, textPart];

        console.log('Requesting word-pair translation...');

        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.1,
                    candidateCount: 1,
                    responseMimeType: "application/json"
                }
            });

            const result = await model.generateContent(payload);
            const response = await result.response;
            const text = response.text();

            // Parse JSON response
            try {
                const parsed = JSON.parse(text);
                return {
                    originalText: parsed.originalText || '',
                    fullTranslation: parsed.fullTranslation || '',
                    wordPairs: parsed.wordPairs || []
                };
            } catch (parseError) {
                console.error('Failed to parse word pairs JSON:', parseError);
                // Fallback: return just the text as full translation
                return {
                    originalText: '',
                    fullTranslation: text,
                    wordPairs: []
                };
            }

        } catch (error) {
            console.error('Word pair translation failed:', error);
            throw error;
        }
    }

    // New helper: Race request against timeout
    async _generateWithTimeout(model, prompt, onStreamUpdate, timeoutMs = 10000) {
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        // Race the actual request against timeout
        const result = await Promise.race([
            this._generateWithRetry(model, prompt, onStreamUpdate),
            timeoutPromise
        ]);
        return result;
    }

    // Helper method to handle retries and streaming
    async _generateWithRetry(model, prompt, onStreamUpdate) {
        let lastError;
        const isVision = Array.isArray(prompt); // Detect Vision payload

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (isVision) {
                    // Vision: Non-streaming for stability (Gemini 3/2.5)
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const text = response.text();
                    return text;
                } else if (onStreamUpdate && typeof onStreamUpdate === 'function') {
                    // Text: Streaming
                    const result = await model.generateContentStream(prompt);
                    let fullText = '';
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullText += chunkText;
                        onStreamUpdate(fullText);
                    }
                    return fullText.trim();
                } else {
                    // Text: Non-streaming
                    const result = await model.generateContent(prompt);
                    return result.response.text().trim();
                }

            } catch (error) {
                lastError = error;
                // Retry on 503 (Overloaded) or 429
                if (error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('429')) {
                    console.warn(`Attempt ${attempt} failed (Server Overloaded). Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
}
