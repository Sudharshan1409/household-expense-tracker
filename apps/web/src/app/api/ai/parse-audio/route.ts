import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType, categories = [], tags = [] } = await req.json();

    if (!audioBase64) {
      return NextResponse.json({ ok: false, error: "Audio data is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Analyze the following audio clip of a natural language expense entry and extract the details.
Current Date and Time: ${new Date().toISOString()} (Use this as 'today' to calculate relative dates like 'yesterday', 'last friday', etc.)

Listen to the audio carefully. Return ONLY a valid JSON object matching this exact schema:
{
  "amount": number (the numeric amount spoken, remove currencies. return 0 if none found. Note: if they say "400 for", don't confuse it as "40004"),
  "description": string (short description of the expense or merchant. ALWAYS Capitalize or Title Case this),
  "category": string (choose the single best matching category from this list: ${JSON.stringify(categories)}. If none match accurately, select the closest one or default to 'Other'),
  "date": string (extract the date if mentioned e.g., 'yesterday' and convert to YYYY-MM-DDThh:mm using the Current Date provided above. If not mentioned, return empty string ""),
  "tags": string[] (an array of exactly 8 lowercase descriptive keywords without '#' symbols. Important: First prioritize selecting any relevant tags from this existing household list: ${JSON.stringify(tags)}. If the relevant existing tags are fewer than 8, invent new descriptive tags to reach exactly 8 tags total. e.g. ["grocery", "dmart", "essential"]),
  "transcript": string (the exact transcribed text of what the user said in the audio)
}

Do not return any extra markdown styling, code block backticks, or explanation. Just the raw JSON string.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType || "audio/webm",
                data: audioBase64,
              }
            }
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const genRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await genRes.json();

    if (!genRes.ok) {
      console.error("Gemini API Error:", result);
      return NextResponse.json({ ok: false, error: result.error?.message || "Failed to analyze audio with AI" }, { status: 500 });
    }

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({ ok: true, data: parsedData });
  } catch (error: any) {
    console.error("Error analyzing audio:", error);
    return NextResponse.json({ ok: false, error: error.message || "An unexpected error occurred during audio parsing" }, { status: 500 });
  }
}
