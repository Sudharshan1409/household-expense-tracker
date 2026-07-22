"use server";

import { db, TABLE_NAME } from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export async function createTransaction(
  idToken: string,
  householdId: string,
  data: {
    amount: number;
    description: string;
    category: string;
    isShared: boolean;
    splitType?: "EQUAL" | "PERCENTAGE" | "EXACT" | "NONE";
    splits?: Record<string, number>;
    date: string;
    transactionType?: "EXPENSE" | "INCOME";
    paidBy?: string;
    receiptUrl?: string;
  }
) {
  const user = await verifyToken(idToken);
  const transactionId = crypto.randomUUID();
  const now = new Date().toISOString();

  let finalSplits: Record<string, number> = {};
  
  if (!data.isShared) {
    finalSplits[user.userId] = data.amount;
  } else if (data.splitType === "EQUAL" && data.splits) {
    const userIds = Object.keys(data.splits);
    const amountPerPerson = Number((data.amount / userIds.length).toFixed(2));
    userIds.forEach(id => {
      finalSplits[id] = amountPerPerson;
    });
    const sum = amountPerPerson * userIds.length;
    if (sum !== data.amount && userIds.length > 0) {
      finalSplits[userIds[0]] += Number((data.amount - sum).toFixed(2));
    }
  } else if (data.splitType === "PERCENTAGE" && data.splits) {
    Object.entries(data.splits).forEach(([id, pct]) => {
      finalSplits[id] = Number(((data.amount * pct) / 100).toFixed(2));
    });
  } else if (data.splitType === "EXACT" && data.splits) {
    finalSplits = data.splits;
  }

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `TRANSACTION#${data.date || now}#${transactionId}`,
        id: transactionId,
        householdId,
        createdBy: user.userId,
        paidBy: data.paidBy || user.userId,
        amount: data.amount,
        description: data.description,
        category: data.category,
        isShared: data.isShared,
        splitType: data.isShared ? data.splitType : "NONE",
        splits: finalSplits,
        date: data.date,
        transactionType: data.transactionType || "EXPENSE",
        receiptUrl: data.receiptUrl,
        createdAt: now,
      },
    })
  );

  return transactionId;
}

export async function getRecentTransactions(idToken: string, householdId: string, limit = 100, monthYYYYMM?: string) {
  await verifyToken(idToken);

  let keyCondition = "PK = :pk AND begins_with(SK, :skPrefix)";
  let expressionValues: any = {
    ":pk": `HOUSEHOLD#${householdId}`,
    ":skPrefix": `TRANSACTION#`,
  };

  if (monthYYYYMM) {
    const [yearStr, monthStr] = monthYYYYMM.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-indexed

    // Calculate IST start (1st of month at 00:00:00 IST)
    // IST is UTC+5:30. So UTC time = IST time - 5.5 hours.
    // However, JS Date works in the local environment's timezone.
    // We can explicitly construct the UTC dates by adjusting for the 5.5 hour offset.
    
    // Start of month in IST (e.g. 2026-07-01 00:00:00 IST)
    // This is 2026-06-30 18:30:00 UTC
    const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    startDate.setHours(startDate.getHours() - 5);
    startDate.setMinutes(startDate.getMinutes() - 30);
    const startIso = startDate.toISOString();

    // End of month in IST (e.g. 2026-08-01 00:00:00 IST)
    const endDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
    endDate.setHours(endDate.getHours() - 5);
    endDate.setMinutes(endDate.getMinutes() - 30);
    const endIso = endDate.toISOString();

    keyCondition = "PK = :pk AND SK BETWEEN :start AND :end";
    expressionValues = {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":start": `TRANSACTION#${startIso}`,
      ":end": `TRANSACTION#${endIso}`,
    };
  }

  let items: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false, // Descending order (newest first)
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await db.send(command);
    items = items.concat(response.Items || []);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey && items.length < limit);

  items = items.slice(0, limit);
  
  // Enforce chronological sorting (newest first) in case SK sorting was thrown off by old createdAt values
  items.sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt).getTime();
    const dateB = new Date(b.date || b.createdAt).getTime();
    return dateB - dateA;
  });

  return items;
}

export async function deleteTransaction(idToken: string, householdId: string, sk: string) {
  const user = await verifyToken(idToken);
  // Optional: Verify user's role in the household to allow deletion.
  // For simplicity, we allow any member to delete, or we can check if they created it.
  
  await db.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: sk,
      },
    })
  );
  
  return true;
}

export async function getTransactionsFromDate(idToken: string, householdId: string, startDateIso: string) {
  await verifyToken(idToken);

  let items: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK >= :start",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${householdId}`,
        ":start": `TRANSACTION#${startDateIso}`,
      },
      ScanIndexForward: false, // Descending order (newest first)
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await db.send(command);
    items = items.concat(response.Items || []);
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  items.sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt).getTime();
    const dateB = new Date(b.date || b.createdAt).getTime();
    return dateB - dateA;
  });

  return items;
}
