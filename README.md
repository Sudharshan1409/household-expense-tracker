# Household Expense Tracker

A mobile-first, multi-user household finance application for couples and families.

## Product goal
Make recording an expense take under 15 seconds while giving every household member a clear view of:
- what the household spent,
- who paid,
- who actually consumed/bears the expense,
- budgets and savings,
- recurring costs,
- settlements,
- trends and reports.

## Source of truth
Read these documents before implementation:
1. `docs/PROJECT_SPEC.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATABASE.md`
4. `docs/API_SPEC.md`
5. `docs/UI_GUIDELINES.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/USER_FLOWS.md`
8. `docs/FEATURES.md`
9. `docs/SECURITY.md`
10. `docs/TESTING.md`
11. `docs/DEPLOYMENT.md`
12. `docs/ROADMAP.md`
13. `TASKS.md`

If documents conflict, `docs/PROJECT_SPEC.md` wins unless a later architecture decision is explicitly documented.

## Preferred stack
### Frontend
- Next.js 15+ App Router
- React 19+
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Recharts
- Framer Motion / Motion
- Lucide icons
- PWA capabilities

### Backend
- AWS API Gateway HTTP API
- AWS Lambda (Node.js/TypeScript)
- Amazon DynamoDB, single-table design
- Amazon Cognito
- Amazon S3 for receipts/exports
- AWS CDK v2 in TypeScript

### Hosting
- Vercel for Next.js frontend
- AWS serverless backend

## Important architectural rules
- Household is the tenant/security boundary.
- Each person has a separate account.
- Users can create/join households.
- Never confuse `paid amount` with `actual share`.
- Never use DynamoDB Scan for normal application access patterns.
- All authorization must be enforced server-side.
- Monetary values are stored as integer minor units (paise for INR), never floating point.
- Dates/times are stored in ISO-8601/UTC; household timezone is used for reporting.
- Keep AWS usage compatible with low-cost/free-tier-oriented personal usage where practical.

## Start development
Give your coding AI the prompt in `AI_START_PROMPT.md`.
