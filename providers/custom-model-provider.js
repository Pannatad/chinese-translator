/**
 * ═══════════════════════════════════════════════════════════════
 * CUSTOM MODEL PROVIDER (Template for YOUR model!)
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is a TEMPLATE for when you train your own translation model.
 * It shows exactly what you need to implement.
 * 
 * WHEN YOU'RE READY TO USE YOUR OWN MODEL:
 * 1. Host your model as an API (using FastAPI, Flask, etc.)
 * 2. Fill in the translate() and other methods below
 * 3. Update provider-factory.js to use this provider
 * 
 * EXAMPLE API SETUP (Python/FastAPI):
 * 
 *   from fastapi import FastAPI
 *   from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
 *   
 *   app = FastAPI()
 *   model = AutoModelForSeq2SeqLM.from_pretrained("./my-trained-model")
 *   tokenizer = AutoTokenizer.from_pretrained("./my-trained-model")
 *   
 *   @app.post("/translate")
 *   async def translate(text: str, target_lang: str):
 *       inputs = tokenizer(text, return_tensors="pt")
 *       outputs = model.generate(**inputs)
 *       return {"translation": tokenizer.decode(outputs[0])}
 */

import { BaseProvider } from "./base-provider.js";

export class CustomModelProvider extends BaseProvider {
    /**
     * @param {string} apiUrl - Your model's API endpoint
     * @param {string} apiKey - Optional API key for authentication
     */
    constructor(apiUrl, apiKey = null) {
        super();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        console.log(`[CustomModelProvider] Initialized with URL: ${apiUrl}`);
    }

    getName() {
        return 'CustomModel';
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * TRANSLATE - Main translation method
     * ═══════════════════════════════════════════════════════════
     * 
     * This calls YOUR API endpoint to perform translation.
     * Modify the fetch() call to match your API's expected format.
     */
    async translate(input, targetLanguage = 'english', onStreamUpdate = null) {
        // Handle both text and image inputs
        const isImage = typeof input === 'object' && input.data;

        const requestBody = {
            // For text: send the string directly
            // For image: send base64 data (your model will need OCR capability)
            input: isImage ? input.data : input,
            inputType: isImage ? 'image' : 'text',
            targetLanguage: targetLanguage
        };

        try {
            console.log(`[CustomModelProvider] Translating to ${targetLanguage}...`);

            const response = await fetch(`${this.apiUrl}/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include API key if provided
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Expect your API to return: { translation: "translated text" }
            return data.translation || data.result || data.text;

        } catch (error) {
            console.error('[CustomModelProvider] Translation failed:', error);
            throw new Error(`Custom model translation failed: ${error.message}`);
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * TRANSLATE WITH WORD PAIRS - For the highlighting feature
     * ═══════════════════════════════════════════════════════════
     * 
     * Your model needs to return word-level alignments for this.
     * If your model doesn't support this, return a simple fallback.
     */
    async translateWithWordPairs(imageData, targetLanguage = 'english') {
        try {
            const response = await fetch(`${this.apiUrl}/translate-with-pairs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    image: imageData.data,
                    targetLanguage: targetLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Expected format from your API:
            // {
            //   originalText: "中文",
            //   fullTranslation: "Chinese",
            //   wordPairs: [{ chinese, pinyin, translation }]
            // }
            return {
                originalText: data.originalText || '',
                fullTranslation: data.fullTranslation || '',
                wordPairs: data.wordPairs || []
            };

        } catch (error) {
            console.error('[CustomModelProvider] Word pairs failed:', error);

            // Fallback: Just do a simple translation without word pairs
            const fallbackTranslation = await this.translate(imageData, targetLanguage);
            return {
                originalText: '',
                fullTranslation: fallbackTranslation,
                wordPairs: []
            };
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * GENERATE EXAMPLE SENTENCES
     * ═══════════════════════════════════════════════════════════
     * 
     * Generate example sentences using a word.
     * Your model would need sentence generation capability.
     */
    async generateExampleSentences(chineseWord, pinyin = '', targetLanguage = 'english') {
        try {
            const response = await fetch(`${this.apiUrl}/generate-examples`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    word: chineseWord,
                    pinyin: pinyin,
                    targetLanguage: targetLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Expected: [{ chinese, pinyin, translation }, ...]
            return data.sentences || data.examples || [];

        } catch (error) {
            console.error('[CustomModelProvider] Example generation failed:', error);
            // Return empty array as fallback
            return [];
        }
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * QUICK START GUIDE
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. TRAIN YOUR MODEL
 *    - Use a transformer architecture (e.g., mBART, NLLB, M2M-100)
 *    - Fine-tune on Chinese-English/Thai parallel corpus
 *    - Export as ONNX or keep in PyTorch format
 * 
 * 2. CREATE YOUR API (example with FastAPI)
 * 
 *    # api.py
 *    from fastapi import FastAPI
 *    from fastapi.middleware.cors import CORSMiddleware
 *    from transformers import pipeline
 *    
 *    app = FastAPI()
 *    app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
 *    
 *    translator = pipeline("translation", model="./my-model")
 *    
 *    @app.post("/translate")
 *    async def translate(request: dict):
 *        result = translator(request["input"], tgt_lang=request["targetLanguage"])
 *        return {"translation": result[0]["translation_text"]}
 *    
 *    # Run: uvicorn api:app --host 0.0.0.0 --port 8000
 * 
 * 3. UPDATE CONFIG
 *    In your .env file, add:
 *    VITE_TRANSLATION_PROVIDER=custom
 *    VITE_CUSTOM_MODEL_URL=http://localhost:8000
 * 
 * 4. That's it! Your app will now use YOUR model!
 */
