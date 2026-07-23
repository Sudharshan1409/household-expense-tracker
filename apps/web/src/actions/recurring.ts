"use server";

import { db, TABLE_NAME } from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export async function getTemplates(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);
  
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `RECURRING#${user.userId}#`, // User-specific templates
    },
  });

  const response = await db.send(command);
  return response.Items || [];
}

export async function createTemplate(
  idToken: string,
  householdId: string,
  data: {
    amount: number;
    description: string;
    category: string;
    transactionType: "EXPENSE" | "INCOME";
    isShared?: boolean;
    splitType?: string;
    splits?: Record<string, number>;
  }
) {
  const user = await verifyToken(idToken);
  const templateId = crypto.randomUUID();
  const now = new Date().toISOString();

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `RECURRING#${user.userId}#${templateId}`,
      id: templateId,
      householdId,
      userId: user.userId,
      amount: data.amount,
      description: data.description,
      category: data.category,
      transactionType: data.transactionType,
      isShared: data.isShared || false,
      splitType: data.splitType || "NONE",
      splits: data.splits || {},
      createdAt: now,
    },
  });

  await db.send(command);
  return templateId;
}

export async function updateTemplate(
  idToken: string,
  householdId: string,
  templateId: string,
  data: {
    amount: number;
    description: string;
    category: string;
    transactionType: "EXPENSE" | "INCOME";
    isShared?: boolean;
    splitType?: string;
    splits?: Record<string, number>;
  }
) {
  const user = await verifyToken(idToken);
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `RECURRING#${user.userId}#${templateId}`,
      id: templateId,
      householdId,
      userId: user.userId,
      amount: data.amount,
      description: data.description,
      category: data.category,
      transactionType: data.transactionType,
      isShared: data.isShared || false,
      splitType: data.splitType || "NONE",
      splits: data.splits || {},
      updatedAt: new Date().toISOString(),
    },
  });

  await db.send(command);
  return true;
}

export async function deleteTemplate(idToken: string, householdId: string, templateId: string) {
  const user = await verifyToken(idToken);

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `RECURRING#${user.userId}#${templateId}`,
    },
  });

  await db.send(command);
  return true;
}
