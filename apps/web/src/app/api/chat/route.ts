import { streamText, tool, convertToModelMessages, UIMessage, isStepCount } from 'ai';
import { z } from 'zod';
import { getMonthlySummaries, getRecentTransactions, getTransactionsFromDate, getTransactionsByTag } from '@/actions/transaction';
import { getHousehold, getHouseholdMembers } from '@/actions/household';
import { getTemplates } from '@/actions/recurring';
import { verifyToken } from '@/lib/auth-server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY?.trim(),
});

export async function POST(req: Request) {
  const body = await req.json();
  console.log('Incoming body to /api/chat:', typeof body, body);
  
  const messages: UIMessage[] = body.messages || (body.data && body.data.messages) || [];
  const householdId = body.data?.householdId || body.householdId;
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.split(' ')[1];

  if (!idToken || !householdId) {
    return new Response('Unauthorized or Missing Household ID', { status: 401 });
  }

  try {
    const user = await verifyToken(idToken);
    const members = await getHouseholdMembers(idToken, householdId);
    const household = await getHousehold(idToken, householdId);
    
    const membersInfo = members.map((m: any) => `- ${m.name || m.email} (ID: ${m.userId}, Monthly Budget: ₹${m.budget || 0})`).join("\n");
    const fixedCategories = household?.fixedCategories || [];
    const fixedCategoriesStr = fixedCategories.length > 0 ? fixedCategories.join(", ") : "None";

    const coreMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: google('gemini-2.5-pro'),
      stopWhen: isStepCount(5),
      system: `You are the AI Financial Advisor for this household. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })} (ISO: ${new Date().toISOString()}).
The user you are currently chatting with is ${user.name || user.email} (ID: ${user.userId}). 
The household has the following members:
${membersInfo}

APP DOMAIN KNOWLEDGE (CRUCIAL):
1. TRANSACTIONS: The app only supports "EXPENSE" and "INCOME" transactions.
2. FIXED VS VARIABLE: Expenses belonging to the following categories are "Fixed Expenses": [${fixedCategoriesStr}]. EVERYTHING else is considered a "Variable Expense". Fixed expenses are excluded from daily pacing limits and budgets. Variable expenses are what count towards the budget.
3. SPLITS & LIABILITY: Transactions can be split among members (isShared = true). If a transaction is shared, the 'splits' object determines each member's liability. If NOT shared, the user who paid it (paidBy) is 100% liable. 
4. DEBTS: The app tracks debts (internal IOUs or external). An expense might have a 'linkedDebtId' if it was a payment towards a debt.

IMPORTANT: If the user asks about "my" spending, "my" expenses, or "what I spent", you MUST ONLY calculate based on their specific liability (from the splits object if shared, or if they paid for a non-shared expense) for their user ID (${user.userId}).
If the user asks about the "household" spending or "total" spending, include all members.

The user's timezone is Asia/Kolkata (IST, UTC+5:30).
IMPORTANT: The database returns dates in UTC. You MUST convert all UTC dates to the user's local timezone (IST) before displaying or filtering them. For example, a UTC date of "2026-08-31T18:30:00.000Z" is actually September 1st in IST!
Your job is to answer questions about the user's spending, budget, and savings.
You have access to several Read-Only tools to fetch data from the database.
If you need to query data, choose the most efficient tool (e.g., if asked about a tag, use getTransactionsByTag; if asked about a specific month's total, use getMonthlySummaries).
Never attempt to modify data. Always be helpful, concise, and friendly.

FORMATTING GUIDELINES:
- **Markdown Tables:** Whenever listing multiple transactions, budget breakdowns, or side-by-side data, always use Markdown tables (e.g., | Date | Description | Amount |).
- **Rich Text:** Use **bold** and *italic* text to highlight key metrics, totals, or important alerts.
- **Lists:** Use bullet points or numbered lists to break down step-by-step advice or summaries.
- **Blockquotes:** Use \`> \` to highlight key takeaways, alerts, or financial tips.
- **Emojis:** Generously use relevant emojis (like 💰, 📉, ⚠️, 🛒, 🍽️) to make the financial data visually engaging and modern.

DO NOT dump raw JSON or thousands of transactions in your response. Instead, analyze the data and provide clear, structured insights using the formatting rules above. If there are too many transactions, summarize them.

UI WIDGETS (IMPORTANT):
If the user asks for a "chart", "graph", or "visual trend" of their spending/income, DO NOT attempt to write JSON, ASCII art, or markdown for a chart. Simply execute the \`getMonthlySummaries\` tool! The frontend UI will automatically intercept this tool call and render a beautiful, interactive Bar Chart widget for the user. Just provide a brief textual summary of the data and let the UI handle the visualization.`,
      messages: coreMessages,
      tools: {
        getMonthlySummaries: tool({
          description: 'Get the high-level monthly spending and income summaries for the household. Gives totals per user per month.',
          inputSchema: z.object({}),
          execute: async () => {
            try {
              console.log("Calling getMonthlySummaries with idToken:", !!idToken, "householdId:", householdId);
              return await getMonthlySummaries(idToken, householdId);
            } catch (err: any) {
              console.error("Error in getMonthlySummaries:", err);
              throw err;
            }
          },
        }),
        getRecentTransactions: tool({
          description: 'Get the most recent transactions for the household. Can optionally filter to a specific month (YYYY-MM).',
          inputSchema: z.object({
            limit: z.number().optional().describe('Number of transactions to return (default 100)'),
            monthYYYYMM: z.string().optional().describe('Filter by month in YYYY-MM format'),
          }),
          execute: async ({ limit = 100, monthYYYYMM }) => {
            return await getRecentTransactions(idToken, householdId, limit, monthYYYYMM);
          },
        }),
        getTransactionsFromDate: tool({
          description: 'Get all transactions from a specific start date.',
          inputSchema: z.object({
            startDateIso: z.string().describe('Start date in ISO format, e.g., 2026-08-01T00:00:00.000Z'),
          }),
          execute: async ({ startDateIso }) => {
            return await getTransactionsFromDate(idToken, householdId, startDateIso);
          },
        }),
        getTransactionsByTag: tool({
          description: 'Get all transactions associated with a specific tag (e.g., groceries, food). Do NOT include the # symbol in the tag name.',
          inputSchema: z.object({
            tag: z.string().describe('The tag name (without #)'),
          }),
          execute: async ({ tag }) => {
            return await getTransactionsByTag(idToken, householdId, tag);
          },
        }),
        getHouseholdMetadata: tool({
          description: 'Get the configuration for the household, including savings goals and custom tags.',
          inputSchema: z.object({}),
          execute: async () => {
            return await getHousehold(idToken, householdId);
          },
        }),
        getHouseholdMembers: tool({
          description: 'Get the list of members (users) in the household.',
          inputSchema: z.object({}),
          execute: async () => {
            return await getHouseholdMembers(idToken, householdId);
          },
        }),
        getRecurringTemplates: tool({
          description: 'Get the recurring transaction templates (bills, subscriptions) setup for the household.',
          inputSchema: z.object({}),
          execute: async () => {
            return await getTemplates(idToken, householdId);
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages
    });
  } catch (error: any) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: error.message, body }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
