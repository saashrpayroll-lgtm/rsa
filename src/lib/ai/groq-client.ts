import axios from 'axios';
import { AI_CONFIG } from './config';

export const groqClient = {
    async generate(prompt: string, systemContext: string, jsonMode = false) {
        if (!AI_CONFIG.groq.apiKey) throw new Error('Groq API Key missing');

        const response = await axios.post(
            AI_CONFIG.groq.baseUrl,
            {
                model: AI_CONFIG.groq.defaultModel,
                messages: [
                    { role: "system", content: systemContext },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2, // Low temp for operational precision
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            },
            {
                headers: {
                    'Authorization': `Bearer ${AI_CONFIG.groq.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    }
};
