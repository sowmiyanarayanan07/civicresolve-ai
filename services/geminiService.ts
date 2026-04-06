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
            equipmentNeeded: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "List of specific equipment, tools, and resources the dispatch team will need (e.g., ['1 Chainsaw crew', '1 Woodchipper', 'Traffic cones for 2 lanes']). Focus on physical resources needed." 
            },
          },
          required: ["category", "priority", "reason", "department", "estimatedTime", "equipmentNeeded"],
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
 * Verify if the complaint has been successfully resolved by comparing 'before' and 'after' images.
 */
export const verifyResolution = async (
  afterImageBase64: string,
  description: string,
  beforeImageBase64?: string
) => {
  try {
    const prompt = `
      You are an AI quality assurance inspector for a city grievance system.
      The worker has submitted an "After" photo claiming the issue is resolved.
      ${beforeImageBase64 ? 'You are also provided the original "Before" photo for comparison.' : ''}
      Issue description: ${description}
      
      Analyze the "After" photo (and compare it to the "Before" photo if provided). 
      Does the "After" photo clearly show the issue described has been fixed/resolved?
      Output strictly in JSON format.
    `;

    const parts: any[] = [{ text: prompt }];

    // Add BEFORE image first, if available
    if (beforeImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: beforeImageBase64.includes(',') ? beforeImageBase64.split(',')[1] : beforeImageBase64,
        },
      });
      parts.push({ text: "The above is the BEFORE photo." });
    }

    // Add AFTER image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: afterImageBase64.includes(',') ? afterImageBase64.split(',')[1] : afterImageBase64,
      },
    });
    parts.push({ text: "The above is the AFTER photo submitted by the worker." });

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isResolved: { type: Type.BOOLEAN, description: "True if the issue appears resolved based on the after photo." },
            reason: { type: Type.STRING, description: "A brief 1-2 sentence explanation of your decision." },
          },
          required: ["isResolved", "reason"],
        },
      }
    });

    return JSON.parse(response.text || '{"isResolved": false, "reason": "Failed to parse AI response."}');
  } catch (error) {
    console.error("AI Verification Error:", error);
    return null;
  }
};

/**
 * Determine if a newly submitted complaint refers to the *exact same* physical incident
 * as any of the nearby candidate complaints. Returns the ID of the master complaint, or null.
 */
export const findDuplicateIncident = async (
  newTitle: string,
  newDescription: string,
  candidates: { id: string; title: string; description: string }[]
): Promise<string | null> => {
  if (!candidates || candidates.length === 0) return null;

  try {
    const prompt = `
      You are an AI duplication-detection engine for a city grievance system.
      A citizen just submitted a new complaint. Below is their report:
      Title: "${newTitle}"
      Description: "${newDescription}"

      There are also several existing complaints reported nearby. Here they are:
      ${candidates.map(c => `ID: ${c.id} | Title: "${c.title}" | Description: "${c.description}"`).join('\n')}

      Analyze the text to determine if the NEW complaint is describing the **exact same physical incident** (e.g., the exact same fallen tree, the exact same burst pipe) as any of the existing candidates.
      - If it IS the exact same incident, output the ID of the matching candidate in the "duplicateOf" field.
      - If it is a DIFFERENT incident (even if it's the same type of problem but likely a different occurrence), output null for "duplicateOf".
      
      Output strictly in JSON format.
    `;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            duplicateOf: { type: Type.STRING, description: "The ID of the candidate complaint that matches, or null if no match.", nullable: true },
            reason: { type: Type.STRING, description: "A brief 1-sentence reason for your decision." },
          },
        },
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result.duplicateOf || null;
  } catch (error) {
    console.error("AI Duplication Error:", error);
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

/**
 * Extract title and description from a voice transcript
 */
export const extractVoiceReport = async (transcript: string) => {
  const prompt = `
    You are an AI assistant processing a voice-transcribed civic complaint from a citizen.
    Extract a concise, professional title and a detailed description from the transcription.
    If the user mentions a location, include it in the description.
    
    Transcript: "${transcript}"
    
    Return ONLY a valid JSON object with keys "title" and "description".
    Example:
    {
      "title": "Massive Pothole on Main Street",
      "description": "There is a massive pothole outside the Starbucks on Main Street."
    }
  `;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text;
    if (!text) {
      return { title: 'Voice Report', description: transcript };
    }
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr) as { title: string, description: string };
  } catch (error) {
    console.error("Voice extraction failed:", error);
    return { title: 'Voice Report', description: transcript }; // fallback
  }
};