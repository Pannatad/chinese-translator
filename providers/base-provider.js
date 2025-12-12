/**
 * ═══════════════════════════════════════════════════════════════
 * BASE TRANSLATION PROVIDER (Abstract Class)
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is the "contract" that ALL translation providers must follow.
 * Whether you use Gemini API or your own custom model, the interface
 * stays the same - making it easy to swap providers!
 * 
 * Think of it like a USB port - any USB device works because they
 * all follow the same interface. Same idea here!
 * 
 * HOW TO ADD YOUR OWN MODEL:
 * 1. Create a new file (e.g., my-model-provider.js)
 * 2. Extend this BaseProvider class
 * 3. Implement the 3 required methods
 * 4. Update provider-factory.js to include your new provider
 */

export class BaseProvider {
    constructor() {
        // Prevent direct instantiation of this abstract class
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract - create a specific provider like GeminiProvider');
        }
    }

    /**
     * Get the name of this provider (for logging/debugging)
     * @returns {string} Provider name
     */
    getName() {
        throw new Error('Subclass must implement getName()');
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * METHOD 1: Simple Translation
     * ═══════════════════════════════════════════════════════════
     * Translates text or image to target language.
     * 
     * @param {string|object} input - Either:
     *   - A string of text to translate
     *   - An image object: { mimeType: 'image/jpeg', data: 'base64...' }
     * 
     * @param {string} targetLanguage - Target language ('english', 'thai', etc.)
     * @param {function|null} onStreamUpdate - Optional callback for streaming
     *   - Called with (partialText) as translation streams in
     *   - Set to null if your model doesn't support streaming
     * 
     * @returns {Promise<string>} The translated text
     */
    async translate(input, targetLanguage = 'english', onStreamUpdate = null) {
        throw new Error('Subclass must implement translate()');
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * METHOD 2: Translation with Word Pairs (for highlighting)
     * ═══════════════════════════════════════════════════════════
     * Returns translation + word-by-word mapping for learning features.
     * 
     * @param {object} imageData - Image object { mimeType, data }
     * @param {string} targetLanguage - Target language
     * 
     * @returns {Promise<object>} Object with structure:
     *   {
     *     originalText: "中文原文",
     *     fullTranslation: "Full English translation",
     *     wordPairs: [
     *       { chinese: "你好", pinyin: "nǐ hǎo", translation: "hello" },
     *       { chinese: "世界", pinyin: "shì jiè", translation: "world" }
     *     ]
     *   }
     */
    async translateWithWordPairs(imageData, targetLanguage = 'english') {
        throw new Error('Subclass must implement translateWithWordPairs()');
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * METHOD 3: Generate Example Sentences
     * ═══════════════════════════════════════════════════════════
     * Creates example sentences using a Chinese word (for learning).
     * 
     * @param {string} chineseWord - The Chinese word to use
     * @param {string} pinyin - Optional pinyin pronunciation
     * @param {string} targetLanguage - Target language for translations
     * 
     * @returns {Promise<Array>} Array of sentence objects:
     *   [
     *     { chinese: "今天很好", pinyin: "jīn tiān hěn hǎo", translation: "Today is good" },
     *     { chinese: "今天我很忙", pinyin: "jīn tiān wǒ hěn máng", translation: "I'm busy today" }
     *   ]
     */
    async generateExampleSentences(chineseWord, pinyin = '', targetLanguage = 'english') {
        throw new Error('Subclass must implement generateExampleSentences()');
    }
}
