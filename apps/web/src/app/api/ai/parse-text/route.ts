import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, categories = [], tags = [] } = await req.json();

    if (!text) {
      return NextResponse.json({ ok: false, error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Analyze the following natural language expense entry and extract the details.
Current Date and Time: ${new Date().toISOString()} (Use this as 'today' to calculate relative dates like 'yesterday', 'last friday', etc.)

Return ONLY a valid JSON object matching this exact schema:
{
  "amount": number (the numeric amount, remove currencies. return 0 if none found),
  "description": string (short description of the expense or merchant. ALWAYS Capitalize or Title Case this, e.g. 'Uber', 'D-Mart'),
  "category": string (choose the single best matching category from this list: ${JSON.stringify(categories)}. If none match accurately, select the closest one or default to 'Other'),
  "date": string (extract the date if mentioned e.g., 'yesterday', 'last friday' and convert to YYYY-MM-DDThh:mm using the Current Date provided above. If not mentioned, return empty string ""),
  "tags": string[] (an array of exactly 8 lowercase descriptive keywords without '#' symbols. Important: First prioritize selecting any relevant tags from this existing household list: ${JSON.stringify(tags)}. If the relevant existing tags are fewer than 8, invent new descriptive tags to reach exactly 8 tags total. e.g. ["grocery", "dmart", "essential"])
}

Expense Entry: "${text}"

Do not return any extra markdown styling, code block backticks, or explanation. Just the raw JSON string.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText }
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
      return NextResponse.json({ ok: false, error: result.error?.message || "Failed to analyze text with AI" }, { status: 500 });
    }

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({ ok: true, data: parsedData });
  } catch (error: any) {
    console.error("Error analyzing text:", error);
    return NextResponse.json({ ok: false, error: error.message || "An unexpected error occurred during AI parsing" }, { status: 500 });
  }
}
