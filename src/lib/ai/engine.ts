import { groqClient } from './groq-client';
import { geminiClient } from './gemini-client';

export type AIMode = 'FAST' | 'DEEP'; // FAST = Groq, DEEP = Gemini

interface AIRequestOptions {
    mode?: AIMode;
    jsonMode?: boolean;
    fallback?: boolean; // If true, try the other engine on failure
}

export const aiEngine = {
    /**
     * Unified interface for AI generation.
     * Routes to Groq (FAST) or Gemini (DEEP) based on mode.
     */
    async generate(
        prompt: string,
        systemContext: string = "You are an intelligent assistant for an RSA (Roadside Assistance) Platform.",
        options: AIRequestOptions = {}
    ): Promise<string> {
        const { mode = 'FAST', jsonMode = false, fallback = true } = options;

        try {
            if (mode === 'FAST') {
                return await groqClient.generate(prompt, systemContext, jsonMode);
            } else {
                return await geminiClient.generate(prompt, systemContext, jsonMode);
            }
        } catch (error) {
            console.warn(`${mode} Engine failed:`, error);

            if (fallback) {
                console.info('Attempting fallback engine...');
                try {
                    // Swap modes
                    if (mode === 'FAST') {
                        return await geminiClient.generate(prompt, systemContext, jsonMode);
                    } else {
                        return await groqClient.generate(prompt, systemContext, jsonMode);
                    }
                } catch (fallbackError) {
                    console.error('Fallback engine also failed:', fallbackError);
                    throw new Error('All AI engines failed to respond.');
                }
            }
            throw error;
        }
    }
};
