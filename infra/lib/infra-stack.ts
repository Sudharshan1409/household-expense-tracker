import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface InfraStackProps extends cdk.StackProps {
  envName: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const isProd = props.envName === 'prod';
    const tableName = isProd ? 'HouseholdFinance' : `HouseholdFinance-${props.envName}`;

    // 1. DynamoDB Table
    const table = new dynamodb.Table(this, 'HouseholdFinanceTable', {
      tableName: tableName,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY, 
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. Cognito User Pool
    const userPool = new cognito.UserPool(this, 'HouseholdExpenseUserPool', {
      userPoolName: `HouseholdExpenseUserPool-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // 3. Google Identity Provider
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!googleClientId || !googleClientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
    }

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: googleClientId,
      clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret), 
      scopes: ['profile', 'email', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    // 4. User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      userPoolClientName: `WebClient-${props.envName}`,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        callbackUrls: ['http://localhost:3000/', 'https://household-expense-tracker-web.vercel.app/'], 
        logoutUrls: ['http://localhost:3000/', 'https://household-expense-tracker-web.vercel.app/'],
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
    });

    userPoolClient.node.addDependency(googleProvider);

    // 5. User Pool Domain
    const domainPrefix = isProd
      ? `household-expense-tracker-dev-157943428055`
      : `household-expense-tracker-local-157943428055`;
    const userPoolDomain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });

    // 6. S3 Bucket for Receipts
    const receiptBucket = new s3.Bucket(this, 'ReceiptBucket', {
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'], 
          allowedHeaders: ['*'],
        },
      ],
    });

    // 7. Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoDomain', { value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com` });
    new cdk.CfnOutput(this, 'DynamoDbTableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'ReceiptBucketName', { value: receiptBucket.bucketName });
  }
}
