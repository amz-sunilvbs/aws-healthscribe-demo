#!/bin/bash

# Frontend Zip Deployment Script
# Mimics the original zip artifact deployment approach

set -e

ENVIRONMENT=${1:-dev}
DEPLOYMENT_METHOD=${2:-s3-zip}

echo "📦 Deploying Frontend via Zip Artifacts"
echo "Environment: $ENVIRONMENT"
echo "Method: $DEPLOYMENT_METHOD"
echo ""

# Build the frontend
echo "🔨 Building frontend..."
yarn install
yarn build

# Create deployment zip
echo "📦 Creating deployment zip..."
cd build
zip -r ../frontend-${ENVIRONMENT}.zip .
cd ..

# Deploy based on method
case $DEPLOYMENT_METHOD in
    s3-zip)
        deploy_s3_zip
        ;;
    lambda-zip)
        deploy_lambda_zip
        ;;
    amplify-zip)
        deploy_amplify_zip
        ;;
    *)
        echo "❌ Unknown deployment method: $DEPLOYMENT_METHOD"
        echo "Available methods: s3-zip, lambda-zip, amplify-zip"
        exit 1
        ;;
esac

# Function to deploy to S3 with zip
deploy_s3_zip() {
    echo "🚀 Deploying to S3 as zip artifact..."
    
    BUCKET_NAME="healthscribe-frontend-${ENVIRONMENT}"
    
    # Create bucket if it doesn't exist
    if ! aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
        echo "📦 Creating S3 bucket: ${BUCKET_NAME}"
        aws s3 mb "s3://${BUCKET_NAME}"
        
        # Configure for static website hosting
        aws s3 website "s3://${BUCKET_NAME}" \
            --index-document index.html \
            --error-document error.html
        
        # Set bucket policy for public read
        cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF
        aws s3api put-bucket-policy --bucket "${BUCKET_NAME}" --policy file://bucket-policy.json
        rm bucket-policy.json
    fi
    
    # Upload zip file
    echo "📤 Uploading zip to S3..."
    aws s3 cp "frontend-${ENVIRONMENT}.zip" "s3://${BUCKET_NAME}/frontend-${ENVIRONMENT}.zip"
    
    # Extract zip in S3 (using Lambda or manual extraction)
    echo "📂 Extracting zip contents..."
    aws s3 sync build/ "s3://${BUCKET_NAME}/" --delete
    
    # Get website URL
    WEBSITE_URL="http://${BUCKET_NAME}.s3-website-$(aws configure get region).amazonaws.com"
    echo "✅ Frontend deployed to: ${WEBSITE_URL}"
    
    # Update API URL in deployed files
    update_api_url_in_s3
}

# Function to deploy as Lambda function (for SSR)
deploy_lambda_zip() {
    echo "🚀 Deploying as Lambda function..."
    
    # Create Lambda-compatible package
    mkdir -p lambda-frontend
    cp -r build/* lambda-frontend/
    
    # Create Lambda handler
    cat > lambda-frontend/index.js << 'EOF'
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
    const { path: requestPath = '/' } = event;
    
    let filePath = requestPath === '/' ? '/index.html' : requestPath;
    
    // Handle SPA routing
    if (!filePath.includes('.')) {
        filePath = '/index.html';
    }
    
    try {
        const fullPath = path.join(__dirname, filePath);
        const content = fs.readFileSync(fullPath);
        const ext = path.extname(filePath);
        
        let contentType = 'text/html';
        if (ext === '.js') contentType = 'application/javascript';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.json') contentType = 'application/json';
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000'
            },
            body: content.toString(),
            isBase64Encoded: false
        };
    } catch (error) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Not Found</h1>'
        };
    }
};
EOF
    
    # Create deployment package
    cd lambda-frontend
    zip -r "../frontend-lambda-${ENVIRONMENT}.zip" .
    cd ..
    
    # Deploy Lambda function
    FUNCTION_NAME="HealthScribeFrontend-${ENVIRONMENT}"
    
    if aws lambda get-function --function-name "${FUNCTION_NAME}" 2>/dev/null; then
        echo "📝 Updating existing Lambda function..."
        aws lambda update-function-code \
            --function-name "${FUNCTION_NAME}" \
            --zip-file "fileb://frontend-lambda-${ENVIRONMENT}.zip"
    else
        echo "🆕 Creating new Lambda function..."
        
        # Create execution role
        ROLE_NAME="HealthScribeFrontendRole-${ENVIRONMENT}"
        
        cat > trust-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
        
        aws iam create-role \
            --role-name "${ROLE_NAME}" \
            --assume-role-policy-document file://trust-policy.json || true
        
        aws iam attach-role-policy \
            --role-name "${ROLE_NAME}" \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        # Wait for role to be ready
        sleep 10
        
        ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)
        
        aws lambda create-function \
            --function-name "${FUNCTION_NAME}" \
            --runtime nodejs18.x \
            --role "${ROLE_ARN}" \
            --handler index.handler \
            --zip-file "fileb://frontend-lambda-${ENVIRONMENT}.zip" \
            --timeout 30 \
            --memory-size 512
        
        rm trust-policy.json
    fi
    
    # Create Function URL
    FUNCTION_URL=$(aws lambda create-function-url-config \
        --function-name "${FUNCTION_NAME}" \
        --auth-type NONE \
        --cors '{
            "AllowCredentials": false,
            "AllowHeaders": ["*"],
            "AllowMethods": ["*"],
            "AllowOrigins": ["*"],
            "ExposeHeaders": ["*"],
            "MaxAge": 86400
        }' \
        --query 'FunctionUrl' --output text 2>/dev/null || \
        aws lambda get-function-url-config \
            --function-name "${FUNCTION_NAME}" \
            --query 'FunctionUrl' --output text)
    
    echo "✅ Frontend deployed to Lambda: ${FUNCTION_URL}"
    
    # Cleanup
    rm -rf lambda-frontend
}

# Function to deploy to Amplify with zip
deploy_amplify_zip() {
    echo "🚀 Deploying to Amplify via zip upload..."
    
    # This would integrate with Amplify's deployment API
    # For now, we'll use the manual approach
    
    echo "📤 Uploading build artifacts..."
    
    # Create a deployment in Amplify
    APP_ID=$(aws amplify list-apps --query 'apps[?name==`aws-healthscribe-demo`].appId' --output text)
    
    if [ -n "$APP_ID" ]; then
        echo "📱 Found Amplify app: $APP_ID"
        
        # Create deployment
        DEPLOYMENT_ID=$(aws amplify create-deployment \
            --app-id "$APP_ID" \
            --branch-name main \
            --query 'deploymentId' --output text)
        
        echo "🚀 Created deployment: $DEPLOYMENT_ID"
        
        # Upload zip file
        aws s3 cp "frontend-${ENVIRONMENT}.zip" \
            "s3://amplify-${APP_ID}-deployment/deployments/${DEPLOYMENT_ID}/frontend-${ENVIRONMENT}.zip"
        
        # Start deployment
        aws amplify start-deployment \
            --app-id "$APP_ID" \
            --branch-name main \
            --deployment-id "$DEPLOYMENT_ID"
        
        echo "✅ Amplify deployment started: $DEPLOYMENT_ID"
    else
        echo "❌ Amplify app not found. Please create it first."
        exit 1
    fi
}

# Function to update API URL in deployed files
update_api_url_in_s3() {
    echo "🔧 Updating API URL in deployed files..."
    
    # Get API URL from CDK outputs
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "HealthScribeUserPreferences-${ENVIRONMENT}" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$API_URL" ]; then
        echo "📝 Found API URL: $API_URL"
        
        # Download, update, and re-upload JavaScript files
        aws s3 sync "s3://${BUCKET_NAME}/" temp-download/ --exclude "*" --include "*.js"
        
        # Update API URL in JavaScript files
        find temp-download -name "*.js" -exec sed -i.bak "s|https://[^/]*\.execute-api\.[^/]*\.amazonaws\.com/[^'\"]*|${API_URL}|g" {} \;
        
        # Re-upload updated files
        aws s3 sync temp-download/ "s3://${BUCKET_NAME}/" --exclude "*" --include "*.js"
        
        # Cleanup
        rm -rf temp-download
        
        echo "✅ API URL updated in deployed files"
    else
        echo "⚠️  Could not find API URL. Please update manually."
    fi
}

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f "frontend-${ENVIRONMENT}.zip"
rm -f "frontend-lambda-${ENVIRONMENT}.zip"

echo ""
echo "✅ Frontend deployment completed!"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the deployed frontend"
echo "  2. Verify API integration"
echo "  3. Check that preferences are saved"
