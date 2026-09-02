#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Prod Stack (keeps the original name to avoid breaking existing resources)
new InfraStack(app, 'InfraStack', {
  envName: 'prod'
});

// Dev Stack
new InfraStack(app, 'InfraStack-Dev', {
  envName: 'dev'
});
