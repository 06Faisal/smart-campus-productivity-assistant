import { NextResponse } from 'next/server';
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { 
      course, 
      examTitle, 
      examDate, 
      difficulty, 
      dailyHours, 
      preferredTime, 
      studyStyle, 
      topics,
      existingEvents,
      customKey 
    } = await request.json();

    if (!course || !examTitle || !examDate || !dailyHours) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const ai = getGeminiClient(customKey);

    const existingEventsSummary = existingEvents && Array.isArray(existingEvents)
      ? existingEvents.map((e: any) => `${e.title} (${e.type}) on ${new Date(e.start_time).toLocaleString()}`).join('\n')
      : 'None';

    const systemPrompt = `
You are a top academic advisor specializing in cognitive learning schedules and study planning.
Create a personalized study plan for a student preparing for an upcoming exam.

Input Constraints:
- Course: ${course}
- Exam Title: ${examTitle}
- Exam Date: ${new Date(examDate).toLocaleDateString()}
- Difficulty Level (1 to 5): ${difficulty}/5
- Study Time Budget: ${dailyHours} hours/day
- Preferred Time of Day: ${preferredTime} (Morning: 9am-12pm, Afternoon: 1pm-4pm, Evening: 6pm-9pm)
- Study Style: ${studyStyle}
- Core Topics to Cover: ${topics || 'General course curriculum'}

Avoid conflicts with existing calendar events if possible:
${existingEventsSummary}

Return a structured JSON object with the following two fields:
1. "markdown": A detailed study plan in Markdown format, with headers and bullet points. Break it down day-by-day (or week-by-week if the exam is far away). Explain what topics to study, active recall strategies to use, and motivational tips.
2. "events": A JSON array of calendar event objects representing scheduled study blocks. You should schedule study blocks starting from tomorrow up until the day before the exam.
   Each event in this array must have:
   - "title": Text title (e.g., "Study: ${course} - Topics X & Y").
   - "start_time": ISO 8601 DateTime string (align with the student's preferred study time of day, e.g., if Evening is preferred, schedule around 6:00 PM / 18:00).
   - "end_time": ISO 8601 DateTime string (length matching the daily hour budget, e.g., 2 hours).
   - "description": Focus checklist for this study session (e.g. "Review Chapter 3 definitions, do 5 practice questions").
   - "type": Always "study_session".
   - "course": "${course}"

Ensure the response is valid JSON and contains ONLY the JSON object. Do not include markdown code fence formatting.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Generate a personalized study plan for: ${course} - ${examTitle}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            markdown: {
              type: 'STRING',
              description: 'A detailed study plan in Markdown format, day-by-day or week-by-week. Explains topics, recall strategies, and motivational tips.'
            },
            events: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  start_time: { type: 'STRING', description: 'ISO 8601 DateTime string' },
                  end_time: { type: 'STRING', description: 'ISO 8601 DateTime string' },
                  description: { type: 'STRING', description: 'Focus checklist for this study session' },
                  type: { type: 'STRING', description: 'Always study_session' },
                  course: { type: 'STRING' }
                },
                required: ['title', 'start_time', 'end_time', 'description', 'type', 'course']
              },
              description: 'Array of study session events scheduled in the calendar.'
            }
          },
          required: ['markdown', 'events']
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
    console.error('Error in study planner API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while generating the study plan.' },
      { status: 500 }
    );
  }
}
