import * as cdk from '@aws-cdk/core';
import { CartApiStack } from '../lib/cart-api-stack';

const app = new cdk.App();

const stackName = 'CartApiStack';
const environment = {
  region: process.env.AWS_REGION || 'us-east-1',
  account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
};

new CartApiStack(app, stackName, {
  env: environment as cdk.Environment,
  stackName,
  description: 'Cart API Stack with Lambda and RDS',
});

app.synth();

