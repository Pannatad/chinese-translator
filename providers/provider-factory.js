/**
 * ═══════════════════════════════════════════════════════════════
 * PROVIDER FACTORY
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is the "switch" that determines which provider to use.
 * It reads your configuration and creates the appropriate provider.
 * 
 * HOW IT WORKS:
 * - Reads VITE_TRANSLATION_PROVIDER from .env
 * - If 'gemini' → uses GeminiProvider (current behavior)
 * - If 'custom' → uses CustomModelProvider (your future model!)
 * 
 * The rest of your app doesn't need to know which provider is used.
 * It just calls translationService.translate() and it works!
 */

import { GeminiProvider } from './gemini-provider.js';
import { CustomModelProvider } from './custom-model-provider.js';

/**
 * Creates the appropriate translation provider based on config
 * 
 * @param {object} config - Configuration object with:
 *   - provider: 'gemini' | 'custom'
 *   - geminiApiKey: API key for Gemini
 *   - customModelUrl: URL for your custom model API
 *   - customModelApiKey: Optional API key for your model
 * 
 * @returns {BaseProvider} The configured provider instance
 */
export function createTranslationProvider(config) {
    const providerType = config.provider || 'gemini';

    console.log(`[ProviderFactory] Creating provider: ${providerType}`);

    switch (providerType.toLowerCase()) {
        case 'gemini':
            return new GeminiProvider(config.geminiApiKey);

        case 'custom':
            if (!config.customModelUrl) {
                throw new Error('customModelUrl is required for custom provider');
            }
            return new CustomModelProvider(
                config.customModelUrl,
                config.customModelApiKey
            );

        default:
            console.warn(`Unknown provider: ${providerType}, falling back to Gemini`);
            return new GeminiProvider(config.geminiApiKey);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * HYBRID PROVIDER FACTORY (Optional Advanced Usage)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Creates a provider that tries custom model first, then falls back to Gemini.
 * Useful for testing your model while keeping Gemini as backup.
 */
export function createHybridProvider(config) {
    const customProvider = new CustomModelProvider(
        config.customModelUrl,
        config.customModelApiKey
    );
    const geminiProvider = new GeminiProvider(config.geminiApiKey);

    // Return a proxy that tries custom first, falls back to Gemini
    return {
        getName: () => 'Hybrid (Custom + Gemini)',

        async translate(input, targetLanguage, onStreamUpdate) {
            try {
                console.log('[HybridProvider] Trying custom model...');
                return await customProvider.translate(input, targetLanguage, onStreamUpdate);
            } catch (error) {
                console.warn('[HybridProvider] Custom failed, using Gemini:', error.message);
                return await geminiProvider.translate(input, targetLanguage, onStreamUpdate);
            }
        },

        async translateWithWordPairs(imageData, targetLanguage) {
            try {
                return await customProvider.translateWithWordPairs(imageData, targetLanguage);
            } catch {
                return await geminiProvider.translateWithWordPairs(imageData, targetLanguage);
            }
        },

        async generateExampleSentences(word, pinyin, targetLanguage) {
            try {
                return await customProvider.generateExampleSentences(word, pinyin, targetLanguage);
            } catch {
                return await geminiProvider.generateExampleSentences(word, pinyin, targetLanguage);
            }
        }
    };
}
