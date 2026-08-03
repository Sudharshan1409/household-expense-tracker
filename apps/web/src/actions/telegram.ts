"use server";

import { db, TABLE_NAME } from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function generateTelegramPairingCode(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);

  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes from now

  await db.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TELEGRAM_PAIRING#${code}`,
      SK: "PAIRING",
      userId: user.userId,
      householdId,
      expiresAt,
      createdAt: new Date().toISOString()
    }
  }));

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "HouseholdExpenseTrackerBot";

  return { code, botUsername };
}

export async function getTelegramStatus(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);

  const res = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MEMBER#${user.userId}`
    }
  }));

  const member = res.Item || {};
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "HouseholdExpenseTrackerBot";

  return {
    isLinked: !!member.telegramChatId,
    telegramUsername: member.telegramUsername || (member.telegramChatId ? String(member.telegramChatId) : null),
    botUsername
  };
}

export async function unlinkTelegram(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);

  const res = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MEMBER#${user.userId}`
    }
  }));

  const member = res.Item;
  if (member && member.telegramChatId) {
    // Delete inverse lookup item
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TELEGRAM_USER#${member.telegramChatId}`,
        SK: "PROFILE"
      }
    }));

    // Remove fields from member record
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${user.userId}`
      },
      UpdateExpression: "REMOVE telegramChatId, telegramUsername, telegramUserId"
    }));
  }

  return { success: true };
}
