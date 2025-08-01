terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "healthscribe"
}

# Local values
locals {
  common_tags = {
    Project     = "HealthScribe"
    Component   = "UserPreferences"
    Environment = var.environment
  }
}

# DynamoDB Table
resource "aws_dynamodb_table" "user_preferences" {
  name           = "UserPreferences-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

# Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "UserPreferencesLambdaRole-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "DynamoDBAccess"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.user_preferences.arn
      }
    ]
  })
}

# Attach basic execution role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function
resource "aws_lambda_function" "user_preferences" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "UserPreferencesApi-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      USER_PREFERENCES_TABLE_NAME = aws_dynamodb_table.user_preferences.name
      REGION                      = var.aws_region
    }
  }

  tags = local.common_tags
}

# API Gateway
resource "aws_api_gateway_rest_api" "user_preferences" {
  name        = "UserPreferencesApi-${var.environment}"
  description = "API for user preferences management"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

# API Gateway Resources
resource "aws_api_gateway_resource" "preferences" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  parent_id   = aws_api_gateway_rest_api.user_preferences.root_resource_id
  path_part   = "preferences"
}

resource "aws_api_gateway_resource" "user_id" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  parent_id   = aws_api_gateway_resource.preferences.id
  path_part   = "{userId}"
}

# API Gateway Method
resource "aws_api_gateway_method" "user_preferences" {
  rest_api_id   = aws_api_gateway_rest_api.user_preferences.id
  resource_id   = aws_api_gateway_resource.user_id.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration
resource "aws_api_gateway_integration" "user_preferences" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  resource_id = aws_api_gateway_resource.user_id.id
  http_method = aws_api_gateway_method.user_preferences.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.user_preferences.invoke_arn
}

# CORS Options Method
resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.user_preferences.id
  resource_id   = aws_api_gateway_resource.user_id.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  resource_id = aws_api_gateway_resource.user_id.id
  http_method = aws_api_gateway_method.options.http_method

  type = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  resource_id = aws_api_gateway_resource.user_id.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  resource_id = aws_api_gateway_resource.user_id.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_preferences.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.user_preferences.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "user_preferences" {
  depends_on = [
    aws_api_gateway_method.user_preferences,
    aws_api_gateway_integration.user_preferences,
    aws_api_gateway_method.options,
    aws_api_gateway_integration.options,
  ]

  rest_api_id = aws_api_gateway_rest_api.user_preferences.id
  stage_name  = "prod"

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.preferences.id,
      aws_api_gateway_resource.user_id.id,
      aws_api_gateway_method.user_preferences.id,
      aws_api_gateway_integration.user_preferences.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Outputs
output "api_url" {
  description = "User Preferences API URL"
  value       = "${aws_api_gateway_deployment.user_preferences.invoke_url}"
}

output "table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.user_preferences.name
}

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.user_preferences.function_name
}
