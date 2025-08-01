#!/bin/bash

# HealthScribe User Preferences Infrastructure Cleanup
# Supports multiple IaC approaches: CDK, CloudFormation, Terraform

set -e

ENVIRONMENT=${1:-dev}
DEPLOYMENT_METHOD=${2:-cdk}

echo "🧹 Cleaning up HealthScribe User Preferences Infrastructure"
echo "Environment: $ENVIRONMENT"
echo "Method: $DEPLOYMENT_METHOD"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup CDK resources
cleanup_cdk() {
    echo "🧹 Cleaning up CDK resources..."
    
    if ! command_exists cdk; then
        echo "❌ AWS CDK not found. Please install CDK first."
        exit 1
    fi
    
    cd infrastructure/cdk
    
    # Destroy CDK stack
    echo "🗑️  Destroying CDK stack..."
    cdk destroy --context env=$ENVIRONMENT --force
    
    cd ../..
}

# Function to cleanup CloudFormation resources
cleanup_cloudformation() {
    echo "🧹 Cleaning up CloudFormation resources..."
    
    STACK_NAME="HealthScribeUserPreferences-$ENVIRONMENT"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME >/dev/null 2>&1; then
        echo "🗑️  Deleting CloudFormation stack..."
        aws cloudformation delete-stack --stack-name $STACK_NAME
        
        echo "⏳ Waiting for stack deletion to complete..."
        aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME
        
        echo "✅ CloudFormation stack deleted successfully!"
    else
        echo "ℹ️  Stack $STACK_NAME not found or already deleted."
    fi
}

# Function to cleanup Terraform resources
cleanup_terraform() {
    echo "🧹 Cleaning up Terraform resources..."
    
    if ! command_exists terraform; then
        echo "❌ Terraform not found. Please install Terraform first."
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Initialize Terraform (in case it's not initialized)
    terraform init
    
    # Destroy resources
    echo "🗑️  Destroying Terraform resources..."
    terraform destroy -var="environment=$ENVIRONMENT" -auto-approve
    
    # Clean up local files
    rm -rf .terraform
    rm -f terraform.tfstate*
    rm -f lambda.zip
    rm -rf lambda
    
    cd ../..
}

# Function to cleanup manual resources (from previous deployment)
cleanup_manual_resources() {
    echo "🧹 Cleaning up any remaining manual resources..."
    
    # Delete API Gateway
    echo "Checking for manual API Gateway..."
    aws apigateway get-rest-apis --query 'items[?name==`UserPreferencesApi`].id' --output text | while read -r api_id; do
        if [ -n "$api_id" ] && [ "$api_id" != "None" ]; then
            echo "Deleting API Gateway: $api_id"
            aws apigateway delete-rest-api --rest-api-id "$api_id" || echo "Failed to delete API Gateway"
        fi
    done
    
    # Delete Lambda function
    echo "Checking for manual Lambda function..."
    aws lambda delete-function --function-name UserPreferencesApi 2>/dev/null || echo "Manual Lambda function not found"
    
    # Delete IAM role policies and role
    echo "Checking for manual IAM role..."
    aws iam delete-role-policy --role-name UserPreferencesLambdaRole --policy-name DynamoDBAccess 2>/dev/null || echo "Manual IAM policy not found"
    aws iam detach-role-policy --role-name UserPreferencesLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || echo "Basic execution policy not attached"
    aws iam delete-role --role-name UserPreferencesLambdaRole 2>/dev/null || echo "Manual IAM role not found"
    
    # Delete DynamoDB table
    echo "Checking for manual DynamoDB table..."
    aws dynamodb delete-table --table-name UserPreferences-dev 2>/dev/null || echo "Manual DynamoDB table not found"
}

# Function to reset frontend configuration
reset_frontend_config() {
    echo "🔧 Resetting frontend configuration..."
    
    # Reset API URL to empty
    sed -i.bak "s|const API_BASE_URL = '.*'|const API_BASE_URL = ''|" src/hooks/useUserPreferences.ts
    
    echo "✅ Frontend configuration reset to use localStorage fallback!"
}

# Confirmation prompt
echo "⚠️  WARNING: This will permanently delete all user preferences infrastructure!"
echo "Environment: $ENVIRONMENT"
echo "Method: $DEPLOYMENT_METHOD"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled."
    exit 1
fi

# Main cleanup logic
case $DEPLOYMENT_METHOD in
    cdk)
        cleanup_cdk
        ;;
    cloudformation|cfn)
        cleanup_cloudformation
        ;;
    terraform|tf)
        cleanup_terraform
        ;;
    manual)
        cleanup_manual_resources
        ;;
    all)
        echo "🧹 Cleaning up ALL deployment methods..."
        cleanup_manual_resources
        cleanup_cdk 2>/dev/null || echo "No CDK resources found"
        cleanup_cloudformation 2>/dev/null || echo "No CloudFormation resources found"
        cleanup_terraform 2>/dev/null || echo "No Terraform resources found"
        ;;
    *)
        echo "❌ Unknown deployment method: $DEPLOYMENT_METHOD"
        echo "Available methods: cdk, cloudformation, terraform, manual, all"
        exit 1
        ;;
esac

# Reset frontend configuration
reset_frontend_config

echo ""
echo "✅ Cleanup completed successfully!"
echo ""
echo "📋 What was cleaned up:"
echo "  - DynamoDB table: UserPreferences-$ENVIRONMENT"
echo "  - Lambda function: UserPreferencesApi-$ENVIRONMENT"
echo "  - API Gateway: UserPreferencesApi-$ENVIRONMENT"
echo "  - IAM roles and policies"
echo "  - Frontend configuration reset"
echo ""
echo "🔧 The application will now use localStorage for preferences."
echo "To redeploy, run: ./deploy-infrastructure.sh $ENVIRONMENT $DEPLOYMENT_METHOD"
