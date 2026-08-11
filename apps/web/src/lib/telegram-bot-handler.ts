import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getMonthlySummaryOp } from "@/lib/summary";
import crypto from "node:crypto";

type BotState = "IDLE" | "AWAITING_AMOUNT" | "AWAITING_DESC" | "AWAITING_CATEGORY" | "AWAITING_TAGS" | "AWAITING_SPLIT";

interface BotSession {
  state: BotState;
  draft: {
    transactionType: "EXPENSE" | "INCOME";
    amount?: number;
    description?: string;
    category?: string;
    tags?: string[];
  };
}

const DEFAULT_CATEGORIES = ["Groceries", "Dining Out", "Utilities", "Rent", "Transportation", "Shopping", "Entertainment", "Health"];

async function sendMessage(chatId: number | string, text: string, options: any = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not configured");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...options,
      }),
    });
  } catch (error) {
    console.error("Failed to send telegram message:", error);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || "",
      }),
    });
  } catch (error) {
    console.error("Failed to answer callback query:", error);
  }
}

export async function handleTelegramUpdate(update: any) {
  const message = update.message;
  const callbackQuery = update.callback_query;

  if (!message && !callbackQuery) return;

  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
  const sender = message?.from || callbackQuery?.from;
  let text = message?.text?.trim() || callbackQuery?.data?.trim();

  if (!chatId) return;

  if (callbackQuery && callbackQuery.id) {
    await answerCallbackQuery(callbackQuery.id);
  }

  // 1. Handle pairing links (e.g. /start CONNECT-123456 or /link 123456)
  if (text && (text.startsWith("/start CONNECT-") || text.startsWith("/start LINK-") || text.startsWith("/link ") || text.startsWith("/start"))) {
    const parts = text.replace("/start CONNECT-", "").replace("/start LINK-", "").replace("/link ", "").trim();
    if (parts && parts !== "/start") {
      const code = parts;
      const pairingRes = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `TELEGRAM_PAIRING#${code}`,
          SK: "PAIRING"
        }
      }));

      const pairing = pairingRes.Item;
      if (pairing && Date.now() < pairing.expiresAt) {
        const userName = sender.first_name || sender.username || "Household Member";

        // Save Telegram profile mapping
        await db.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `TELEGRAM_USER#${chatId}`,
            SK: "PROFILE",
            userId: pairing.userId,
            householdId: pairing.householdId,
            userName,
            linkedAt: new Date().toISOString()
          }
        }));

        // Update member item in household
        await db.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `HOUSEHOLD#${pairing.householdId}`,
            SK: `MEMBER#${pairing.userId}`
          },
          UpdateExpression: "SET telegramChatId = :chatId, telegramUsername = :username",
          ExpressionAttributeValues: {
            ":chatId": String(chatId),
            ":username": sender.username || sender.first_name || "Member"
          }
        }));

        // Delete pairing token
        await db.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `TELEGRAM_PAIRING#${code}`,
            SK: "PAIRING"
          }
        }));

        await sendMessage(chatId, `🎉 <b>Welcome, ${userName}!</b>\nYour Telegram account is now securely linked to your Household Expense Tracker!\n\nType <code>hi</code> anytime to start recording expenses or viewing monthly stats!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add Expense", callback_data: "ACTION_EXPENSE" }, { text: "💰 Add Income", callback_data: "ACTION_INCOME" }],
              [{ text: "📊 View This Month's Spend", callback_data: "ACTION_VIEW_SPEND" }]
            ]
          }
        });
        return;
      } else if (parts !== "/start") {
        await sendMessage(chatId, `❌ <b>Invalid or expired pairing code.</b>\nPlease open your Household Expense Tracker app → <b>Settings → Manage Household → Telegram</b> to generate a new link.`);
        return;
      }
    }
  }

  // 2. Lookup authenticated profile for this chat ID
  const userRes = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TELEGRAM_USER#${chatId}`,
      SK: "PROFILE"
    }
  }));

  const profile = userRes.Item;
  if (!profile) {
    await sendMessage(chatId, `🔒 <b>Account Not Linked</b>\nTo use this bot, please log into your Household Expense Tracker web app, go to <b>Settings → Manage Household → Telegram</b>, and tap <b>Generate Telegram Pairing Link</b>.`);
    return;
  }

  // 3. Load Session State
  const sessionRes = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TELEGRAM_SESSION#${chatId}`,
      SK: "SESSION"
    }
  }));

  let session: BotSession = sessionRes.Item?.sessionData 
    ? JSON.parse(sessionRes.Item.sessionData) 
    : { state: "IDLE", draft: { transactionType: "EXPENSE" } };

  const saveSession = async (s: BotSession) => {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TELEGRAM_SESSION#${chatId}`,
        SK: "SESSION",
        sessionData: JSON.stringify(s),
        updatedAt: new Date().toISOString()
      }
    }));
  };

  const resetToMenu = async (msgPrefix?: string) => {
    await saveSession({ state: "IDLE", draft: { transactionType: "EXPENSE" } });
    const textToSend = msgPrefix || `👋 <b>Hi ${profile.userName || 'there'}!</b> What would you like to do today?`;
    await sendMessage(chatId, textToSend, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Add Expense", callback_data: "ACTION_EXPENSE" }, { text: "💰 Add Income", callback_data: "ACTION_INCOME" }],
          [{ text: "📊 View This Month", callback_data: "ACTION_VIEW_SPEND" }],
          [{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]
        ]
      }
    });
  };

  // Global reset commands
  if (!text || text.toLowerCase() === "hi" || text.toLowerCase() === "hello" || text.toLowerCase() === "menu" || text === "/start" || text === "/menu" || text === "CANCEL_FLOW") {
    if (text === "CANCEL_FLOW") {
      await sendMessage(chatId, "🚫 <i>Operation cancelled. Type <code>hi</code> anytime to start again!</i>");
      await saveSession({ state: "IDLE", draft: { transactionType: "EXPENSE" } });
      return;
    }
    await resetToMenu();
    return;
  }

  // View Spend Action
  if (text === "ACTION_VIEW_SPEND" || text.toLowerCase() === "/stats") {
    const now = new Date();
    const monthPrefix = now.toISOString().slice(0, 7); // e.g. 2026-08
    const txRes = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${profile.householdId}`,
        ":sk": `TRANSACTION#${monthPrefix}`
      }
    }));

    const txs = (txRes.Items || []) as any[];
    let totalSpend = 0;
    let mySpend = 0;
    let txCount = 0;

    txs.forEach(t => {
      if (t.transactionType !== "INCOME") {
        totalSpend += Number(t.amount || 0);
        if (t.createdBy === profile.userId || t.paidBy === profile.userId) {
          mySpend += Number(t.amount || 0);
        }
        txCount++;
      }
    });

    const monthName = now.toLocaleString("default", { month: "long" });
    await sendMessage(chatId, `📊 <b>This Month's Spend (${monthName}):</b>\n\n💰 <b>Total Household Spend:</b> ₹${totalSpend.toLocaleString('en-IN')}\n👤 <b>Your Recorded Share:</b> ₹${mySpend.toLocaleString('en-IN')}\n📝 <b>Total Expenses Recorded:</b> ${txCount}\n\n<i>Type <code>hi</code> to open the menu.</i>`);
    return;
  }

  // State machine handling
  switch (session.state) {
    case "IDLE": {
      if (text === "ACTION_EXPENSE" || text === "ACTION_INCOME") {
        const type = text === "ACTION_INCOME" ? "INCOME" : "EXPENSE";
        await saveSession({ state: "AWAITING_AMOUNT", draft: { transactionType: type } });
        await sendMessage(chatId, `💸 <b>How much was the ${type.toLowerCase()}?</b>\n<i>Please enter the numeric amount in ₹ (e.g. 450 or 1200):</i>`, {
          reply_markup: {
            inline_keyboard: [[{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]]
          }
        });
      } else {
        await resetToMenu();
      }
      break;
    }

    case "AWAITING_AMOUNT": {
      const numStr = text.replace(/[^\d.]/g, '');
      const amount = parseFloat(numStr);
      if (isNaN(amount) || amount <= 0) {
        await sendMessage(chatId, `⚠️ <b>Invalid Amount</b>\nPlease type a valid numeric amount (e.g. <code>250</code>):`);
        return;
      }
      session.draft.amount = amount;
      session.state = "AWAITING_DESC";
      await saveSession(session);

      await sendMessage(chatId, `Got it: <b>₹${amount.toLocaleString('en-IN')}</b>.\n\n📝 <b>What is this for?</b>\n<i>Please type a short description (mandatory, no skip):</i>`, {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]]
        }
      });
      break;
    }

    case "AWAITING_DESC": {
      if (text === "CANCEL_FLOW") {
        await saveSession({ state: "IDLE", draft: { transactionType: "EXPENSE" } });
        await sendMessage(chatId, "Cancelled.");
        return;
      }
      if (!text || text.length < 2) {
        await sendMessage(chatId, `Please enter a short description for this record:`);
        return;
      }
      session.draft.description = text.trim();
      session.state = "AWAITING_CATEGORY";
      await saveSession(session);

      // Fetch categories from household metadata
      const metaRes = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `HOUSEHOLD#${profile.householdId}`,
          SK: "METADATA"
        }
      }));

      const cats: string[] = metaRes.Item?.categories?.length ? metaRes.Item.categories : DEFAULT_CATEGORIES;
      const buttons: any[][] = [];
      for (let i = 0; i < cats.length; i += 2) {
        const row = [{ text: cats[i], callback_data: `CAT_${cats[i]}` }];
        if (i + 1 < cats.length) {
          row.push({ text: cats[i + 1], callback_data: `CAT_${cats[i + 1]}` });
        }
        buttons.push(row);
      }
      buttons.push([{ text: "⏭️ Skip Category (General)", callback_data: "SKIP_CAT" }]);
      buttons.push([{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]);

      await sendMessage(chatId, `Description set to: <b>${session.draft.description}</b>\n\n🛒 <b>Select a category:</b>`, {
        reply_markup: { inline_keyboard: buttons }
      });
      break;
    }

    case "AWAITING_CATEGORY": {
      let category = "General";
      if (text.startsWith("CAT_")) {
        category = text.replace("CAT_", "");
      } else if (text !== "SKIP_CAT") {
        category = text.trim();
      }
      session.draft.category = category;
      session.state = "AWAITING_TAGS";
      await saveSession(session);

      await sendMessage(chatId, `Category: <b>${category}</b>\n\n🏷️ <b>Any tags for this record?</b>\n<i>Type words starting with # or separated by spaces (e.g. <code>#food #essential</code>) or tap Skip:</i>`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏭️ Skip Tags", callback_data: "SKIP_TAGS" }],
            [{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]
          ]
        }
      });
      break;
    }

    case "AWAITING_TAGS": {
      let tags: string[] = [];
      if (text !== "SKIP_TAGS" && text !== "SKIP_CAT") {
        tags = text.split(/\s+/).map((t: string) => t.startsWith('#') ? t.substring(1).trim() : t.trim()).filter(Boolean);
      }
      session.draft.tags = tags;

      if (session.draft.transactionType === "INCOME") {
        // Income doesn't need expense splits, directly save!
        await saveAndFinishTransaction(chatId, profile, session, "NONE");
      } else {
        session.state = "AWAITING_SPLIT";
        await saveSession(session);

        await sendMessage(chatId, `Tags recorded: <b>${tags.length ? tags.map((t: string) => '#' + t).join(' ') : 'None'}</b>\n\n⚖️ <b>How should ₹${session.draft.amount} be split?</b>`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👥 Split Equally (All Members)", callback_data: "SPLIT_EQUAL" }],
              [{ text: "👤 Paid solely for Myself (100%)", callback_data: "SPLIT_NONE" }],
              [{ text: "❌ Cancel", callback_data: "CANCEL_FLOW" }]
            ]
          }
        });
      }
      break;
    }

    case "AWAITING_SPLIT": {
      const splitMode = text === "SPLIT_EQUAL" ? "EQUAL" : "NONE";
      await saveAndFinishTransaction(chatId, profile, session, splitMode);
      break;
    }

    default:
      await resetToMenu();
      break;
  }
}

async function saveAndFinishTransaction(chatId: string | number, profile: any, session: BotSession, splitMode: "EQUAL" | "NONE") {
  const amount = session.draft.amount || 0;
  const now = new Date().toISOString();
  const transactionId = crypto.randomUUID();

  let finalSplits: Record<string, number> = {};
  let isShared = splitMode === "EQUAL";

  if (isShared) {
    const memRes = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${profile.householdId}`,
        ":sk": "MEMBER#"
      }
    }));
    const members = memRes.Items || [];
    const userIds = members.map((m: any) => m.userId).filter(Boolean);

    if (userIds.length > 0) {
      const perPerson = Number((amount / userIds.length).toFixed(2));
      userIds.forEach(id => { finalSplits[id] = perPerson; });
      const sum = perPerson * userIds.length;
      if (sum !== amount && userIds.length > 0) {
        finalSplits[userIds[0]] += Number((amount - sum).toFixed(2));
      }
    } else {
      finalSplits[profile.userId] = amount;
      isShared = false;
    }
  } else {
    finalSplits[profile.userId] = amount;
  }

  const transactionItem = {
    PK: `HOUSEHOLD#${profile.householdId}`,
    SK: `TRANSACTION#${now}#${transactionId}`,
    id: transactionId,
    householdId: profile.householdId,
    createdBy: profile.userId,
    paidBy: profile.userId,
    amount,
    description: session.draft.description || "Telegram Expense",
    category: session.draft.category || "General",
    isShared,
    splitType: isShared ? "EQUAL" : "NONE",
    splits: finalSplits,
    date: now, // Full ISO timestamp for sorting and display accuracy
    transactionType: session.draft.transactionType || "EXPENSE",
    tags: session.draft.tags || [],
    createdAt: now
  };

  const transactItems: any[] = [{ Put: { TableName: TABLE_NAME, Item: transactionItem } }];
  
  const summaryOp = await getMonthlySummaryOp(profile.householdId, transactionItem, "ADD");
  transactItems.push(summaryOp);

  if (session.draft.tags && session.draft.tags.length > 0) {
    for (const tag of session.draft.tags) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...transactionItem,
            PK: `HOUSEHOLD#${profile.householdId}#TAG#${tag}`
          }
        }
      });
    }

    // Ensure tags exist in household metadata
    try {
      const metaRes = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `HOUSEHOLD#${profile.householdId}`, SK: "METADATA" }
      }));
      const metadata = metaRes.Item || {};
      const currentTags = metadata.tags || [];
      let newTagAdded = false;
      const updatedTags = [...currentTags];
      for (const tag of session.draft.tags) {
        if (!updatedTags.includes(tag)) {
          updatedTags.push(tag);
          newTagAdded = true;
        }
      }
      if (newTagAdded) {
        await db.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: { ...metadata, tags: updatedTags }
        }));
      }
    } catch (err) {
      console.error("Failed to update household metadata tags:", err);
    }
  }

  await db.send(new TransactWriteCommand({ TransactItems: transactItems }));
  await db.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TELEGRAM_SESSION#${chatId}`,
      SK: "SESSION",
      sessionData: JSON.stringify({ state: "IDLE", draft: { transactionType: "EXPENSE" } }),
      updatedAt: now
    }
  }));

  const tagsStr = session.draft.tags?.length ? session.draft.tags.map((t: string) => '#' + t).join(' ') : 'None';
  const splitStr = isShared ? "Equally among household members" : "Individual (100% yourself)";

  await sendMessage(chatId, `🎉 <b>Transaction Saved Successfully!</b>\n\n📌 <b>Description:</b> ${transactionItem.description}\n💰 <b>Amount:</b> ₹${amount.toLocaleString('en-IN')}\n🛒 <b>Category:</b> ${transactionItem.category}\n🏷️ <b>Tags:</b> ${tagsStr}\n👥 <b>Split:</b> ${splitStr}\n👤 <b>Recorded by:</b> ${profile.userName}\n\n<i>Type <code>hi</code> anytime to log another record!</i>`);
}
