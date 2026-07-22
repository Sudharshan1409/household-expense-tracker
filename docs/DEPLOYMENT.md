# Deployment

## Frontend
Vercel:
- production branch deployment
- preview deployments
- environment variables per environment

## Backend
AWS CDK:
- API Gateway HTTP API
- Lambda
- DynamoDB
- Cognito
- S3
- IAM
- logs/alarms

## Recommended order
1. Bootstrap CDK environment.
2. Deploy backend dev stack.
3. Configure frontend environment.
4. Deploy Vercel preview/dev.
5. Run smoke/E2E tests.
6. Deploy production stack.
7. Deploy production frontend.

## Domains/CORS
Explicitly configure allowed frontend origins.
Use HTTPS only.

## Database
On-demand capacity initially.
Enable point-in-time recovery if cost/requirements justify it.
Review current AWS pricing before enabling optional paid features.

## S3
Private bucket.
Lifecycle temporary exports.
Receipt retention follows household data policy.

## Monitoring
- Lambda error alarms
- API 5xx monitoring
- throttling
- structured logs
- reasonable retention

## Free/low-cost note
Do not assume “free forever.”
AWS and Vercel pricing/free-tier terms change. Before production deployment, verify current official pricing and configure budgets/alerts to avoid surprises.

## Cost protection
Create AWS Budget alerts.
Avoid provisioned always-on resources unless needed.
