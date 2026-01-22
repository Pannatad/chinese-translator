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
                { name: 'gemini-3-flash-preview', timeout: 45000 },
                { name: 'gemini-2.5-flash', timeout: 45000 },
                { name: 'gemini-3-pro-preview', timeout: 45000 },
                { name: 'gemini-1.5-flash', timeout: null } // Reliable fallback
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
  "fullPinyin": "The complete pinyin with tone marks for the entire text",
  "fullTranslation": "The complete ${languageName} translation",
  "wordPairs": [
    {"chinese": "你好", "pinyin": "nǐ hǎo", "translation": "hello"},
    {"chinese": "今天", "pinyin": "jīn tiān", "translation": "today"}
  ]
}

Important rules:
1. Include ALL significant words/phrases from the Chinese text
2. Group multi-character words appropriately
3. Provide accurate pinyin with tone marks for both fullPinyin and wordPairs
4. Return ONLY the JSON object, no explanations`
            }
        ];

        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-3-flash-preview",
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
                    fullPinyin: parsed.fullPinyin || '',
                    fullTranslation: parsed.fullTranslation || '',
                    wordPairs: parsed.wordPairs || []
                };
            } catch {
                // Fallback if JSON parsing fails
                return { originalText: '', fullPinyin: '', fullTranslation: text, wordPairs: [] };
            }

        } catch (error) {
            console.error('[GeminiProvider] Word pairs failed:', error);
            throw error;
        }
    }

    /**
     * Translates text directly (for the translation bot)
     * @param {string} text - Text to translate
     * @param {string} sourceLanguage - Source language code (or 'auto')
     * @param {string} targetLanguage - Target language code
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async translateText(text, sourceLanguage = 'auto', targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured. Please check your settings.');
        }

        const targetLangName = this._getLanguageName(targetLanguage);
        const sourceLangName = sourceLanguage === 'auto' ? 'the source language' : this._getLanguageName(sourceLanguage);

        const prompt = sourceLanguage === 'auto'
            ? `Translate the following text to ${targetLangName}. Auto-detect the source language.\n\nText:\n${text}\n\nProvide ONLY the translation, no explanations.`
            : `Translate the following ${sourceLangName} text to ${targetLangName}.\n\nText:\n${text}\n\nProvide ONLY the translation, no explanations.`;

        console.log(`[GeminiProvider] Translating text: ${text.substring(0, 50)}...`);

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.3 }
            });

            if (onStreamUpdate) {
                // Stream the response
                const result = await model.generateContentStream(prompt);
                let fullText = '';
                for await (const chunk of result.stream) {
                    fullText += chunk.text();
                    onStreamUpdate(fullText);
                }
                return fullText.trim();
            } else {
                // Non-streaming
                const result = await model.generateContent(prompt);
                return result.response.text().trim();
            }

        } catch (error) {
            console.error('[GeminiProvider] Text translation failed:', error);
            throw new Error(`Translation failed: ${error.message}`);
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
                model: 'gemini-3-flash-preview',
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
    // AI ASSISTANT METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Explains Chinese text with meaning, usage, and cultural context
     * @param {string} text - Chinese text to explain
     * @param {string} targetLanguage - Language for the explanation
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async explainText(text, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);
        const prompt = `You are an expert Chinese language teacher. Explain the following Chinese text in ${languageName}.

Text: "${text}"

Provide a comprehensive explanation including:
1. **Literal Meaning**: Word-by-word breakdown
2. **Overall Meaning**: What the text means as a whole
3. **Usage Context**: When and how this phrase is commonly used
4. **Cultural Notes**: Any cultural significance or nuances
5. **Similar Expressions**: Related phrases or alternatives

Be educational but concise. Use examples where helpful.`;

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.5 }
            });

            if (onStreamUpdate) {
                const result = await model.generateContentStream(prompt);
                let fullText = '';
                for await (const chunk of result.stream) {
                    fullText += chunk.text();
                    onStreamUpdate(fullText);
                }
                return fullText.trim();
            } else {
                const result = await model.generateContent(prompt);
                return result.response.text().trim();
            }

        } catch (error) {
            console.error('[GeminiProvider] Explain text failed:', error);
            throw error;
        }
    }

    /**
     * Analyzes the grammar structure of Chinese text
     * @param {string} text - Chinese text to analyze
     * @param {string} targetLanguage - Language for the analysis
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async analyzeGrammar(text, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);
        const prompt = `You are an expert Chinese grammar teacher. Analyze the grammar of the following Chinese text in ${languageName}.

Text: "${text}"

Provide a detailed grammar analysis:
1. **Sentence Structure**: Identify the sentence pattern (SVO, topic-comment, etc.)
2. **Parts of Speech**: Label each word/phrase (noun, verb, adjective, particle, etc.)
3. **Grammar Patterns**: Explain key grammar structures used
4. **Particles & Markers**: Explain any particles (了, 的, 着, etc.) and their functions
5. **Key Points**: Important grammar rules to remember

Format with clear headings. Be educational and precise.`;

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.3 }
            });

            if (onStreamUpdate) {
                const result = await model.generateContentStream(prompt);
                let fullText = '';
                for await (const chunk of result.stream) {
                    fullText += chunk.text();
                    onStreamUpdate(fullText);
                }
                return fullText.trim();
            } else {
                const result = await model.generateContent(prompt);
                return result.response.text().trim();
            }

        } catch (error) {
            console.error('[GeminiProvider] Grammar analysis failed:', error);
            throw error;
        }
    }

    /**
     * Answers general questions about Chinese language
     * @param {string} question - The user's question
     * @param {string} context - Optional context (e.g., current text being studied)
     * @param {string} targetLanguage - Language for the response
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async askQuestion(question, context = '', targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);
        let prompt = `You are a helpful and knowledgeable Chinese language assistant. Answer the following question in ${languageName}.

Question: ${question}`;

        if (context) {
            prompt += `\n\nContext (text the user is studying): "${context}"`;
        }

        prompt += `\n\nProvide a clear, educational answer. Include examples with pinyin and translations when relevant. Be concise but thorough.`;

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.6 }
            });

            if (onStreamUpdate) {
                const result = await model.generateContentStream(prompt);
                let fullText = '';
                for await (const chunk of result.stream) {
                    fullText += chunk.text();
                    onStreamUpdate(fullText);
                }
                return fullText.trim();
            } else {
                const result = await model.generateContent(prompt);
                return result.response.text().trim();
            }

        } catch (error) {
            console.error('[GeminiProvider] Ask question failed:', error);
            throw error;
        }
    }

    /**
     * Answers questions about an image (for the Ask feature)
     * @param {string} question - The user's question about the image
     * @param {string} imageDataUrl - Base64 data URL of the image
     * @param {string} targetLanguage - Language for the response
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async askQuestionWithImage(question, imageDataUrl, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);

        // Extract base64 data from data URL
        const base64Data = imageDataUrl.includes(',')
            ? imageDataUrl.split(',')[1]
            : imageDataUrl;

        const payload = [
            this._buildImagePart(base64Data),
            {
                text: `You are a helpful assistant. Look at this image and answer the following question based on what you see.

Question: ${question}

Provide a clear and helpful answer based on the content visible in the image. Answer in ${languageName}.`
            }
        ];

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.6 }
            });

            if (onStreamUpdate) {
                const result = await model.generateContentStream(payload);
                let fullText = '';
                for await (const chunk of result.stream) {
                    fullText += chunk.text();
                    onStreamUpdate(fullText);
                }
                return fullText.trim();
            } else {
                const result = await model.generateContent(payload);
                return result.response.text().trim();
            }

        } catch (error) {
            console.error('[GeminiProvider] Ask question with image failed:', error);
            throw error;
        }
    }

    /**
     * Generates practice exercises based on a topic
     * @param {string} topic - Topic or word to practice
     * @param {string} difficulty - 'beginner', 'intermediate', or 'advanced'
     * @param {string} targetLanguage - Language for instructions
     */
    async generatePractice(topic, difficulty = 'beginner', targetLanguage = 'english') {
        if (!this.genAI) {
            throw new Error('API key not configured.');
        }

        const languageName = this._getLanguageName(targetLanguage);
        const prompt = `Create a ${difficulty}-level Chinese practice exercise about "${topic}" in ${languageName}.

Generate 3 exercises:
1. **Fill in the blank**: A sentence with one word missing
2. **Translation**: Translate a sentence from ${languageName} to Chinese
3. **Multiple Choice**: Pick the correct meaning or usage

For each exercise, include:
- The question
- The answer (hidden with "Answer: ")
- A brief explanation

Format clearly with numbering. Include pinyin where helpful.`;

        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                generationConfig: { temperature: 0.7 }
            });

            const result = await model.generateContent(prompt);
            return result.response.text().trim();

        } catch (error) {
            console.error('[GeminiProvider] Generate practice failed:', error);
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
        // Handle both string (base64) and object { mimeType, data }
        if (typeof imageData === 'string') {
            return {
                inlineData: {
                    mimeType: "image/png", // Default for string inputs
                    data: imageData
                }
            };
        }

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
