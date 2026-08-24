import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: "ap-south-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "ExpenseTracker-dev";

async function main() {
  const scan = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "begins_with(SK, :sk)",
    ExpressionAttributeValues: {
      ":sk": "MEMBER#"
    }
  });
  
  const res = await db.send(scan);
  for (const item of res.Items || []) {
    if (item.budgetOverrides) {
      console.log(`Found overrides for ${item.PK} / ${item.SK}:`, item.budgetOverrides);
      item.budgetOverrides = {};
      const put = new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      });
      await db.send(put);
      console.log(`Cleared overrides for ${item.PK} / ${item.SK}`);
    }
  }
}

main().catch(console.error);
