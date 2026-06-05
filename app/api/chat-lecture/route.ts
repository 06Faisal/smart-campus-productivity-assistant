import { NextResponse } from 'next/server';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { lectureTitle, lectureContent, messages, customKey } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages history is required.' }, { status: 400 });
    }

    const ai = getGeminiClient(customKey);

    const systemInstruction = `
You are a knowledgeable academic tutor helping a student study their lecture notes.
You have access to the student's lecture materials. Ground all your answers strictly in the context of the lecture details provided below.
If the answer cannot be found in the lecture notes, tell the student honestly that it is not covered, but you can explain the concept generally if they wish.

Lecture Title: "${lectureTitle}"
Lecture Context Materials:
${lectureContent}

Provide helpful, clear, and structured explanations. Feel free to use markdown bullets and code formatting. Keep your responses concise.
`;

    // Map messages history to Gemini SDK format
    // Gemini roles: 'user', 'model'
    const formattedContents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const reply = response.text;
    if (!reply) {
      throw new Error('No response returned from Gemini.');
    }

    return NextResponse.json({ message: reply });

  } catch (error: any) {
    console.error('Error in lecture chat API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during note chat.' },
      { status: 500 }
    );
  }
}
