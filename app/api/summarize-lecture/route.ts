import { NextResponse } from 'next/server';
import { getGeminiClient, GEMINI_MODEL, generateContentWithRetry } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { text, audioData, mimeType, title, customKey } = await request.json();

    if (!text && !audioData) {
      return NextResponse.json({ error: 'Text content or audio file is required.' }, { status: 400 });
    }

    const ai = getGeminiClient(customKey);

    let promptContents: any[] = [];
    const systemInstruction = `
You are an advanced academic assistant specializing in lecture notes transcription, summarization, flashcard generation, and multiple choice quiz creation.
Analyze the provided lecture data (which could be text notes, an audio recording, or a PDF document) and return a structured JSON response.

Return a JSON object with the following fields:
1. "transcript": If the input is audio, provide a clean, complete transcription of the lecture. If the input is already text or a PDF document, leave this field null.
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
   - "options": An array of exactly 4 choices (strings).
   - "answerIndex": Integer index (0-3) of the correct choice in the options array.
   - "explanation": Brief explanation (string) detailing why that specific option is correct.
`;

    if (audioData) {
      // Multimodal request (Audio or PDF)
      const isPdf = mimeType === 'application/pdf';
      const promptText = isPdf
        ? `Lecture Title: ${title || 'Lecture PDF'}\n\nPlease analyze, summarize, and generate study materials (flashcards and a multiple choice quiz) from this lecture PDF document.`
        : `Lecture Title: ${title || 'Recorded Lecture'}\n\nPlease transcribe, summarize, and generate study materials (flashcards and a multiple choice quiz) from this lecture audio recording.`;

      promptContents = [
        {
          inlineData: {
            data: audioData, // Base64 encoded audio or PDF
            mimeType: mimeType || 'audio/webm'
          }
        },
        {
          text: promptText
        }
      ];
    } else {
      // Text summarization request
      promptContents = [
        {
          text: `Lecture Title: ${title || 'Notes'}\n\nNotes Content:\n${text}\n\nPlease analyze, summarize, and generate study materials (flashcards and a multiple choice quiz) from these notes.`
        }
      ];
    }

    const response = await generateContentWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: promptContents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            transcript: { 
              type: 'STRING', 
              description: 'Transcription of the audio lecture if audio was provided, else null' 
            },
            summary: { 
              type: 'STRING', 
              description: 'Comprehensive, beautifully formatted Markdown summary of the lecture' 
            },
            flashcards: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  front: { type: 'STRING' },
                  back: { type: 'STRING' }
                },
                required: ['front', 'back']
              }
            },
            quiz: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING' },
                  options: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  answerIndex: { type: 'INTEGER' },
                  explanation: { type: 'STRING' }
                },
                required: ['question', 'options', 'answerIndex', 'explanation']
              }
            }
          },
          required: ['summary', 'flashcards', 'quiz']
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('No content returned from Gemini.');
    }

    let cleanText = responseText.trim();
    if (cleanText.startsWith('```')) {
      const match = cleanText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (match) {
        cleanText = match[1].trim();
      }
    }

    const result = JSON.parse(cleanText);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in lecture summarizer API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing the lecture notes.' },
      { status: 500 }
    );
  }
}
