# REST API Specification

Base: `/v1`

All household routes require authentication and validated household membership.

## Auth/session
Authentication is primarily Cognito-driven; frontend obtains tokens and API validates them.

## Households
- `POST /households` — create household
- `GET /households` — list current user's households
- `GET /households/{householdId}` — household detail
- `PATCH /households/{householdId}` — update household
- `GET /households/{householdId}/members`
- `POST /households/{householdId}/invites`
- `GET /households/{householdId}/invites`
- `DELETE /households/{householdId}/invites/{inviteId}`
- `POST /invites/{token}/accept`
- `POST /invites/{token}/reject`
- `PATCH /households/{householdId}/members/{memberId}` — role/profile settings
- `DELETE /households/{householdId}/members/{memberId}`

## Expenses
- `POST /households/{householdId}/expenses`
- `GET /households/{householdId}/expenses`
- `GET /households/{householdId}/expenses/{expenseId}`
- `PATCH /households/{householdId}/expenses/{expenseId}`
- `DELETE /households/{householdId}/expenses/{expenseId}`

List query parameters may include:
`from`, `to`, `categoryId`, `memberId`, `paidBy`, `paymentMethodId`, `shared`, `minAmount`, `maxAmount`, `cursor`, `limit`.

## Dashboard
- `GET /households/{householdId}/dashboard?month=YYYY-MM&memberId=...`
Returns KPI and chart-ready aggregates.

## Categories
CRUD under `/households/{householdId}/categories`.

## Payment methods
CRUD under `/households/{householdId}/payment-methods`.

## Budgets
- `GET /households/{householdId}/budgets?month=YYYY-MM`
- `PUT /households/{householdId}/budgets/{budgetId}`
- `DELETE ...`

## Income
CRUD under `/households/{householdId}/income`.

## Recurring
CRUD under `/households/{householdId}/recurring`.

## Settlements
- `GET /households/{householdId}/balances`
- `GET /households/{householdId}/settlements`
- `POST /households/{householdId}/settlements`

## Calendar
- `GET /households/{householdId}/calendar?month=YYYY-MM`

## Reports
- `GET /households/{householdId}/reports/monthly?month=...`
- `GET /households/{householdId}/reports/yearly?year=...`
- category/member/payment/budget report endpoints as needed.

## Exports
- `POST /households/{householdId}/exports`
Body includes format and filters.
Large exports may be asynchronous and delivered through a short-lived signed S3 URL.

## Attachments
Prefer presigned upload flow:
1. request upload authorization,
2. upload directly to S3,
3. attach validated object metadata to expense.

## Validation
Use Zod at API boundaries.
Reject:
- negative/invalid money
- invalid split totals
- nonexistent/unauthorized members
- cross-household entity IDs
- invalid dates
- excessive text/file sizes

## Pagination
Cursor-based, not offset-based.

## Authorization
Owner/Admin/Member permissions must be centrally defined. Editing/deleting another member's transaction is a product-policy decision; default recommendation is household members can view all, while destructive administrative actions require elevated permission. Final rules must be documented before implementation.
