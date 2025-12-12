/**
 * ═══════════════════════════════════════════════════════════════
 * GEMINI PROVIDER
 * ═══════════════════════════════════════════════════════════════
 * 
 * This implements the BaseProvider interface using Google's Gemini API.
 * Most of the code here is moved from your original translation-service.js
 * 
 * The key insight: All the Gemini-specific logic is now isolated here,
 * making it easy to swap for a different provider later!
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./base-provider.js";

export class GeminiProvider extends BaseProvider {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
        console.log(`[GeminiProvider] Initialized${apiKey ? ` (Key length: ${apiKey.length})` : ' (No key)'}`);
    }

    getName() {
        return 'Gemini';
    }

    /**
     * Translates text or image using Gemini's vision/text models
     */
    async translate(input, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured. Please check your settings.');
        }

        const languageName = this._getLanguageName(targetLanguage);
        const payload = this._buildTranslationPayload(input, languageName);

        console.time('[GeminiProvider] Translation');

        try {
            // Strategy: Speed-First with Fallbacks
            // 1. gemini-2.5-flash (Fast)
            // 2. gemini-3-pro-preview (Powerful)
            // 3. gemini-1.5-flash (Reliable fallback)

            const result = await this._tryModelsInOrder(payload, onStreamUpdate, [
                { name: 'gemini-2.5-flash', timeout: 45000 },
                { name: 'gemini-3-pro-preview', timeout: 60000 },
                { name: 'gemini-1.5-flash', timeout: null } // No timeout for last resort
            ]);

            console.timeEnd('[GeminiProvider] Translation');
            return result;

        } catch (error) {
            console.error('[GeminiProvider] All translation attempts failed:', error);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    /**
     * Translates image with word-by-word mapping for the highlight feature
     */
    async translateWithWordPairs(imageData, targetLanguage = 'english') {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);

        const payload = [
            this._buildImagePart(imageData),
            {
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
2. Group multi-character words appropriately
3. Provide accurate pinyin with tone marks
4. Return ONLY the JSON object, no explanations`
            }
        ];

        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            const result = await model.generateContent(payload);
            const text = result.response.text();

            try {
                const parsed = JSON.parse(text);
                return {
                    originalText: parsed.originalText || '',
                    fullTranslation: parsed.fullTranslation || '',
                    wordPairs: parsed.wordPairs || []
                };
            } catch {
                // Fallback if JSON parsing fails
                return { originalText: '', fullTranslation: text, wordPairs: [] };
            }

        } catch (error) {
            console.error('[GeminiProvider] Word pairs failed:', error);
            throw error;
        }
    }

    /**
     * Generates example sentences using a Chinese word
     */
    async generateExampleSentences(chineseWord, pinyin = '', targetLanguage = 'english') {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);

        const prompt = `Generate 2 simple example sentences using the Chinese word "${chineseWord}"${pinyin ? ` (${pinyin})` : ''}.

Format as JSON array:
[
  {"chinese": "例句1", "pinyin": "lì jù yī", "translation": "Translation 1"},
  {"chinese": "例句2", "pinyin": "lì jù èr", "translation": "Translation 2"}
]

ONLY output the JSON array.`;

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { temperature: 0.7 }
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            const jsonMatch = text.match(/\[[\s\S]*\]/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        } catch (error) {
            console.error('[GeminiProvider] Example sentences failed:', error);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE HELPER METHODS
    // ═══════════════════════════════════════════════════════════════

    _getLanguageName(code) {
        const languages = {
            'english': 'English',
            'thai': 'Thai (ภาษาไทย)',
            'japanese': 'Japanese',
            'korean': 'Korean',
            'spanish': 'Spanish',
            'french': 'French',
            'german': 'German',
            'vietnamese': 'Vietnamese'
        };
        return languages[code] || 'English';
    }

    _buildImagePart(imageData) {
        return {
            inlineData: {
                mimeType: imageData.mimeType || "image/jpeg",
                data: imageData.data
            }
        };
    }

    _buildTranslationPayload(input, languageName) {
        if (typeof input === 'string') {
            // Text-only translation
            return `Translate this text to ${languageName}:\n${input}`;
        } else if (input?.data) {
            // Vision translation (image)
            return [
                this._buildImagePart(input),
                {
                    text: `Transcribe and translate the text in this image to ${languageName}. 
IMPORTANT: Preserve the original layout structure.
Output ONLY the translation.`
                }
            ];
        }
        throw new Error('Invalid input format');
    }

    async _tryModelsInOrder(payload, onStreamUpdate, models) {
        let lastError;

        for (const { name, timeout } of models) {
            try {
                console.log(`[GeminiProvider] Trying: ${name}`);

                const model = this.genAI.getGenerativeModel({
                    model: name,
                    generationConfig: { temperature: 0.1 }
                });

                if (timeout) {
                    return await this._generateWithTimeout(model, payload, onStreamUpdate, timeout);
                } else {
                    return await this._generateWithRetry(model, payload, onStreamUpdate);
                }

            } catch (error) {
                console.warn(`[GeminiProvider] ${name} failed:`, error.message);
                lastError = error;
            }
        }

        throw lastError;
    }

    async _generateWithTimeout(model, payload, onStreamUpdate, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        return Promise.race([
            this._generateWithRetry(model, payload, onStreamUpdate),
            timeoutPromise
        ]);
    }

    async _generateWithRetry(model, payload, onStreamUpdate, maxRetries = 3) {
        let lastError;
        const isVision = Array.isArray(payload);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (isVision) {
                    // Vision: Non-streaming
                    const result = await model.generateContent(payload);
                    return result.response.text();
                } else if (onStreamUpdate) {
                    // Text: Streaming
                    const result = await model.generateContentStream(payload);
                    let fullText = '';
                    for await (const chunk of result.stream) {
                        fullText += chunk.text();
                        onStreamUpdate(fullText);
                    }
                    return fullText.trim();
                } else {
                    // Text: Non-streaming
                    const result = await model.generateContent(payload);
                    return result.response.text().trim();
                }

            } catch (error) {
                lastError = error;
                if (error.message.includes('503') || error.message.includes('429')) {
                    console.warn(`[GeminiProvider] Attempt ${attempt} failed (overloaded). Retrying...`);
                    await new Promise(r => setTimeout(r, attempt * 1000));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
}
