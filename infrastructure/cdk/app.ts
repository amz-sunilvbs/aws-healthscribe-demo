#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FullStackHealthScribeStack } from './full-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const env = app.node.tryGetContext('env') || 'dev';

new FullStackHealthScribeStack(app, `HealthScribeFullStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'HealthScribe',
    Component: 'FullStack',
    Environment: env,
  },
});
