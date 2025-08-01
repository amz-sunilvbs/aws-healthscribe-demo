#!/bin/bash

# AWS HealthScribe Demo - Local Development Setup Script
# This script helps set up local development environment variables

set -e

echo "🏗️  AWS HealthScribe Demo - Local Development Setup"
echo "=================================================="

# Check if CDK is available
if ! command -v cdk &> /dev/null; then
    echo "❌ CDK CLI not found. Please install it first:"
    echo "   npm install -g aws-cdk"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
    cp .env.local .env.local.backup
fi

echo ""
echo "🔍 Getting CDK stack outputs..."

# Get the current directory for CDK commands
CDK_DIR="infrastructure/cdk"

if [ ! -d "$CDK_DIR" ]; then
    echo "❌ CDK directory not found at $CDK_DIR"
    exit 1
fi

cd "$CDK_DIR"

# Check if stack is deployed
STACK_NAME="HealthScribeFullStack-dev"
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
    echo "❌ Stack $STACK_NAME not found. Please deploy it first:"
    echo "   cd infrastructure/cdk"
    echo "   cdk deploy --context env=dev"
    exit 1
fi

echo "✅ Stack found. Extracting outputs..."

# Get stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' --output text)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`UserFilesBucketName`].OutputValue' --output text)
HEALTHSCRIBE_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`HealthScribeServiceRoleArn`].OutputValue' --output text)
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)

# Get AWS region
AWS_REGION=$(aws configure get region || echo "us-east-1")

cd ../..

# Create .env.local file
cat > .env.local << EOF
# AWS HealthScribe Demo - Local Development Environment Variables
# Generated automatically by setup-local-dev.sh on $(date)

# AWS Region
VITE_AWS_REGION=$AWS_REGION

# Cognito Configuration
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_IDENTITY_POOL_ID=$IDENTITY_POOL_ID

# S3 Configuration
VITE_S3_BUCKET=$S3_BUCKET

# HealthScribe Configuration
VITE_HEALTHSCRIBE_ROLE_ARN=$HEALTHSCRIBE_ROLE_ARN

# API Configuration
VITE_API_URL=$API_URL
EOF

echo ""
echo "✅ Local development environment configured!"
echo ""
echo "📋 Configuration Summary:"
echo "   AWS Region: $AWS_REGION"
echo "   User Pool: $USER_POOL_ID"
echo "   S3 Bucket: $S3_BUCKET"
echo "   API URL: $API_URL"
echo ""
echo "🚀 You can now start local development:"
echo "   npm run dev"
echo ""
echo "📝 Configuration saved to .env.local"
echo "   (This file is ignored by git for security)"
