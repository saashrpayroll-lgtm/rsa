import axios from 'axios';
import { AI_CONFIG } from './config';

export const geminiClient = {
    async generate(prompt: string, systemContext: string, jsonMode = false) {
        const key = AI_CONFIG.gemini.apiKey;
        if (!key) throw new Error('Gemini API Key missing');

        const url = `${AI_CONFIG.gemini.baseUrl}/${AI_CONFIG.gemini.defaultModel}:generateContent?key=${key}`;

        // Gemini REST API structure
        const combinedPrompt = `${systemContext}\n\nUser Query: ${prompt}\n\n${jsonMode ? 'Provide response in valid JSON format.' : ''}`;

        const response = await axios.post(
            url,
            {
                contents: [{
                    parts: [{ text: combinedPrompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    ...(jsonMode ? { response_mime_type: "application/json" } : {})
                }
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        // Parse Response
        const candidate = response.data.candidates?.[0];
        if (!candidate) throw new Error('No response from Gemini');

        return candidate.content.parts[0].text;
    }
};
