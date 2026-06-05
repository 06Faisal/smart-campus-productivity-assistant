import { NextResponse } from 'next/server';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { text, customKey, referenceDate } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Syllabus text is required.' }, { status: 400 });
    }

    const ai = getGeminiClient(customKey);

    const systemPrompt = `
You are an expert academic organizer. Your job is to extract important calendar events from a course syllabus.
The user will provide the syllabus text and a reference date which represents "today". Use this reference date to infer the correct year for the dates mentioned in the syllabus.

Reference Date: ${referenceDate || new Date().toISOString()}

Extract the following types of events:
1. "class": Regular class meeting times (generate weekly events for the duration of the semester/course if a schedule is given, limit to maximum 15 class events to prevent overflow).
2. "exam": Midterms, finals, quizzes, tests.
3. "assignment": Deadlines for projects, essays, labs, homework.
4. "study_session": Suggested review sessions or study blocks mentioned.
5. "other": Guest lectures, holiday breaks, special events.

For each event, you must return:
- "title": Concise, descriptive name of the event (e.g., "CS 101: Lecture 1" or "CS 101: Midterm Exam").
- "start_time": ISO 8601 DateTime string. Adjust times appropriately (e.g., if a class meets at 10:00 AM, output that timestamp).
- "end_time": ISO 8601 DateTime string (e.g., 1-2 hours after start_time).
- "description": Short description, including details like location, chapters covered, grading weight (e.g. "Weight: 15%"), or instructions.
- "type": One of "class", "exam", "assignment", "study_session", or "other".
- "course": Name of the course (e.g., "Data Structures").

Return ONLY a valid JSON array of these event objects. Do not wrap in markdown blocks, do not include any explanatory text. Just the raw JSON array.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text: `Syllabus Content:\n${text}` }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        // Enforce JSON output format
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('No content returned from Gemini.');
    }

    // Parse the JSON array
    const events = JSON.parse(responseText.trim());

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Error in syllabus parser API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while parsing the syllabus.' },
      { status: 500 }
    );
  }
}
