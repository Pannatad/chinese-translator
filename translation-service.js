/**
 * ═══════════════════════════════════════════════════════════════
 * TRANSLATION SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is the main service that your app uses for translations.
 * It now uses the PROVIDER PATTERN - meaning you can easily swap
 * between Gemini API and your own custom model!
 * 
 * HOW IT WORKS:
 * 
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                     Your App (app.js)                   │
 *   │   - Calls translationService.translate()                │
 *   │   - Doesn't need to know which provider is used!        │
 *   └─────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                  TranslationService                     │
 *   │   - Acts as a "wrapper" around the actual provider      │
 *   │   - Handles API key configuration                       │
 *   └─────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                   Provider Factory                       │
 *   │   - Reads config to decide which provider to use        │
 *   │   - Returns either GeminiProvider or CustomModelProvider │
 *   └─────────────────────────────────────────────────────────┘
 *                              │
 *              ┌───────────────┴───────────────┐
 *              ▼                               ▼
 *   ┌───────────────────┐           ┌───────────────────┐
 *   │  GeminiProvider   │           │ CustomModelProvider│
 *   │  (Current)        │           │  (Your Future!)    │
 *   └───────────────────┘           └───────────────────┘
 * 
 * SWITCHING PROVIDERS:
 *   Just change VITE_TRANSLATION_PROVIDER in your .env file!
 *   - 'gemini' → Uses Google's Gemini API (default)
 *   - 'custom' → Uses your own trained model
 */

import { createTranslationProvider, createHybridProvider } from './providers/provider-factory.js';

export class TranslationService {
    constructor() {
        this.provider = null;
        this.providerConfig = {
            provider: 'gemini',        // Default provider
            geminiApiKey: null,
            customModelUrl: null,
            customModelApiKey: null
        };
    }

    /**
     * Configure the Gemini API key (backwards compatible with existing code)
     * @param {string} apiKey - Gemini API key
     */
    setApiKey(apiKey) {
        this.providerConfig.geminiApiKey = apiKey;

        // Read provider type from environment (if using Vite)
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            this.providerConfig.provider = import.meta.env.VITE_TRANSLATION_PROVIDER || 'gemini';
            this.providerConfig.customModelUrl = import.meta.env.VITE_CUSTOM_MODEL_URL || null;
            this.providerConfig.customModelApiKey = import.meta.env.VITE_CUSTOM_MODEL_API_KEY || null;
        }

        // Create the provider
        this._initProvider();
    }

    /**
     * Advanced: Manually configure provider settings
     * @param {object} config - Full provider configuration
     */
    configure(config) {
        this.providerConfig = { ...this.providerConfig, ...config };
        this._initProvider();
    }

    /**
     * Initialize the provider based on current config
     */
    _initProvider() {
        try {
            // Check if hybrid mode is requested
            if (this.providerConfig.provider === 'hybrid') {
                this.provider = createHybridProvider(this.providerConfig);
            } else {
                this.provider = createTranslationProvider(this.providerConfig);
            }
            console.log(`[TranslationService] Using: ${this.provider.getName()}`);
        } catch (error) {
            console.error('[TranslationService] Failed to create provider:', error);
            this.provider = null;
        }
    }

    /**
     * Get the current provider name
     * @returns {string} Provider name
     */
    getProviderName() {
        return this.provider?.getName() || 'None';
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API (Same interface as before - no changes needed in app.js!)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Translates text or image with optional streaming support
     * @param {string|object} input - Text string OR Image Data { mimeType, data }
     * @param {string} targetLanguage - Target language
     * @param {function} onStreamUpdate - Optional callback for streaming
     * @returns {Promise<string>} - Final translated text
     */
    async translate(input, targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.provider) {
            throw new Error('Translation provider not configured. Please check your settings.');
        }
        return this.provider.translate(input, targetLanguage, onStreamUpdate);
    }

    /**
     * Translates image with word-by-word mapping for highlighting feature
     * @param {object} imageData - Image Data { mimeType, data }
     * @param {string} targetLanguage - Target language
     * @returns {Promise<object>} - { fullTranslation, wordPairs }
     */
    async translateWithWordPairs(imageData, targetLanguage = 'english') {
        if (!this.provider) {
            throw new Error('Translation provider not configured.');
        }
        return this.provider.translateWithWordPairs(imageData, targetLanguage);
    }

    /**
     * Generate example sentences using a Chinese word
     * @param {string} chineseWord - Chinese word/phrase
     * @param {string} pinyin - Pinyin pronunciation
     * @param {string} targetLanguage - Target language
     * @returns {Promise<Array>} - Array of example sentence objects
     */
    async generateExampleSentences(chineseWord, pinyin = '', targetLanguage = 'english') {
        if (!this.provider) {
            throw new Error('Translation provider not configured.');
        }
        return this.provider.generateExampleSentences(chineseWord, pinyin, targetLanguage);
    }

    /**
     * Translates text directly (for the translation bot)
     * @param {string} text - Text to translate
     * @param {string} sourceLanguage - Source language code (or 'auto')
     * @param {string} targetLanguage - Target language code
     * @param {function} onStreamUpdate - Optional streaming callback
     * @returns {Promise<string>} - Translated text
     */
    async translateText(text, sourceLanguage = 'auto', targetLanguage = 'english', onStreamUpdate = null) {
        if (!this.provider) {
            throw new Error('Translation provider not configured. Please check your settings.');
        }
        return this.provider.translateText(text, sourceLanguage, targetLanguage, onStreamUpdate);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * QUICK REFERENCE: How to Switch to Your Custom Model
 * ═══════════════════════════════════════════════════════════════
 * 
 * STEP 1: Train your model (using PyTorch, Hugging Face, etc.)
 * 
 * STEP 2: Host it as an API (FastAPI example):
 *   
 *   from fastapi import FastAPI
 *   app = FastAPI()
 *   
 *   @app.post("/translate")
 *   def translate(data: dict):
 *       result = your_model.translate(data["input"], data["targetLanguage"])
 *       return {"translation": result}
 * 
 * STEP 3: Update your .env file:
 *   
 *   VITE_TRANSLATION_PROVIDER=custom
 *   VITE_CUSTOM_MODEL_URL=http://localhost:8000
 * 
 * STEP 4: Restart your app - it now uses YOUR model!
 * 
 * OPTIONAL: Use hybrid mode for testing:
 *   VITE_TRANSLATION_PROVIDER=hybrid
 *   (Uses your model first, falls back to Gemini if it fails)
 */
