// Configuration for Chinese Language Tool
// Uses Vite environment variables (VITE_ prefix)

export const config = {
    // API Key from environment variable
    GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',

    // Default target language
    DEFAULT_LANGUAGE: 'english'
};
