import { GoogleGenAI } from '@google/genai';

/**
 * Gets a Gemini AI client instance.
 * If a custom key is provided (e.g., entered by the user in settings), it uses that key.
 * Otherwise, it falls back to the server-side environment variable.
 */
export function getGeminiClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('Gemini API Key is not configured. Please set GEMINI_API_KEY in your env or supply a user key in Settings.');
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Generates content using the Gemini client with automatic retries for rate limits (429) or spikes (503).
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  options: {
    model: string;
    contents: any;
    config?: any;
  },
  maxRetries = 3,
  delayMs = 1500
): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent(options);
      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`Gemini API attempt ${attempt} failed: ${error.message || error}`);

      // Check if the error is retryable (429 Rate Limit, 503 Service Unavailable, or transient errors)
      const errorMsg = String(error.message || '').toLowerCase();
      const status = error.status || error.statusCode || (error.error && error.error.code);
      
      const isRetryable = 
        status === 429 || 
        status === 503 || 
        errorMsg.includes('429') || 
        errorMsg.includes('503') ||
        errorMsg.includes('high demand') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('temporarily unavailable') ||
        errorMsg.includes('unavailable');

      if (isRetryable && attempt < maxRetries) {
        // Wait with exponential backoff (e.g., 1.5s, 3s, 4.5s)
        const waitTime = delayMs * attempt;
        console.warn(`Retrying Gemini API in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * Normalizes model names for safety.
 * We default to gemini-2.5-flash for speed/multimodal capabilities.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-2.5-pro';

