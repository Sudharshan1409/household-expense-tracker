# Testing Strategy

## Unit tests
Highest priority:
- money minor-unit utilities
- equal split rounding
- percentage/fixed/custom split validation
- settlement/net balance calculations
- budget calculations
- date/month boundary logic

## API integration tests
- authentication required
- membership required
- cross-household access denied
- role restrictions
- CRUD validation
- pagination
- idempotent expense creation

## Frontend tests
- expense form
- split editor
- dashboard filter state
- budget state
- critical empty/error/loading states

## E2E
Critical paths:
1. sign up/login
2. create household
3. invite second account
4. second account joins
5. both add expenses
6. both see shared data
7. split math is correct
8. dashboard updates
9. settlement is recorded
10. export authorized household data

## Accessibility
Automated checks plus keyboard/manual verification.

## Performance
Measure:
- initial dashboard load
- transaction list pagination
- chart rendering
- Lambda latency/cold starts
- DynamoDB consumed capacity patterns

## Security tests
Explicit tests that User A cannot read/write Household B data.
