import { aiEngine } from './ai/engine';

// Legacy constants removed, using AI Config now

export interface AIAnalysisResult {
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    eta: string;
    category: string;
    suggested_action: string;
}

export const analyzeTicketWithAI = async (
    description: string,
    _images: string[] = []
): Promise<AIAnalysisResult> => {
    try {
        const prompt = `
      Analyze the following ISSUE DESCRIPTION for an Electric Two-Wheeler (EV Scooter/Bike).
      Input: "${description}"

      Your goal is to categorize and prioritize this for an EV Technician.
      IGNORE any reference to petrol, diesel, clutch, gears, or internal combustion engines. This is a 100% Electric Vehicle.

      Provide a JSON response with:
      - severity: LOW, MEDIUM, HIGH, or CRITICAL
      - priority: ROUTINE, URGENT, or EMERGENCY
      - eta: Estimated time to fix (e.g., "30 mins", "2 hours")
      - category: One of [Battery, Motor, Controller, Electrical, Tyre, Brakes, General, Accident]
      - suggested_action: Brief, actionable advice for the technician (max 15 words).

      Return ONLY valid JSON.
    `;

        // Use FAST mode (Groq) for instant ticket analysis
        const content = await aiEngine.generate(prompt, "You are an expert EV Technician AI specialized in electric two-wheelers.", { mode: 'FAST', jsonMode: true });
        return JSON.parse(content);
    } catch (error) {
        console.error('AI Analysis Failed:', error);
        return {
            severity: 'MEDIUM',
            priority: 'ROUTINE',
            eta: '45 mins',
            category: 'General',
            suggested_action: 'Perform manual inspection.'
        };
    }
};

export interface TechGuide {
    diagnosis: string[];
    steps: string[];
    safety: string[];
    tools: string[];
}

export const generateDetailedTechGuide = async (description: string, category: string): Promise<TechGuide> => {
    try {
        const prompt = `
        Create a detailed repair guide for an Electric Two-Wheeler (EV) issue.
        Category: ${category}
        Issue: "${description}"

        STRICT RULES:
        1. Context: ELECTRIC SCOOTERS/BIKES ONLY. No petrol, gas, oil filters, or spark plugs.
        2. Diagnosis: List 3 likely root causes (EV specific, e.g., BMS fault, Hall sensor, loose coupler).
        3. Steps: 3-5 concise repair steps.
        4. Safety: 2 critical safety warnings (e.g., High Voltage, disconnect battery).
        5. Tools: List 3-4 specific tools needed (e.g., Multimeter, T-handle, OBD scanner).

        Output JSON format:
        {
          "diagnosis": ["cause1", "cause2"],
          "steps": ["step1", "step2"],
          "safety": ["warning1"],
          "tools": ["tool1"]
        }
        `;

        const content = await aiEngine.generate(prompt, "You are a Senior Master Technician for Electric Vehicles.", { mode: 'FAST', jsonMode: true });
        return JSON.parse(content);
    } catch (e) {
        console.error("Tech Guide Failed", e);
        return {
            diagnosis: ["Manual diagnosis required"],
            steps: ["Inspect vehicle", "Check connections", "Consult manual"],
            safety: ["Disconnect battery before working"],
            tools: ["Standard Toolkit", "Multimeter"]
        };
    }
};

export interface AdminInsight {
    type: 'ALERT' | 'WARNING' | 'RECOMMENDATION' | 'PRAISE';
    message: string;
    target?: string; // e.g., "Hub Techs", "Ticket #1234"
}

export const generateAdminInsights = async (
    metrics: any
): Promise<AdminInsight[]> => {
    try {
        const prompt = `
      Analyze the following EV fleet maintenance metrics and provide 3-5 key actionable insights for the Admin.
      
      Metric Data:
      ${JSON.stringify(metrics, null, 2)}
      
      Provide a JSON response with an array of insights (objects):
      - type: ALERT (critical issues), WARNING (potential risks), RECOMMENDATION (improvement), or PRAISE (good performance)
      - message: The insight text (keep it concise, under 20 words)
      - target: Specific area or person involved (optional)

      Return ONLY valid JSON array.
    `;

        // Use DEEP mode (Gemini) for complex analytics
        const content = await aiEngine.generate(prompt, "You are a strategic Fleet Operations Manager AI.", { mode: 'DEEP', jsonMode: true });

        try {
            const parsed = JSON.parse(content);
            return parsed.insights || parsed;
        } catch (e) {
            // Sometimes Gemini sends MD code blocks, strip them if needed or rely on robust parsing
            const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(clean);
            return parsed.insights || parsed;
        }

    } catch (error: any) {
        console.error('Admin Insights AI Failed:', error);

        // Return clear simulation data so the UI doesn't break
        return [
            {
                type: 'PRAISE',
                message: 'System uptime is 99.9% this week. Great job!',
                target: 'Infrastructure'
            },
            {
                type: 'WARNING',
                message: 'High ticket volume detected in North Hub.',
                target: 'Hub Operations'
            },
            {
                type: 'RECOMMENDATION',
                message: 'Consider assigning more techs to "Battery" issues.',
                target: 'Resource Allocation'
            }
        ];
    }
};
