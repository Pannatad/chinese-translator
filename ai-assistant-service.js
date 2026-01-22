/**
 * ═══════════════════════════════════════════════════════════════
 * AI ASSISTANT SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * High-level AI assistant service that wraps the translation provider
 * to provide conversational AI features for language learning.
 * 
 * Features:
 *   - Text explanation with cultural context
 *   - Grammar analysis and breakdown
 *   - Q&A about Chinese language
 *   - Practice exercise generation
 *   - Conversation history management
 */

import { TranslationService } from './translation-service.js';

export class AIAssistantService {
    constructor() {
        this.translationService = new TranslationService();
        this.conversationHistory = [];
        this.currentContext = ''; // Current text being studied
        this.maxHistoryLength = 10;
    }

    /**
     * Initialize with API key
     */
    setApiKey(apiKey) {
        this.translationService.setApiKey(apiKey);
    }

    /**
     * Set context text (e.g., from translation)
     */
    setContext(text) {
        this.currentContext = text;
    }

    /**
     * Clear context
     */
    clearContext() {
        this.currentContext = '';
    }

    /**
     * Get the provider directly for AI features
     */
    _getProvider() {
        return this.translationService.provider;
    }

    /**
     * Explain Chinese text with meaning, usage, and cultural context
     * @param {string} text - Chinese text to explain
     * @param {string} targetLanguage - Language for the explanation
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async explainText(text, targetLanguage = 'english', onStreamUpdate = null) {
        const provider = this._getProvider();
        if (!provider) {
            throw new Error('Translation service not initialized.');
        }

        this._addToHistory('user', `Explain: ${text}`);

        const result = await provider.explainText(text, targetLanguage, onStreamUpdate);

        this._addToHistory('assistant', result);
        return result;
    }

    /**
     * Analyze the grammar of Chinese text
     * @param {string} text - Chinese text to analyze
     * @param {string} targetLanguage - Language for the analysis
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async analyzeGrammar(text, targetLanguage = 'english', onStreamUpdate = null) {
        const provider = this._getProvider();
        if (!provider) {
            throw new Error('Translation service not initialized.');
        }

        this._addToHistory('user', `Grammar analysis: ${text}`);

        const result = await provider.analyzeGrammar(text, targetLanguage, onStreamUpdate);

        this._addToHistory('assistant', result);
        return result;
    }

    /**
     * Ask a question about Chinese language
     * @param {string} question - The user's question
     * @param {string} targetLanguage - Language for the response
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async askQuestion(question, targetLanguage = 'english', onStreamUpdate = null) {
        const provider = this._getProvider();
        if (!provider) {
            throw new Error('Translation service not initialized.');
        }

        this._addToHistory('user', question);

        const result = await provider.askQuestion(
            question,
            this.currentContext,
            targetLanguage,
            onStreamUpdate
        );

        this._addToHistory('assistant', result);
        return result;
    }

    /**
     * Ask a question about an image
     * @param {string} question - The user's question
     * @param {string} imageDataUrl - Base64 data URL of the captured image
     * @param {string} targetLanguage - Language for the response
     * @param {function} onStreamUpdate - Optional streaming callback
     */
    async askQuestionWithImage(question, imageDataUrl, targetLanguage = 'english', onStreamUpdate = null) {
        const provider = this._getProvider();
        if (!provider) {
            throw new Error('Translation service not initialized.');
        }

        this._addToHistory('user', `[Image] ${question}`);

        const result = await provider.askQuestionWithImage(
            question,
            imageDataUrl,
            targetLanguage,
            onStreamUpdate
        );

        this._addToHistory('assistant', result);
        return result;
    }

    /**
     * Generate practice exercises
     * @param {string} topic - Topic or word to practice
     * @param {string} difficulty - 'beginner', 'intermediate', or 'advanced'
     * @param {string} targetLanguage - Language for instructions
     */
    async generatePractice(topic, difficulty = 'beginner', targetLanguage = 'english') {
        const provider = this._getProvider();
        if (!provider) {
            throw new Error('Translation service not initialized.');
        }

        this._addToHistory('user', `Practice: ${topic} (${difficulty})`);

        const result = await provider.generatePractice(topic, difficulty, targetLanguage);

        this._addToHistory('assistant', result);
        return result;
    }

    /**
     * Add a message to conversation history
     */
    _addToHistory(role, content) {
        this.conversationHistory.push({
            role,
            content,
            timestamp: Date.now()
        });

        // Keep history bounded
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get recent context for building prompts
     */
    getRecentContext(maxMessages = 4) {
        return this.conversationHistory.slice(-maxMessages);
    }
}
