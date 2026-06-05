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
 * Normalizes model names for safety.
 * We default to gemini-2.5-flash for speed/multimodal capabilities.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_MODEL_PRO = 'gemini-2.5-pro';
