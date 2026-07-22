# Architecture

## High-level
Browser/PWA -> Next.js frontend (Vercel) -> API Gateway HTTP API -> Lambda services -> DynamoDB
                                                            -> S3 (receipts/exports)
Authentication uses Amazon Cognito.

Infrastructure is defined with AWS CDK v2 TypeScript.

## Repository recommendation
A monorepo is preferred:

- `apps/web` — Next.js
- `apps/api` or `services/api` — Lambda handlers/use-cases
- `infra` — CDK
- `packages/domain` — shared domain types/calculation logic
- `packages/validation` — schemas where sharing is appropriate
- `packages/config` — shared tooling/config

Do not force sharing of browser/server code if it creates bundling or security problems.

## Frontend layers
- app routes/layouts
- feature modules
- UI components/design system
- API client/query hooks
- domain formatting/calculation helpers
- auth/session integration

Use server/client components deliberately. Interactive dashboard/chart/form features are client-side where needed.

## Backend layers
Lambda entrypoint -> authentication/authorization -> validation -> use case -> repository/data access -> response mapper.

Business calculations (splits/settlements) should be pure functions where possible.

## API style
REST over API Gateway HTTP API.
Version under `/v1`.

## Authentication
Cognito issues tokens.
API validates identity.
Backend resolves user -> household membership.
Never authorize solely because a client supplied `householdId`.

Google/social sign-in is optional after core email authentication unless configured through Cognito federation.

## Cost philosophy
Optimize for a personal/household workload:
- serverless
- on-demand DynamoDB
- HTTP API rather than REST API
- modest CloudWatch retention
- avoid always-on compute
- S3 lifecycle policies
Actual AWS/Vercel pricing/free-tier eligibility changes over time; deployment docs must verify current pricing before launch.

## Environments
- local
- dev
- prod

Prefer separate stacks and resource names. For stronger isolation, separate AWS accounts can be adopted later.

## Observability
- structured logs
- request/correlation IDs
- CloudWatch metrics/alarms for Lambda errors/throttles
- avoid raw tokens, passwords, receipt contents or unnecessary financial payloads in logs

## Error model
Consistent API envelope:
- code
- message
- optional fieldErrors
- requestId

## Idempotency
Expense creation should support an idempotency key, especially for offline retry.
