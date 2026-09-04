import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { audioBase64, mimeType } = await req.json();

    if (!audioBase64) {
      return NextResponse.json({ ok: false, error: "Audio data is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Listen to the audio carefully and transcribe it exactly word for word. Return ONLY the transcribed text string without any extra formatting or conversational text.`;

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
      return NextResponse.json({ ok: false, error: result.error?.message || "Failed to transcribe audio with AI" }, { status: 500 });
    }

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ ok: true, text: rawText.trim() });
  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json({ ok: false, error: error.message || "An unexpected error occurred during audio parsing" }, { status: 500 });
  }
}
