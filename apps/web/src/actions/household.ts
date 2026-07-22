"use server";

import { db, TABLE_NAME } from "@/lib/db";
import { verifyToken } from "@/lib/auth-server";
import { QueryCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";

/**
 * Check if the user belongs to any household.
 */
export async function getUserHouseholds(idToken: string) {
  const user = await verifyToken(idToken);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `USER#${user.userId}`,
    },
  });

  const response = await db.send(command);
  return response.Items || [];
}

/**
 * Fetch Household metadata by ID.
 */
export async function getHousehold(idToken: string, householdId: string) {
  await verifyToken(idToken); // verify caller

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `METADATA`,
    },
  });

  const response = await db.send(command);
  return response.Items?.[0] || null;
}

/**
 * Create a new household and assign the user as the OWNER.
 */
export async function createHousehold(idToken: string, name: string, budget: number) {
  const user = await verifyToken(idToken);
  const householdId = crypto.randomUUID();
  const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const now = new Date().toISOString();

  const command = new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `HOUSEHOLD#${householdId}`,
            SK: `METADATA`,
            id: householdId,
            name,
            inviteCode,
            currency: "INR",
            createdAt: now,
            updatedAt: now,
          },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `HOUSEHOLD#${householdId}`,
            SK: `MEMBER#${user.userId}`,
            GSI1PK: `USER#${user.userId}`,
            GSI1SK: `HOUSEHOLD#${householdId}`,
            userId: user.userId,
            userName: user.name || user.email,
            householdId,
            role: "OWNER",
            budget,
            joinedAt: now,
          },
        },
      },
    ],
  });

  await db.send(command);
  return householdId;
}

/**
 * Leave a household (remove membership).
 */
export async function leaveHousehold(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MEMBER#${user.userId}`,
    },
  });

  await db.send(command);
  return true;
}

/**
 * Delete a household completely (Owner only).
 */
export async function deleteHousehold(idToken: string, householdId: string) {
  const user = await verifyToken(idToken);

  // First verify user is OWNER
  const membershipCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `MEMBER#${user.userId}`,
    },
  });
  
  const membershipResponse = await db.send(membershipCommand);
  if (!membershipResponse.Items || membershipResponse.Items.length === 0 || membershipResponse.Items[0].role !== "OWNER") {
    throw new Error("Only the owner can delete the household");
  }

  // Fetch all items related to this household (Transactions, Members, Metadata)
  const allItemsCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
    },
  });

  const allItems = await db.send(allItemsCommand);
  if (!allItems.Items) return true;

  // Delete them one by one (for production, use BatchWriteItem for efficiency)
  for (const item of allItems.Items) {
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: item.PK,
        SK: item.SK,
      }
    }));
  }

  return true;
}

/**
 * Join a household via invite link.
 */
export async function joinHousehold(idToken: string, householdId: string, budget: number) {
  const user = await verifyToken(idToken);
  const now = new Date().toISOString();

  // Validate the household exists first
  const householdMeta = await db.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${householdId}`,
        ":sk": `METADATA`,
      },
    })
  );

  if (!householdMeta.Items || householdMeta.Items.length === 0) {
    throw new Error("Invalid invite link: Household does not exist");
  }

  // Add user to household
  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${user.userId}`,
        GSI1PK: `USER#${user.userId}`,
        GSI1SK: `HOUSEHOLD#${householdId}`,
        userId: user.userId,
        userName: user.name || user.email,
        householdId,
        role: "MEMBER",
        budget,
        joinedAt: now,
      },
    })
  );
  
  return true;
}

/**
 * Fetch all members of a household.
 */
export async function getHouseholdMembers(idToken: string, householdId: string) {
  await verifyToken(idToken); // verify caller

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":skPrefix": `MEMBER#`,
    },
  });

  const response = await db.send(command);
  return response.Items || [];
}

/**
 * Helper to verify caller is OWNER
 */
async function verifyOwner(userId: string, householdId: string) {
  const membershipCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `MEMBER#${userId}`,
    },
  });
  const res = await db.send(membershipCommand);
  if (!res.Items || res.Items.length === 0 || res.Items[0].role !== "OWNER") {
    throw new Error("Unauthorized: Only the owner can perform this action");
  }
}

/**
 * Update household settings (Name, Budget). Owner or Admin only.
 */
export async function updateHouseholdSettings(idToken: string, householdId: string, settings: { name: string; monthlyBudget: number }) {
  const user = await verifyToken(idToken);
  await verifyOwner(user.userId, householdId);
  
  const existingCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `METADATA`,
    },
  });
  const existing = await db.send(existingCommand);
  const metadata = existing.Items?.[0] || {};
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `METADATA`,
      id: householdId,
      name: settings.name,
      monthlyBudget: settings.monthlyBudget,
      currency: "INR",
      categories: metadata.categories, // retain categories
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  await db.send(command);
  return true;
}

/**
 * Update household categories (Owner or Admin).
 */
export async function updateHouseholdCategories(idToken: string, householdId: string, categories: string[]) {
  const user = await verifyToken(idToken);
  await verifyOwner(user.userId, householdId);
  
  const existingCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `METADATA`,
    },
  });
  const existing = await db.send(existingCommand);
  const metadata = existing.Items?.[0] || {};
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...metadata,
      categories,
      updatedAt: new Date().toISOString(),
    },
  });

  await db.send(command);
  return true;
}

/**
 * Remove a member from a household (Owner only).
 */
export async function removeMember(idToken: string, householdId: string, targetUserId: string) {
  const user = await verifyToken(idToken);
  await verifyOwner(user.userId, householdId);

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MEMBER#${targetUserId}`,
    },
  });

  await db.send(command);
  return true;
}

/**
 * Change a member's role (Owner only).
 */
export async function changeMemberRole(idToken: string, householdId: string, targetUserId: string, newRole: "OWNER" | "ADMIN" | "MEMBER") {
  const user = await verifyToken(idToken);
  await verifyOwner(user.userId, householdId);

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `HOUSEHOLD#${householdId}`,
      SK: `MEMBER#${targetUserId}`,
      GSI1PK: `USER#${targetUserId}`,
      GSI1SK: `HOUSEHOLD#${householdId}`,
      userId: targetUserId,
      householdId,
      role: newRole,
      joinedAt: new Date().toISOString(),
    },
  });

  await db.send(command);
  return true;
}

/**
 * Update personal budget for the user in a household.
 */
export async function updateMemberBudget(idToken: string, householdId: string, budget: number) {
  const user = await verifyToken(idToken);
  
  // Need to read-modify-write since we don't want to overwrite other fields
  const getCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `MEMBER#${user.userId}`,
    },
  });
  const existing = await db.send(getCommand);
  if (!existing.Items || existing.Items.length === 0) throw new Error("Not a member");

  const memberData = existing.Items[0];
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...memberData,
      budget,
    },
  });

  await db.send(command);
  return true;
}

/**
 * Update the user's display name within a household.
 */
export async function updateMemberName(idToken: string, householdId: string, userName: string) {
  const user = await verifyToken(idToken);
  
  const getCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `MEMBER#${user.userId}`,
    },
  });
  const existing = await db.send(getCommand);
  if (!existing.Items || existing.Items.length === 0) throw new Error("Not a member");

  const memberData = existing.Items[0];
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...memberData,
      userName,
    },
  });

  await db.send(command);
  return true;
}

/**
 * Update individual category-level budgets for a specific member
 */
export async function updateCategoryBudgets(idToken: string, householdId: string, categoryBudgets: Record<string, number>) {
  const user = await verifyToken(idToken);
  
  const existingCommand = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": `HOUSEHOLD#${householdId}`,
      ":sk": `MEMBER#${user.userId}`,
    },
  });
  const existing = await db.send(existingCommand);
  if (!existing.Items || existing.Items.length === 0) throw new Error("Member not found");

  const memberData = existing.Items[0];
  
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ...memberData,
      categoryBudgets,
    },
  });

  await db.send(command);
  return true;
}
