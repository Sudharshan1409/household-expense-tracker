const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-south-1" });
const db = DynamoDBDocumentClient.from(client);

async function run() {
  const scan = new ScanCommand({
    TableName: "HouseholdFinance",
    FilterExpression: "begins_with(PK, :pk) AND SK = :sk",
    ExpressionAttributeValues: {
      ":pk": "HOUSEHOLD#",
      ":sk": "METADATA"
    }
  });
  
  const res = await db.send(scan);
  for (const item of res.Items || []) {
    console.log(`Clearing addedSavings for ${item.PK}...`);
    item.addedSavings = 0;
    await db.send(new PutCommand({
      TableName: "HouseholdFinance",
      Item: item
    }));
  }
  console.log("Done.");
}

run().catch(console.error);
