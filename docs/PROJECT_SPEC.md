# Product Specification

## 1. Product
A household finance tracker designed initially for a husband and wife with separate accounts, while supporting additional household members later.

Both users independently authenticate and can add/edit household expenses according to their permissions. Changes become visible to the household.

## 2. Core concepts

### User
An authenticated individual with a private account/profile.

### Household
The tenant boundary containing members, expenses, categories, budgets, income, recurring transactions and settlements.

### Membership
Links a user to a household and carries a role:
- Owner
- Admin
- Member

### Expense
A financial transaction paid by one member (initially one payer; architecture may allow multiple payers later) and allocated to one or more beneficiaries.

### Paid vs actual expense
These MUST remain separate.

Example: A pays ₹4,000 groceries and it is split equally between A and B:
- A paid: ₹4,000
- B paid: ₹0
- A actual expense: ₹2,000
- B actual expense: ₹2,000

This distinction drives dashboard metrics and settlements.

## 3. Primary user goals
- Record expenses quickly.
- Know total household spend for any month.
- Know each person's actual spend.
- Know how much each person paid.
- Understand shared vs personal spending.
- Track category and payment-method trends.
- Set and monitor budgets.
- Track income/savings.
- Track recurring bills.
- Know who owes whom.
- Export data.

## 4. Expense fields
Required:
- id
- householdId
- date
- amountMinor
- currency
- paidByMemberId
- beneficiaries/splits
- categoryId
- description
- createdByUserId
- createdAt
- updatedAt

Optional:
- subcategoryId
- merchant
- paymentMethodId
- tags
- notes
- receipt attachment
- location label
- recurringRuleId

## 5. Split types
- Equal
- Percentage
- Fixed amount
- Custom

Validation:
- Allocations must total the expense exactly.
- Percentage totals must equal 100%.
- Rounding must be deterministic and preserve total minor units.
- Never use floating point for currency allocation.

## 6. Dashboard
Global controls:
- Household
- Month
- Year/custom date range where supported
- Member/all household

KPI cards:
- Total household spend
- My actual spend
- Selected member actual spend
- Shared spend
- Amount paid by me
- Amount paid by selected member
- Income
- Savings
- Net cash flow
- Budget remaining
- Budget used %
- Previous-period delta
- Average daily spend
- Highest spending day
- Largest expense

Visualizations:
- Monthly spending trend
- Daily/weekly trend
- Category distribution
- Payment-method distribution
- Member spending
- Shared vs personal
- Budget vs actual
- Top expenses
- Recent transactions

## 7. Expenses UX
Mobile-first quick entry.
Target: common expense in <15 seconds.

Flow:
1. Amount should be prominent.
2. Date defaults to today.
3. Paid By defaults to current member where sensible.
4. Select beneficiaries.
5. Select split.
6. Category.
7. Optional details.
8. Save.

Remember safe user conveniences such as recently used category/payment method, but do not silently infer financial facts.

## 8. Categories
- Household-scoped categories
- Default starter categories
- Custom categories
- Subcategories
- Icon
- UI color token
- Active/hidden
- Merge/archive capability
- Category budget

Suggested defaults:
Housing, Groceries, Dining, Transport, Fuel, Utilities, Shopping, Health, Insurance, Entertainment, Travel, Subscriptions, Education, Gifts, Personal Care, Home, EMI/Debt, Miscellaneous.

## 9. Payment methods
Custom household payment methods:
- UPI
- Cash
- Credit Card
- Debit Card
- Bank Transfer
- Wallet
- Other

Optionally associate a payment method with a member.

## 10. Budgeting
- Monthly household budget
- Monthly category budget
- Actual vs budget
- Remaining amount
- Utilization %
- thresholds:
  - green: comfortably within budget
  - amber: approaching limit
  - red: exceeded

Threshold values should be configurable later; initial defaults may be <80%, 80–100%, >100%.

## 11. Income and savings
Income entries can be associated with a member and household.
Savings for a reporting period = total income - tracked expenses.
Clearly label this as tracker-based cash-flow savings, not bank-account reconciliation.

## 12. Calendar
Month grid.
Each day shows total expense.
Selecting a day shows transactions.
Month navigation updates calendar and totals.

## 13. Recurring expenses
Examples: rent, streaming, internet, insurance, EMI.
Support:
- monthly
- yearly
- weekly
- configurable recurrence where practical
- next occurrence
- active/paused
- reminders

Do not create duplicate actual expenses without an explicit, documented recurrence processing strategy.

## 14. Settlements
Compute each member's net position from paid amounts, allocated shares, and recorded settlements.
Show:
- owes
- is owed
- suggested settlement
- partial settlement
- mark settled
- settlement history

## 15. Search/filtering
Search description/merchant where supported.
Filters:
- date range
- month
- category
- subcategory
- payer
- beneficiary/member
- payment method
- shared/personal
- amount range
- tags

## 16. Export
- CSV
- XLSX
- PDF reports
- JSON backup
Exports must be household-scoped and authorization checked.

## 17. Settings
- Profile
- Household
- Members/invitations
- Categories
- Payment methods
- Currency
- Household timezone
- Theme
- Notifications
- Export/backup
- Account/session management

## 18. Responsive requirements
Mobile is first-class.
- Bottom navigation
- Add-expense FAB
- large touch targets
- drawers/sheets for compact interactions
Desktop:
- sidebar
- wider analytics grids
- tables with richer filters

## 19. PWA
- installable
- responsive
- offline shell
- offline-safe drafts
- queued expense creation may be added with conflict/retry handling

## 20. Non-functional requirements
- Strict tenant isolation
- Fast perceived interactions
- Accessible controls
- Keyboard support on desktop
- No financial floating-point math
- Auditable created/updated metadata
- Idempotency where duplicate writes are risky
- Pagination for lists
- Observability without logging sensitive financial details unnecessarily
