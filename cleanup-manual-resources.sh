#!/bin/bash

echo "🧹 Cleaning up manually created AWS resources..."

# Delete API Gateway
echo "Deleting API Gateway..."
aws apigateway delete-rest-api --rest-api-id apbgiuz1k9 || echo "API Gateway not found or already deleted"

# Delete Lambda function
echo "Deleting Lambda function..."
aws lambda delete-function --function-name UserPreferencesApi || echo "Lambda function not found or already deleted"

# Delete IAM role policies
echo "Deleting IAM role policies..."
aws iam delete-role-policy --role-name UserPreferencesLambdaRole --policy-name DynamoDBAccess || echo "Policy not found"
aws iam detach-role-policy --role-name UserPreferencesLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || echo "Policy not attached"

# Delete IAM role
echo "Deleting IAM role..."
aws iam delete-role --role-name UserPreferencesLambdaRole || echo "Role not found or already deleted"

# Delete DynamoDB table
echo "Deleting DynamoDB table..."
aws dynamodb delete-table --table-name UserPreferences-dev || echo "Table not found or already deleted"

echo "✅ Cleanup completed!"
echo ""
echo "Note: Some resources may take a few minutes to fully delete."
echo "You can verify deletion in the AWS Console."
