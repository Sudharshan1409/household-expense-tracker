import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "HouseholdFinance";

async function run() {
  const allTxs = [];
  let lastEvaluatedKey;

  do {
    const res = await db.send(new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    allTxs.push(...res.Items);
    lastEvaluatedKey = res.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Scanned ${allTxs.length} total items.`);

  const txs = allTxs.filter(item => item.SK && item.SK.startsWith("TRANSACTION#") && item.date && item.amount !== undefined);
  console.log(`Found ${txs.length} transactions.`);

  const summaries = {};

  txs.forEach(tx => {
    const householdId = tx.PK;
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!summaries[householdId]) summaries[householdId] = {};
    if (!summaries[householdId][monthKey]) summaries[householdId][monthKey] = { users: {} };

    const monthData = summaries[householdId][monthKey];

    const isIncome = tx.transactionType === "INCOME";

    if (tx.splits && Object.keys(tx.splits).length > 0) {
      for (const [uid, amt] of Object.entries(tx.splits)) {
        if (!monthData.users[uid]) monthData.users[uid] = { income: 0, spend: 0 };
        if (isIncome) {
          monthData.users[uid].income += amt;
        } else {
          monthData.users[uid].spend += amt;
        }
      }
    } else {
      const uid = tx.paidBy;
      if (!monthData.users[uid]) monthData.users[uid] = { income: 0, spend: 0 };
      if (isIncome) {
        monthData.users[uid].income += tx.amount;
      } else {
        monthData.users[uid].spend += tx.amount;
      }
    }
  });

  // Write to DB
  let count = 0;
  for (const [householdId, months] of Object.entries(summaries)) {
    for (const [monthKey, data] of Object.entries(months)) {
      await db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: householdId,
          SK: `MONTHLY_SUMMARY#${monthKey}`,
          type: "MONTHLY_SUMMARY",
          month: monthKey,
          users: data.users
        }
      }));
      console.log(`Put MONTHLY_SUMMARY for ${householdId} / ${monthKey}`);
      count++;
    }
  }

  console.log(`Successfully backfilled ${count} monthly summaries.`);
}

run().catch(console.error);
