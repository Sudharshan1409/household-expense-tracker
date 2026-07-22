# Progress Log

> **[AI SYSTEM INSTRUCTION]**: You MUST continually update this `PROGRESS.md` file and `TASKS.md` after completing ANY major feature or task. Keep the Session Details and Completed Work accurate at all times so state is preserved for future AI instances.

## Session Details
- **Current Phase:** Phase 9 & 11 (Offline & Deployment)
- **Status:** In Progress

## Completed Work
### Phase 0 & 1
- Verified monorepo layout (npm workspaces).
### Phase 1
- Set up Theme Provider for Light/Dark mode via `next-themes`.
- Added custom CSS variables for our financial color theme in `globals.css` (primary indigo).
- Created a responsive layout component (`layout.tsx`).
- Created navigation components: `Sidebar`, `BottomNav`, and `FAB`.
- Scaffoloded UI components: `KPICard`, `EmptyState`.
- Created placeholder routes for `transactions`, `reports`, and `settings`.
- Built the `Home` dashboard structure.
### Phase 2 — Authentication & Household (Complete)
- **AWS CDK Infrastructure**: Deployed Cognito User Pool and DynamoDB `HouseholdFinance` table.
- **Authentication Flow**: Implemented Google Sign-In using `aws-amplify/auth` and ID Token payload extraction.
- **Route Protection**: Created `AuthGuard` to protect internal routes (bypassing `/invite` and `/onboarding` as needed).
- **Household Management**: Built `/households` page for users to view, create, leave, and delete households.
- **Database Connection**: Linked Server Actions directly to DynamoDB to create and fetch Household metadata.
- **Invite System**: Built `/invite/[id]` route to parse invite links and append users to existing Households as `MEMBER`.
- Added required "Monthly Budget" parameter when creating or joining households.

### Phase 3 & 4 — Transactions & Dashboard
- Created `AddExpenseModal` with support for personal and shared expenses.
- Implemented robust Bill Split Engine (EQUAL, PERCENTAGE, EXACT).
- Added `TransactionDetailsModal` to view precise breakdowns of who paid what.
- Updated Dashboard KPIs (Total Spend, My Spend, Shared Spend, Budget Remaining).
- Implemented Month filtering using IST (Indian Standard Time) across Dashboard and Transactions pages.
- Built individual settings page (`/settings`) to update user Display Name.

### Phase 5, 6, 7 & 10 — Advanced Analytics & Features
- **Individual Category Budgets (Phase 5)**: Created `/budgets` page allowing users to set personal limits per category and visual tracking (Green/Amber/Red) using their individual split amounts.
- **Income & Savings (Phase 5)**: Upgraded `AddExpenseModal` to support "INCOME" vs "EXPENSE", automatically updating the "My Income" dashboard KPI and dynamically calculating monthly surplus/deficit.
- **Advanced Reports (Phase 6)**: Built `/reports` page utilizing `recharts` for individualized Category Donut Charts, "Who Paid for My Expenses" Donut Charts, and Daily Spending Trend bar charts.
- **Smart Templates (Phase 7)**: Built `/recurring` page where users can define common templates (e.g. Rent, Netflix) and post them directly to the database with 1-click.
- **Data Export (Phase 10)**: Added `Export CSV` functionality directly to the Reports page to download the exact transaction ledger for offline records.

## Next Steps for Hand-off
1. Consider AWS CDK upgrades for Receipt Photo uploads (S3).
2. Look into true PWA / Offline capabilities using Service Workers (Phase 9).
