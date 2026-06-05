import { NextResponse } from 'next/server';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { text, audioData, mimeType, title, customKey } = await request.json();

    if (!text && !audioData) {
      return NextResponse.json({ error: 'Text content or audio file is required.' }, { status: 400 });
    }

    const ai = getGeminiClient(customKey);

    let promptContents: any[] = [];
    let systemInstruction = `
You are an advanced academic assistant specializing in lecture notes transcription, summarization, flashcard generation, and multiple choice quiz creation.
Analyze the provided lecture data (which could be text notes or an audio recording) and return a structured JSON response.

Return a JSON object with the following fields:
1. "transcript": If the input is audio, provide a clean, complete transcription of the lecture. If the input is already text, leave this field null.
2. "summary": A comprehensive, beautifully formatted Markdown summary of the lecture. Structure it with clear headers, bullet points, and highlight important terms. Include:
   - **Main Topic Overview**
   - **Key Concepts Explained**
   - **Important Definitions & Formulae (if applicable)**
   - **Action Items & Exam Tips**
3. "flashcards": A JSON array of 5-10 key concept flashcards. Each card must have:
   - "front": A study question or term (e.g., "What is the Time Complexity of Merge Sort?").
   - "back": The clear, concise answer (e.g., "O(n log n) in all cases, because...").
4. "quiz": A JSON array of 3-5 multiple choice questions. Each question must contain:
   - "question": The question text.
   - "options": An array of 4 choices (strings).
   - "answerIndex": Integer index (0-3) of the correct choice in the options array.
   - "explanation": Brief explanation (string) detailing why that specific option is correct.

Return ONLY this JSON object. Do not wrap it in markdown code blocks. Keep the response syntax-valid.
`;

    if (audioData) {
      // Multimodal request with audio
      promptContents = [
        {
          inlineData: {
            data: audioData, // Base64 encoded audio
            mimeType: mimeType || 'audio/webm'
          }
        },
        {
          text: `Lecture Title: ${title || 'Recorded Lecture'}\n\nPlease transcribe and summarize this lecture audio.`
        }
      ];
    } else {
      // Text summarization request
      promptContents = [
        {
          text: `Lecture Title: ${title || 'Notes'}\n\nNotes Content:\n${text}`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptContents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('No content returned from Gemini.');
    }

    const result = JSON.parse(responseText.trim());
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in lecture summarizer API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing the lecture notes.' },
      { status: 500 }
    );
  }
}
