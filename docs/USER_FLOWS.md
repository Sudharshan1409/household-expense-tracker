# User Flows

## New household
Sign up -> verify/login -> create household -> choose currency/timezone -> create starter categories/payment methods -> dashboard.

## Join household
Sign up/login -> open invite -> validate invite -> preview household -> accept -> membership created -> dashboard.

## Add shared expense
Tap Add -> amount -> payer -> beneficiaries -> equal/custom split -> category -> payment method -> description -> save -> dashboard/list invalidate/refetch.

## Add personal expense
Tap Add -> amount -> beneficiary=self -> payer=self (or chosen member) -> category -> save.

## Review month
Home -> month selector -> dashboard updates -> tap KPI/chart segment -> filtered transactions.

## Set budget
Budget -> month -> household/category -> amount -> save -> dashboard budget card updates.

## Settle balance
Balances -> see “X owes Y” -> settle -> amount/date/payment note -> confirm -> balance recalculates.

## Recurring bill
Recurring -> add -> amount/category/payer/split -> recurrence -> next date -> reminder -> save.

## Receipt
Add/edit expense -> attach receipt -> request presigned upload -> upload -> save metadata -> secure retrieval.

## Offline expense
Offline -> add expense -> save locally with idempotency key -> UI marks pending -> reconnect -> sync -> success or conflict state.
