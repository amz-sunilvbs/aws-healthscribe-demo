# HealthScribe Infrastructure

This directory contains Infrastructure as Code (IaC) templates for deploying the complete HealthScribe application including user preferences and patient management systems.

## 🏗️ Architecture

The infrastructure consists of:

- **Authentication**: Cognito User Pool and Identity Pool
- **Storage**: S3 buckets for frontend and user files
- **CDN**: CloudFront distribution for global content delivery
- **API**: API Gateway with Lambda functions
- **Database**: DynamoDB tables for user preferences and patient management
- **Security**: IAM roles and policies for secure access
- **Patient Management**: Multi-tenant patient system with provider isolation

## 📁 Directory Structure

```
infrastructure/
├── cdk/                    # AWS CDK (TypeScript) - PRIMARY APPROACH
│   ├── app.ts             # CDK app entry point
│   ├── full-stack.ts      # Complete stack with patient management
│   ├── user-preferences-stack.ts  # Legacy user preferences only
│   ├── lambda/            # Lambda function code
│   ├── package.json       # CDK dependencies
│   ├── cdk.json          # CDK configuration
│   └── tsconfig.json     # TypeScript configuration
├── cloudformation/        # AWS CloudFormation (Legacy)
│   └── user-preferences.yaml  # CloudFormation template
├── terraform/            # HashiCorp Terraform (Alternative)
│   └── main.tf           # Terraform configuration
└── README.md            # This file
```

## 🎯 New Features - Patient Management

### **Multi-Tenant Patient System**
- **Provider Isolation**: Each provider only sees their patients
- **Patient Autosuggest**: Real-time search with create-new-patient option
- **HIPAA Compliance**: Encrypted storage, audit logging, secure access
- **Encounter Tracking**: Links patients to encounters with statistics

### **DynamoDB Tables**
1. **UserPreferences**: User settings and preferences
2. **Patients**: Multi-tenant patient records with GSI indexes
   - `providerId-patientName-index` - For autosuggest queries
   - `providerId-lastEncounterDate-index` - For recent patients

## 🚀 Deployment Options

### Option 1: AWS CDK (Recommended)

**Pros:**
- ✅ Type-safe infrastructure code
- ✅ Rich ecosystem and constructs
- ✅ Easy to extend and maintain
- ✅ Built-in best practices

**Prerequisites:**
```bash
npm install -g aws-cdk
```

**Deploy:**
```bash
./deploy-infrastructure.sh dev cdk
```

**Cleanup:**
```bash
./cleanup-infrastructure.sh dev cdk
```

### Option 2: CloudFormation

**Pros:**
- ✅ Native AWS service
- ✅ No additional tools required
- ✅ Declarative YAML syntax
- ✅ Built-in rollback capabilities

**Deploy:**
```bash
./deploy-infrastructure.sh dev cloudformation
```

**Cleanup:**
```bash
./cleanup-infrastructure.sh dev cloudformation
```

### Option 3: Terraform

**Pros:**
- ✅ Multi-cloud support
- ✅ Rich provider ecosystem
- ✅ State management
- ✅ Plan/apply workflow

**Prerequisites:**
```bash
# Install Terraform (macOS)
brew install terraform

# Or download from https://terraform.io
```

**Deploy:**
```bash
./deploy-infrastructure.sh dev terraform
```

**Cleanup:**
```bash
./cleanup-infrastructure.sh dev terraform
```

## 🔧 Configuration

### Environment Variables

All deployment methods support environment-specific deployments:

```bash
# Deploy to development
./deploy-infrastructure.sh dev cdk

# Deploy to staging
./deploy-infrastructure.sh staging cdk

# Deploy to production
./deploy-infrastructure.sh prod cdk
```

### Resource Naming

Resources are named with environment suffixes:
- DynamoDB: `UserPreferences-{environment}`
- Lambda: `UserPreferencesApi-{environment}`
- API Gateway: `UserPreferencesApi-{environment}`

## 📊 Cost Estimation

### DynamoDB
- **Pay-per-request billing**
- ~$0.25 per million read/write requests
- Minimal cost for user preferences

### Lambda
- **Pay-per-invocation**
- ~$0.20 per million requests
- ~$0.0000166667 per GB-second

### API Gateway
- **Pay-per-request**
- ~$3.50 per million requests
- Additional data transfer costs

**Estimated monthly cost for 1000 active users: < $5**

## 🔒 Security

### IAM Permissions
- Lambda has minimal DynamoDB permissions (read/write to specific table)
- API Gateway uses AWS_PROXY integration
- No public access to DynamoDB

### Data Encryption
- DynamoDB encryption at rest (AWS managed)
- HTTPS for API Gateway endpoints
- Lambda environment variables encrypted

### CORS Configuration
- Configured for frontend domain
- Supports preflight requests
- Secure headers included

## 🧪 Testing

### API Endpoints

After deployment, test the API:

```bash
# Get API URL from deployment output
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

# Test GET (retrieve preferences)
curl -X GET "$API_URL/preferences/test-user"

# Test PUT (save preferences)
curl -X PUT "$API_URL/preferences/test-user" \
  -H "Content-Type: application/json" \
  -d '{"providerName": "Dr. Test", "providerSpecialty": "CARDIOLOGY"}'
```

### DynamoDB Data Structure

```json
{
  "PK": "USER#anonymous-user-123",
  "SK": "PREFERENCES",
  "preferences": {
    "providerName": "Dr. John Smith",
    "providerSpecialty": "FAMILY_MEDICINE",
    "enabledNoteTemplates": ["HISTORY_AND_PHYSICAL", "GIRPP"],
    "defaultNoteTemplate": "HISTORY_AND_PHYSICAL",
    "comprehendMedicalEnabled": true,
    "billingCycle": "MONTHLY"
  },
  "version": 1,
  "createdAt": "2024-07-30T20:00:00.000Z",
  "updatedAt": "2024-07-30T20:00:00.000Z"
}
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy infrastructure
        run: ./deploy-infrastructure.sh prod cdk
```

## 🐛 Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

2. **Insufficient Permissions**
   - Ensure AWS credentials have necessary permissions
   - Check IAM policies for CloudFormation, Lambda, DynamoDB, API Gateway

3. **Resource Already Exists**
   - Clean up existing resources first
   - Use different environment name

4. **Lambda Deployment Package Too Large**
   - Optimize dependencies in package.json
   - Use Lambda layers for large dependencies

### Logs and Monitoring

- **Lambda Logs**: CloudWatch Logs `/aws/lambda/UserPreferencesApi-{env}`
- **API Gateway Logs**: Enable in API Gateway console
- **DynamoDB Metrics**: CloudWatch DynamoDB metrics

## 🔄 Migration from Manual Resources

If you have manually created resources, clean them up first:

```bash
./cleanup-infrastructure.sh dev manual
```

Then deploy using IaC:

```bash
./deploy-infrastructure.sh dev cdk
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
