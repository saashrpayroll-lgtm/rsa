export const AI_CONFIG = {
    groq: {
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        defaultModel: 'llama-3.1-70b-versatile',
        fastModel: 'llama-3.1-8b-instant'
    },
    gemini: {
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        defaultModel: 'gemini-2.0-flash'
    }
};
