import { db, TABLE_NAME } from "./db";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export async function getMonthlySummaryOp(
  householdId: string,
  transaction: any,
  operation: "ADD" | "REMOVE"
) {
  const date = new Date(transaction.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  const existing = await db.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MONTHLY_SUMMARY#${monthKey}`
    }
  }));

  const summary = existing.Item || {
    PK: `HOUSEHOLD#${householdId}`,
    SK: `MONTHLY_SUMMARY#${monthKey}`,
    type: "MONTHLY_SUMMARY",
    month: monthKey,
    users: {}
  };

  const isIncome = transaction.transactionType === "INCOME";
  const multiplier = operation === "ADD" ? 1 : -1;

  const splits = transaction.splits || {};
  
  if (Object.keys(splits).length > 0) {
    for (const [uid, amt] of Object.entries(splits)) {
      if (!summary.users[uid]) summary.users[uid] = { income: 0, spend: 0 };
      if (isIncome) {
        summary.users[uid].income += (amt as number) * multiplier;
      } else {
        summary.users[uid].spend += (amt as number) * multiplier;
      }
    }
  } else {
    const uid = transaction.paidBy;
    if (!summary.users[uid]) summary.users[uid] = { income: 0, spend: 0 };
    if (isIncome) {
      summary.users[uid].income += transaction.amount * multiplier;
    } else {
      summary.users[uid].spend += transaction.amount * multiplier;
    }
  }

  // Prevent negative totals due to floating point inaccuracies when zeroing out
  for (const uid in summary.users) {
    if (summary.users[uid].income < 0.01) summary.users[uid].income = 0;
    if (summary.users[uid].spend < 0.01) summary.users[uid].spend = 0;
  }

  return {
    Put: {
      TableName: TABLE_NAME,
      Item: summary,
    }
  };
}
