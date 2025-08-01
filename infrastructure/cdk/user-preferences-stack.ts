import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class UserPreferencesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table for User Preferences
    const userPreferencesTable = new dynamodb.Table(this, 'UserPreferencesTable', {
      tableName: `UserPreferences-${this.stackName}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Lambda function for User Preferences API
    const userPreferencesFunction = new lambda.Function(this, 'UserPreferencesFunction', {
      functionName: `UserPreferencesApi-${this.stackName}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/user-preferences'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        USER_PREFERENCES_TABLE_NAME: userPreferencesTable.tableName,
        REGION: this.region,
      },
    });

    // Grant DynamoDB permissions to Lambda
    userPreferencesTable.grantReadWriteData(userPreferencesFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'UserPreferencesApi', {
      restApiName: `UserPreferencesApi-${this.stackName}`,
      description: 'API for user preferences management',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // API Gateway resources and methods
    const preferencesResource = api.root.addResource('preferences');
    const userResource = preferencesResource.addResource('{userId}');

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(userPreferencesFunction, {
      proxy: true,
    });

    // Add methods
    userResource.addMethod('GET', lambdaIntegration);
    userResource.addMethod('PUT', lambdaIntegration);
    userResource.addMethod('PATCH', lambdaIntegration);
    userResource.addMethod('DELETE', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'User Preferences API URL',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: userPreferencesTable.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: userPreferencesFunction.functionName,
      description: 'Lambda function name',
    });
  }
}
