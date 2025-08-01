#!/bin/bash

# Deploy User Preferences Infrastructure
# This script follows the existing Amplify pattern

echo "🚀 Deploying User Preferences Infrastructure..."

# Check if we're in the right directory
if [ ! -f "amplify.yml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Amplify CLI is installed
if ! command -v amplify &> /dev/null; then
    echo "❌ Error: Amplify CLI is not installed"
    echo "Please install it with: npm install -g @aws-amplify/cli"
    exit 1
fi

# Install dependencies for custom CDK resource
echo "📦 Installing CDK dependencies..."
cd amplify/backend/custom/userPreferencesTable
npm install
cd ../../../../

# Install dependencies for Lambda function
echo "📦 Installing Lambda dependencies..."
cd amplify/backend/function/userPreferencesApi/src
npm install
cd ../../../../../

# Deploy the infrastructure
echo "🏗️ Deploying infrastructure with Amplify..."
amplify push --yes

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ User Preferences infrastructure deployed successfully!"
    echo ""
    echo "📋 What was deployed:"
    echo "  - DynamoDB table: UserPreferences"
    echo "  - Lambda function: userPreferencesApi"
    echo "  - API Gateway: userPreferencesApi"
    echo "  - IAM roles and policies"
    echo ""
    echo "🔧 Next steps:"
    echo "  1. Update your frontend environment variables"
    echo "  2. Test the Settings page"
    echo "  3. Verify preferences are saved to DynamoDB"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
