# DynamoDB Data Model

## Principles
- Single-table design.
- Query-driven access patterns.
- No normal-path Scan.
- Household is the dominant partition/security boundary.
- Use opaque IDs (UUID/ULID).
- Store monetary values in integer minor units.

## Table
Example name: `HouseholdFinance`.

Generic keys:
- `PK`
- `SK`
- `GSI1PK`
- `GSI1SK`
- optional additional GSIs only when justified by access patterns.

## Representative entities

### User profile
PK: `USER#<userId>`
SK: `PROFILE`

### Household
PK: `HOUSEHOLD#<householdId>`
SK: `META`

### Membership
PK: `HOUSEHOLD#<householdId>`
SK: `MEMBER#<memberId>`

GSI for user's households:
GSI1PK: `USER#<userId>`
GSI1SK: `HOUSEHOLD#<householdId>`

### Invitation
PK: `HOUSEHOLD#<householdId>`
SK: `INVITE#<inviteId>`

A token lookup GSI may be required. Store a hash of sensitive invite tokens rather than relying on plaintext tokens.

### Expense
PK: `HOUSEHOLD#<householdId>`
SK: `EXPENSE#<yyyy-mm-dd>#<expenseId>`

Store:
- amountMinor
- currency
- paidByMemberId
- splitType
- allocations[]
- categoryId
- subcategoryId
- description
- merchant
- paymentMethodId
- tags
- attachment metadata
- createdByUserId
- timestamps

### Category
PK: `HOUSEHOLD#<householdId>`
SK: `CATEGORY#<categoryId>`

### Payment method
PK: `HOUSEHOLD#<householdId>`
SK: `PAYMENT#<paymentMethodId>`

### Budget
PK: `HOUSEHOLD#<householdId>`
SK: `BUDGET#<yyyy-mm>#<category-or-HOUSEHOLD>`

### Income
PK: `HOUSEHOLD#<householdId>`
SK: `INCOME#<yyyy-mm-dd>#<incomeId>`

### Settlement
PK: `HOUSEHOLD#<householdId>`
SK: `SETTLEMENT#<yyyy-mm-dd>#<settlementId>`

### Recurring rule
PK: `HOUSEHOLD#<householdId>`
SK: `RECURRING#<ruleId>`

## Access patterns
Must efficiently support:
1. Get household metadata.
2. List household members.
3. List households for a user.
4. List expenses by household/date range.
5. Get expense by ID (may require deterministic lookup key/GSI or ID mapping).
6. List category/payment-method configuration.
7. Get budgets for a month.
8. List income by date range.
9. List settlements by date range.
10. List recurring rules.
11. Resolve invitation securely.
12. Dashboard analytics for selected period.

## Analytics strategy
Do not assume expensive table-wide queries.
For a small household, date-range expense queries followed by server-side aggregation are acceptable initially.
As data grows, introduce aggregate items such as:
`AGG#MONTH#2026-07`
with category/member/payment breakdowns, updated transactionally/eventually consistently.

Do not prematurely add aggregates before measuring.

## Expense lookup
Because date is in the expense sort key, direct lookup by only expenseId needs a strategy:
- include date in route/reference, OR
- maintain an ID lookup item/GSI.
Choose and document during implementation.

## Concurrency
Use conditional writes for membership/invite/state transitions where races matter.

## Transactions
Use DynamoDB transactions when multiple records must change atomically (e.g., invite acceptance plus membership creation, aggregate updates if strict consistency is required).
