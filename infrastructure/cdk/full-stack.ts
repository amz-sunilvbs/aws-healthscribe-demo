import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class FullStackHealthScribeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // AUTHENTICATION INFRASTRUCTURE
    // ========================================

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `HealthScribeUserPool-${this.stackName}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `HealthScribeUserPoolClient-${this.stackName}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Cognito Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `HealthScribeIdentityPool-${this.stackName}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // ========================================
    // BACKEND INFRASTRUCTURE
    // ========================================

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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // ========================================
    // PATIENT MANAGEMENT INFRASTRUCTURE
    // ========================================

    // DynamoDB Table for Multi-Tenant Patient Management
    const patientsTable = new dynamodb.Table(this, 'PatientsTable', {
      tableName: `NainaHealthScribe-Patients-${this.stackName}`,
      partitionKey: {
        name: 'patientId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI for provider's patients by name (for autosuggest)
    patientsTable.addGlobalSecondaryIndex({
      indexName: 'providerId-patientName-index',
      partitionKey: {
        name: 'providerId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'patientName',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for provider's patients by last encounter date (for recent patients)
    patientsTable.addGlobalSecondaryIndex({
      indexName: 'providerId-lastEncounterDate-index',
      partitionKey: {
        name: 'providerId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastEncounterDate',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // USER PREFERENCES API INFRASTRUCTURE
    // ========================================

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
        PATIENTS_TABLE_NAME: patientsTable.tableName,
        REGION: this.region,
      },
    });

    // Grant DynamoDB permissions to Lambda
    userPreferencesTable.grantReadWriteData(userPreferencesFunction);
    patientsTable.grantReadWriteData(userPreferencesFunction);

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
    const lambdaIntegration = new apigateway.LambdaIntegration(userPreferencesFunction, {
      proxy: true,
    });

    userResource.addMethod('GET', lambdaIntegration);
    userResource.addMethod('PUT', lambdaIntegration);
    userResource.addMethod('PATCH', lambdaIntegration);
    userResource.addMethod('DELETE', lambdaIntegration);

    // ========================================
    // FRONTEND INFRASTRUCTURE
    // ========================================

    // S3 Bucket for Frontend Hosting
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `healthscribe-frontend-${this.stackName.toLowerCase()}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 Bucket for User Files
    const userFilesBucket = new s3.Bucket(this, 'UserFilesBucket', {
      bucketName: `healthscribe-storage-${this.stackName.toLowerCase()}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========================================
    // HEALTHSCRIBE SERVICE ROLE
    // ========================================

    // IAM Role for HealthScribe Service
    const healthScribeServiceRole = new iam.Role(this, 'HealthScribeServiceRole', {
      roleName: `HealthScribeServiceRole-${this.stackName}`,
      assumedBy: new iam.ServicePrincipal('transcribe.amazonaws.com'),
      description: 'Service role for AWS HealthScribe Medical Scribe jobs',
      inlinePolicies: {
        HealthScribeServicePolicy: new iam.PolicyDocument({
          statements: [
            // S3 access for input and output files
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                userFilesBucket.bucketArn,
                `${userFilesBucket.bucketArn}/*`,
              ],
            }),
            // KMS permissions for encryption (if needed)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'kms:ViaService': [`s3.${this.region}.amazonaws.com`],
                },
              },
            }),
          ],
        }),
      },
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${this.stackName}`,
    });

    // Grant CloudFront access to S3 bucket
    frontendBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            // User-specific folder access (Cognito Identity pattern)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                `${userFilesBucket.bucketArn}/uploads/\${cognito-identity.amazonaws.com:sub}/*`,
              ],
            }),
            // HealthScribe Demo folder access (application pattern)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                `${userFilesBucket.bucketArn}/uploads/HealthScribeDemo/*`,
              ],
            }),
            // General uploads folder access for authenticated users
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                `${userFilesBucket.bucketArn}/uploads/*`,
              ],
            }),
            // HealthScribe output files access (job outputs are created in bucket root)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
              ],
              resources: [
                `${userFilesBucket.bucketArn}/*`,
              ],
              conditions: {
                StringLike: {
                  's3:ExistingObjectTag/CreatedBy': 'HealthScribe',
                },
              },
            }),
            // Fallback: Allow read access to all HealthScribe job output patterns
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
              ],
              resources: [
                `${userFilesBucket.bucketArn}/*/transcript.json`,
                `${userFilesBucket.bucketArn}/*/clinical-notes.json`,
                `${userFilesBucket.bucketArn}/*/summary.json`,
                `${userFilesBucket.bucketArn}/*/*-transcript.json`,
                `${userFilesBucket.bucketArn}/*/*-clinical-notes.json`,
                `${userFilesBucket.bucketArn}/*/*-summary.json`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket',
              ],
              resources: [userFilesBucket.bucketArn],
              conditions: {
                StringLike: {
                  's3:prefix': [
                    'uploads/${cognito-identity.amazonaws.com:sub}/*',
                    'uploads/HealthScribeDemo/*',
                    'uploads/*',
                    '*/',
                  ],
                },
              },
            }),
          ],
        }),
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            // Patients table access for multi-tenant operations
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                patientsTable.tableArn,
                `${patientsTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        TranscribeAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'transcribe:StartMedicalScribeJob',
                'transcribe:GetMedicalScribeJob',
                'transcribe:ListMedicalScribeJobs',
                'transcribe:DeleteMedicalScribeJob',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'aws:RequestedRegion': this.region,
                },
              },
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'transcribe:StartTranscriptionJob',
                'transcribe:GetTranscriptionJob',
                'transcribe:ListTranscriptionJobs',
                'transcribe:DeleteTranscriptionJob',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'aws:RequestedRegion': this.region,
                },
              },
            }),
            // PassRole permission for HealthScribe service role
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iam:PassRole',
              ],
              resources: [healthScribeServiceRole.roleArn],
              conditions: {
                StringEquals: {
                  'iam:PassedToService': 'transcribe.amazonaws.com',
                },
              },
            }),
          ],
        }),
        ComprehendMedicalAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'comprehendmedical:DetectEntitiesV2',
                'comprehendmedical:DetectPHI',
                'comprehendmedical:InferICD10CM',
                'comprehendmedical:InferRxNorm',
                'comprehendmedical:InferSNOMEDCT',
              ],
              resources: ['*'],
              conditions: {
                StringEquals: {
                  'aws:RequestedRegion': this.region,
                },
              },
            }),
          ],
        }),
      },
    });

    // Attach roles to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Create Amplify configuration file content
    const amplifyConfig = {
      aws_project_region: this.region,
      aws_cognito_region: this.region,
      aws_user_pools_id: userPool.userPoolId,
      aws_user_pools_web_client_id: userPoolClient.userPoolClientId,
      oauth: {},
      aws_cognito_username_attributes: ['EMAIL'],
      aws_cognito_social_providers: [],
      aws_cognito_signup_attributes: ['EMAIL'],
      aws_cognito_mfa_configuration: 'OFF',
      aws_cognito_mfa_types: ['SMS'],
      aws_cognito_password_protection_settings: {
        passwordPolicyMinLength: 8,
        passwordPolicyCharacters: [],
      },
      aws_cognito_verification_mechanisms: ['EMAIL'],
      aws_user_files_s3_bucket: userFilesBucket.bucketName,
      aws_user_files_s3_bucket_region: this.region,
      aws_cognito_identity_pool_id: identityPool.ref,
      // HealthScribe specific configuration
      healthscribe_service_role_arn: healthScribeServiceRole.roleArn,
      // User Preferences API configuration
      api_url: api.url,
    };

    // Deploy Frontend Build with updated config
    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [
        s3deploy.Source.asset('../../build'),
        s3deploy.Source.jsonData('amplifyconfiguration.json', amplifyConfig),
      ],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ========================================
    // OUTPUTS
    // ========================================

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend URL (CloudFront)',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'User Preferences API URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: userPreferencesTable.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'PatientsTableName', {
      value: patientsTable.tableName,
      description: 'Patients DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'PatientsTableArn', {
      value: patientsTable.tableArn,
      description: 'Patients DynamoDB table ARN',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: userPreferencesFunction.functionName,
      description: 'Lambda function name',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 bucket name',
    });

    new cdk.CfnOutput(this, 'UserFilesBucketName', {
      value: userFilesBucket.bucketName,
      description: 'User files S3 bucket name',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'HealthScribeServiceRoleArn', {
      value: healthScribeServiceRole.roleArn,
      description: 'HealthScribe service role ARN',
    });
  }
}
