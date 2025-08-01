#!/bin/bash

# HealthScribe Infrastructure Deployment
# Supports multiple IaC approaches and frontend deployment options

set -e

ENVIRONMENT=${1:-dev}
DEPLOYMENT_METHOD=${2:-cdk}
INCLUDE_FRONTEND=${3:-false}

echo "🚀 Deploying HealthScribe Infrastructure"
echo "Environment: $ENVIRONMENT"
echo "Method: $DEPLOYMENT_METHOD"
echo "Include Frontend: $INCLUDE_FRONTEND"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to build frontend
build_frontend() {
    if [ "$INCLUDE_FRONTEND" = "true" ] || [ "$INCLUDE_FRONTEND" = "yes" ]; then
        echo "🔨 Building frontend..."
        yarn install
        yarn build
        echo "✅ Frontend build completed"
    fi
}

# Function to deploy with CDK
deploy_cdk() {
    echo "📦 Deploying with AWS CDK..."
    
    if ! command_exists cdk; then
        echo "❌ AWS CDK not found. Installing..."
        npm install -g aws-cdk
    fi
    
    cd infrastructure/cdk
    
    # Install dependencies
    echo "📦 Installing CDK dependencies..."
    npm install
    
    # Bootstrap CDK (if needed)
    echo "🔧 Bootstrapping CDK..."
    cdk bootstrap || echo "CDK already bootstrapped"
    
    # Choose stack based on frontend inclusion
    if [ "$INCLUDE_FRONTEND" = "true" ] || [ "$INCLUDE_FRONTEND" = "yes" ]; then
        echo "🚀 Deploying full-stack CDK (backend + frontend)..."
        # Build frontend first
        cd ../..
        build_frontend
        cd infrastructure/cdk
        
        # Deploy full stack (if implemented)
        if [ -f "full-stack.ts" ]; then
            cdk deploy FullStackHealthScribe-$ENVIRONMENT --context env=$ENVIRONMENT --require-approval never
        else
            echo "⚠️  Full-stack deployment not implemented. Deploying backend only..."
            cdk deploy --context env=$ENVIRONMENT --require-approval never
        fi
    else
        echo "🚀 Deploying backend-only CDK stack..."
        cdk deploy --context env=$ENVIRONMENT --require-approval never
    fi
    
    cd ../..
}

# Function to deploy with CloudFormation
deploy_cloudformation() {
    echo "📦 Deploying with CloudFormation..."
    
    STACK_NAME="HealthScribeUserPreferences-$ENVIRONMENT"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME >/dev/null 2>&1; then
        echo "📝 Updating existing stack..."
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://infrastructure/cloudformation/user-preferences.yaml \
            --parameters ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
            --capabilities CAPABILITY_NAMED_IAM
        
        aws cloudformation wait stack-update-complete --stack-name $STACK_NAME
    else
        echo "🆕 Creating new stack..."
        aws cloudformation create-stack \
            --stack-name $STACK_NAME \
            --template-body file://infrastructure/cloudformation/user-preferences.yaml \
            --parameters ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
            --capabilities CAPABILITY_NAMED_IAM
        
        aws cloudformation wait stack-create-complete --stack-name $STACK_NAME
    fi
    
    # Get outputs
    echo "📋 Stack outputs:"
    aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs'
    
    # Deploy frontend if requested
    if [ "$INCLUDE_FRONTEND" = "true" ] || [ "$INCLUDE_FRONTEND" = "yes" ]; then
        echo "🌐 Deploying frontend..."
        ./deploy-frontend-zip.sh $ENVIRONMENT s3-zip
    fi
}

# Function to deploy with Terraform
deploy_terraform() {
    echo "📦 Deploying with Terraform..."
    
    if ! command_exists terraform; then
        echo "❌ Terraform not found. Please install Terraform first."
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Copy Lambda function
    cp -r ../cdk/lambda .
    
    # Initialize Terraform
    echo "🔧 Initializing Terraform..."
    terraform init
    
    # Plan
    echo "📋 Planning Terraform deployment..."
    terraform plan -var="environment=$ENVIRONMENT"
    
    # Apply
    echo "🚀 Applying Terraform configuration..."
    terraform apply -var="environment=$ENVIRONMENT" -auto-approve
    
    # Show outputs
    echo "📋 Terraform outputs:"
    terraform output
    
    cd ../..
    
    # Deploy frontend if requested
    if [ "$INCLUDE_FRONTEND" = "true" ] || [ "$INCLUDE_FRONTEND" = "yes" ]; then
        echo "🌐 Deploying frontend..."
        ./deploy-frontend-zip.sh $ENVIRONMENT s3-zip
    fi
}

# Function to update frontend configuration
update_frontend_config() {
    echo "🔧 Updating frontend configuration..."
    
    # Get API URL based on deployment method
    case $DEPLOYMENT_METHOD in
        cdk)
            API_URL=$(cd infrastructure/cdk && cdk output --context env=$ENVIRONMENT 2>/dev/null | grep ApiUrl | cut -d' ' -f2 || echo "")
            ;;
        cloudformation)
            API_URL=$(aws cloudformation describe-stacks --stack-name "HealthScribeUserPreferences-$ENVIRONMENT" --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
            ;;
        terraform)
            API_URL=$(cd infrastructure/terraform && terraform output -raw api_url 2>/dev/null || echo "")
            ;;
    esac
    
    if [ -n "$API_URL" ]; then
        echo "📝 Updating API URL in frontend: $API_URL"
        
        # Update the useUserPreferences hook
        sed -i.bak "s|const API_BASE_URL = '.*'|const API_BASE_URL = '$API_URL'|" src/hooks/useUserPreferences.ts
        
        echo "✅ Frontend configuration updated!"
    else
        echo "⚠️  Could not retrieve API URL. Please update manually."
    fi
}

# Main deployment logic
case $DEPLOYMENT_METHOD in
    cdk|cdk-full)
        if [ "$DEPLOYMENT_METHOD" = "cdk-full" ]; then
            INCLUDE_FRONTEND="true"
        fi
        deploy_cdk
        ;;
    cloudformation|cfn)
        deploy_cloudformation
        ;;
    terraform|tf)
        deploy_terraform
        ;;
    frontend-only)
        echo "🌐 Deploying frontend only..."
        ./deploy-frontend-zip.sh $ENVIRONMENT s3-zip
        exit 0
        ;;
    *)
        echo "❌ Unknown deployment method: $DEPLOYMENT_METHOD"
        echo "Available methods:"
        echo "  - cdk: Backend only with CDK"
        echo "  - cdk-full: Backend + Frontend with CDK"
        echo "  - cloudformation: Backend with CloudFormation"
        echo "  - terraform: Backend with Terraform"
        echo "  - frontend-only: Frontend deployment only"
        echo ""
        echo "Usage examples:"
        echo "  ./deploy-infrastructure.sh dev cdk"
        echo "  ./deploy-infrastructure.sh dev cdk-full"
        echo "  ./deploy-infrastructure.sh dev cloudformation true"
        echo "  ./deploy-infrastructure.sh dev frontend-only"
        exit 1
        ;;
esac

# Update frontend configuration
update_frontend_config

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 What was deployed:"
if [ "$INCLUDE_FRONTEND" = "true" ] || [ "$INCLUDE_FRONTEND" = "yes" ] || [ "$DEPLOYMENT_METHOD" = "cdk-full" ]; then
    echo "  - Frontend: Static website (S3 + CloudFront or Amplify)"
fi
echo "  - DynamoDB table: UserPreferences-$ENVIRONMENT"
echo "  - Lambda function: UserPreferencesApi-$ENVIRONMENT"
echo "  - API Gateway: UserPreferencesApi-$ENVIRONMENT"
echo "  - IAM roles and policies"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the Settings page"
echo "  2. Verify preferences are saved to DynamoDB"
echo "  3. Check that note templates work in New Encounter"
echo ""
echo "🧹 To clean up resources, run:"
echo "  ./cleanup-infrastructure.sh $ENVIRONMENT $DEPLOYMENT_METHOD"
