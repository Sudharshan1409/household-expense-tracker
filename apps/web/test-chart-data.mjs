import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { subMonths, startOfMonth, addMonths, isBefore, isSameMonth } from "date-fns";

const client = new DynamoDBClient({ region: "ap-south-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "HouseholdFinance";

async function run() {
  const res = await db.send(new ScanCommand({ TableName: TABLE_NAME }));
  const transactions = res.Items.filter(item => item.SK && item.SK.startsWith("TRANSACTION#"));
  
  console.log("Total txs:", transactions.length);
  
  // mock variables
  const currentUserId = transactions[0]?.createdBy || "user1";
  const viewMode = "individual";
  const range = { startDate: subMonths(new Date(), 3) }; // quarterly
  
  const monthlyDataMap = {};
  let cursor = new Date(range.startDate);
  const endCursor = new Date();
  
  while (isBefore(cursor, endCursor) || isSameMonth(cursor, endCursor)) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    monthlyDataMap[monthKey] = { income: 0, spend: 0 };
    cursor = addMonths(cursor, 1);
  }

  transactions.forEach(tx => {
    // only include txs in range
    if (new Date(tx.date) < range.startDate) return;

    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyDataMap[monthKey]) {
      monthlyDataMap[monthKey] = { income: 0, spend: 0 };
    }
    
    const myShare = tx.splits?.[currentUserId] || (tx.paidBy === currentUserId && (!tx.splits || Object.keys(tx.splits).length === 0) ? tx.amount : 0);
    
    if (tx.transactionType === "INCOME") {
      monthlyDataMap[monthKey].income += viewMode === "individual" ? myShare : tx.amount;
    } else {
      monthlyDataMap[monthKey].spend += viewMode === "individual" ? myShare : tx.amount;
    }
  });

  let cumulativeSavings = 0;
  const savingsOverTimeData = Object.entries(monthlyDataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      cumulativeSavings += (data.income - data.spend);
      return {
        month,
        savings: cumulativeSavings,
      };
    });

  console.log("savingsOverTimeData:", savingsOverTimeData);
}
run().catch(console.error);
