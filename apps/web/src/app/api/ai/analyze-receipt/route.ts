import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, categories = ["Groceries", "Dining Out", "Utilities", "Rent", "Transportation", "Shopping", "Entertainment", "Health"] } = await req.json();

    if (!image || !mimeType) {
      return NextResponse.json({ ok: false, error: "Image data is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `Analyze this receipt, bill, invoice, or payment app screenshot (Google Pay, PhonePe, credit card slip, etc.).
Extract the expense details and return ONLY a valid JSON object matching this exact schema:
{
  "amount": number (the numeric amount paid, e.g. 1450.50. Remove all currency symbols and commas. If there are multiple numbers, choose the final grand total or debited amount),
  "description": string (the merchant name or a concise summary of the transaction, e.g. 'DMart Superstore', 'Shell Petrol', 'Swiggy Food'),
  "category": string (choose the single best matching category from this list: ${JSON.stringify(categories)}. If none match accurately, select the closest one or default to 'General'),
  "date": string (the transaction date and time in YYYY-MM-DDThh:mm format if clearly visible on the receipt/screenshot. If only date is visible without time, assume 12:00. Otherwise return an empty string ""),
  "tags": string[] (an array of 2-4 lowercase descriptive keywords without '#' symbols, e.g. ["grocery", "dmart", "essential"])
}
Do not return any extra markdown styling, code block backticks, or explanation. Just the raw JSON string.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: image.replace(/^data:image\/[a-z]+;base64,/, ""),
              },
            },
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
      return NextResponse.json({ ok: false, error: result.error?.message || "Failed to analyze image with AI" }, { status: 500 });
    }

    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({ ok: true, data: parsedData });
  } catch (error: any) {
    console.error("Error analyzing receipt:", error);
    return NextResponse.json({ ok: false, error: error.message || "An unexpected error occurred during AI scanning" }, { status: 500 });
  }
}
