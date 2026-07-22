# TASKS.md

# Project Tasks

> **[AI SYSTEM INSTRUCTION]**: You MUST continually update this `TASKS.md` file and `PROGRESS.md` after completing ANY major feature or task. Do not wait for the user to prompt you. Check off boxes as they are completed to maintain state across AI instances.

Checkboxes are the implementation source of progress.

## Phase 0 — Foundation & decisions
- [x] Confirm package manager and repository layout
- [x] Initialize Next.js App Router with strict TypeScript
- [x] Configure Tailwind CSS and shadcn/ui
- [x] Configure ESLint/formatting
- [x] Configure environment variable validation
- [x] Create AWS CDK workspace/stacks
- [x] Establish local/dev/prod environment strategy
- [x] Add CI checks: typecheck, lint, tests, build

## Phase 1 — Design system & application shell
- [x] Theme tokens and light/dark mode
- [x] Responsive app shell
- [x] Desktop sidebar
- [x] Mobile bottom navigation
- [x] Floating Add Expense action
- [x] Loading/error/empty states
- [x] Reusable KPI card, chart card, form controls

## Phase 2 — Authentication & household
- [x] Cognito user pool/client
- [x] Sign up/sign in/sign out
- [ ] Password reset
- [x] Protected routes
- [x] Create household
- [x] Household membership model
- [x] Invite member flow
- [x] Accept/reject invitation
- [ ] Owner/Admin/Member authorization
- [x] Household switcher if user belongs to multiple households

## Phase 3 — Core transactions (The engine)
- [x] Basic transaction schema
- [x] `AddExpenseModal` (amount, desc, category, date, payer)
- [x] Basic multi-member split (Equal)
- [x] Custom multi-member split (Percentage, Exact)
- [x] Transaction edit/delete APIs
- [x] Receipt attachment upload
- [ ] Categories/subcategories
- [ ] Payment methods
- [ ] Filters/search/pagination
- [ ] Duplicate warning

## Phase 4 — Dashboard & analytics
- [x] Month selector
- [ ] Household/member filters
- [x] Total Spend card
- [x] My Spend card
- [ ] Member Spend card
- [x] Shared Spend card
- [x] Income card
- [x] Savings card
- [x] Budget Remaining card
- [ ] Previous-period comparison
- [ ] Monthly trend
- [x] Category pie/donut
- [ ] Payment-method chart
- [x] Daily/weekly trends
- [ ] Top 10 expenses
- [ ] Highest spending day
- [ ] Average daily spend

## Phase 5 — Budgets & income
- [x] Household monthly budgets
- [x] Category budgets
- [x] Budget vs actual
- [x] Green/amber/red thresholds
- [x] Income entries
- [x] Savings calculation
- [x] Net cash flow

## Phase 6 — Calendar & reports
- [ ] Monthly spending calendar
- [ ] Day transaction drawer/page
- [x] Monthly report
- [ ] Yearly report
- [x] Category report
- [x] Member report
- [ ] Payment-method report
- [x] Budget report

## Phase 7 — Recurring transactions
- [x] Smart Templates model
- [x] Recurring transaction management

## Phase 8 — Settlements (Skipped)
- [x] Handled by external apps (GPay)



## Phase 9 — PWA & offline
- [x] Web app manifest
- [x] Installability
- [x] Service worker strategy
- [ ] Offline shell
- [ ] Offline expense draft/queue
- [ ] Sync/retry strategy
- [ ] Conflict handling

## Phase 10 — Export
- [x] CSV export
- [ ] XLSX export
- [ ] PDF report export
- [ ] JSON backup/export
- [ ] Date/category/member filters for export

## Phase 11 — Hardening & deployment
- [ ] Unit tests for money/splits/settlements
- [ ] Integration tests for APIs
- [ ] Authorization isolation tests
- [ ] E2E critical flows
- [ ] Accessibility audit
- [ ] Performance audit
- [ ] Security review
- [ ] AWS deployment
- [ ] Vercel deployment
- [ ] Monitoring/logging
- [ ] Backup/recovery documentation
