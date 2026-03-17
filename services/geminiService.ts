import { GoogleGenAI, Type, Modality } from "@google/genai";

// Lazy singleton — only created when first used, avoids crash on missing key
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY)
      || import.meta.env?.VITE_GEMINI_API_KEY
      || '';
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

/**
 * Analyze a complaint using Gemini (Vision + Thinking)
 */
export const analyzeComplaint = async (
  title: string,
  description: string,
  base64Image?: string,
  locationText?: string
) => {
  try {
    const prompt = `
      You are an AI complaint classification engine for a civic grievance system.
      Input:
      Title: ${title}
      Description: ${description}
      Location: ${locationText || 'Unknown'}
      
      Analyze the input (and image if provided) to infer urgency, safety risks, and severity.
      Output strictly in JSON format.
    `;

    const parts: any[] = [{ text: prompt }];

    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      });
    }

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "e.g., Road, Water, Garbage, Electricity" },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High", "Emergency"] },
            reason: { type: Type.STRING },
            department: { type: Type.STRING, enum: ["light", "pothole", "drainage", "water_supply"] },
            estimatedTime: { type: Type.STRING, description: "e.g., 24 hours" },
          },
          required: ["category", "priority", "reason", "department", "estimatedTime"],
        },
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};

/**
 * Text-to-Speech using Gemini TTS
 */
export const speakText = async (text: string, language: 'en' | 'ta') => {
  try {
    const voiceName = 'Puck';

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};

/**
 * Civic Chatbot — plain Gemini Flash chat with location context
 */
export const chatWithMaps = async (userMessage: string, location?: { lat: number, lng: number }) => {
  try {
    const locationContext = location
      ? `The user is located at coordinates: latitude ${location.lat.toFixed(5)}, longitude ${location.lng.toFixed(5)}.`
      : 'The user location is not available.';

    const systemPrompt = `You are a helpful civic assistant for the CivicResolve AI platform.
${locationContext}
You help citizens with information about:
- City services (water supply, electricity, roads, garbage collection, drainage)
- How to file and track civic complaints
- Expected resolution timelines for different complaint types
- Government departments responsible for various civic issues
- General civic information relevant to their area

Be concise, friendly, and practical. If asked about specific locations or offices, provide helpful general guidance.`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser question: ' + userMessage }] }
      ],
    });

    return {
      text: response.text,
      grounding: null,
    };
  } catch (error: any) {
    console.error("Chat Error:", error);
    return { text: `Sorry, I couldn't process that request. (${error.message || 'Error'})`, grounding: null };
  }
};