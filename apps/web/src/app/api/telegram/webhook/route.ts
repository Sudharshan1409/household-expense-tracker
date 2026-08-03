import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram-bot-handler";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    // Execute bot conversational logic
    await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing Telegram update:", error);
    return NextResponse.json({ ok: false, error: "Failed to process update" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Telegram bot webhook is running!" });
}
