# Security

## Tenant isolation
Household is the authorization boundary.
For every household operation:
1. derive authenticated user identity from validated token,
2. resolve membership,
3. verify required role,
4. then access data.

Never trust a client-provided member/user identity for authorization.

## Authentication
Use Cognito.
- secure token handling
- short-lived access tokens
- refresh strategy
- logout/revocation behavior
- MFA can be added/configured later

## API
- validate inputs
- restrict CORS to expected origins
- rate-limit/throttle appropriately
- do not expose stack traces
- use least-privilege IAM per Lambda

## DynamoDB
IAM permissions scoped to required table/index actions.
Application authorization still required; IAM alone does not enforce household membership.

## S3 receipts
Private bucket.
Block public access.
Presigned URLs with short expiry.
Validate file type/size.
Use randomized object keys.
Do not trust filename/content-type alone.

## Secrets
Never commit secrets.
Use environment configuration/secret services as appropriate.

## Logging
Do not log:
- passwords
- raw auth tokens
- sensitive receipt content
- unnecessary full financial payloads

## Exports
Authorize before generating.
Use short-lived download URLs.
Consider expiry/lifecycle deletion.

## Privacy
Users should be able to export their household data.
Account/household deletion flows require deliberate product rules and safe deletion strategy.

## Dependency/security hygiene
- dependency updates
- lockfile
- CI vulnerability checks where practical
- security headers
- CSP strategy compatible with app requirements
