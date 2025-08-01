// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Dynamic Amplify Configuration Loader
 * 
 * This module loads configuration dynamically based on the environment:
 * - Production/Deployed: Loads from deployed amplifyconfiguration.json
 * - Local Development: Uses environment variables or falls back to deployed config
 */

export interface AmplifyConfig {
  aws_project_region: string;
  aws_cognito_region: string;
  aws_user_pools_id: string;
  aws_user_pools_web_client_id: string;
  oauth: object;
  aws_cognito_username_attributes: string[];
  aws_cognito_social_providers: string[];
  aws_cognito_signup_attributes: string[];
  aws_cognito_mfa_configuration: string;
  aws_cognito_mfa_types: string[];
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: number;
    passwordPolicyCharacters: string[];
  };
  aws_cognito_verification_mechanisms: string[];
  aws_user_files_s3_bucket: string;
  aws_user_files_s3_bucket_region: string;
  aws_cognito_identity_pool_id: string;
  healthscribe_service_role_arn: string;
  api_url: string;
}

// Default configuration for local development (fallback)
const DEFAULT_CONFIG: AmplifyConfig = {
  aws_project_region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  aws_cognito_region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  aws_user_pools_id: import.meta.env.VITE_USER_POOL_ID || '',
  aws_user_pools_web_client_id: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
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
  aws_user_files_s3_bucket: import.meta.env.VITE_S3_BUCKET || '',
  aws_user_files_s3_bucket_region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  aws_cognito_identity_pool_id: import.meta.env.VITE_IDENTITY_POOL_ID || '',
  healthscribe_service_role_arn: import.meta.env.VITE_HEALTHSCRIBE_ROLE_ARN || '',
  api_url: import.meta.env.VITE_API_URL || '',
};

let cachedConfig: AmplifyConfig | null = null;

/**
 * Load Amplify configuration dynamically
 * @returns Promise<AmplifyConfig>
 */
export async function loadAmplifyConfig(): Promise<AmplifyConfig> {
  if (cachedConfig) {
    console.log('✅ Using cached configuration');
    return cachedConfig;
  }

  console.log('🔧 Loading Amplify configuration...');

  try {
    // Try to load from deployed configuration first
    console.log('🌐 Attempting to load from /amplifyconfiguration.json...');
    const response = await fetch('/amplifyconfiguration.json');
    if (response.ok) {
      const deployedConfig = await response.json() as AmplifyConfig;
      cachedConfig = deployedConfig;
      console.log('✅ Loaded configuration from deployed amplifyconfiguration.json');
      console.log('📋 Config preview:', {
        aws_user_pools_id: deployedConfig.aws_user_pools_id,
        aws_user_files_s3_bucket: deployedConfig.aws_user_files_s3_bucket,
        api_url: deployedConfig.api_url
      });
      return cachedConfig;
    } else {
      console.log('⚠️ Deployed configuration not found (status:', response.status, ')');
    }
  } catch (error) {
    console.log('⚠️ Could not load deployed configuration:', error);
  }

  // Fallback to environment variables for local development
  console.log('🔧 Loading configuration from environment variables...');
  console.log('📋 Environment variables preview:', {
    VITE_USER_POOL_ID: import.meta.env.VITE_USER_POOL_ID,
    VITE_USER_POOL_CLIENT_ID: import.meta.env.VITE_USER_POOL_CLIENT_ID ? '***' + import.meta.env.VITE_USER_POOL_CLIENT_ID.slice(-4) : 'undefined',
    VITE_S3_BUCKET: import.meta.env.VITE_S3_BUCKET,
    VITE_API_URL: import.meta.env.VITE_API_URL
  });

  const envConfig: AmplifyConfig = {
    ...DEFAULT_CONFIG,
    aws_user_pools_id: import.meta.env.VITE_USER_POOL_ID || DEFAULT_CONFIG.aws_user_pools_id,
    aws_user_pools_web_client_id: import.meta.env.VITE_USER_POOL_CLIENT_ID || DEFAULT_CONFIG.aws_user_pools_web_client_id,
    aws_user_files_s3_bucket: import.meta.env.VITE_S3_BUCKET || DEFAULT_CONFIG.aws_user_files_s3_bucket,
    aws_cognito_identity_pool_id: import.meta.env.VITE_IDENTITY_POOL_ID || DEFAULT_CONFIG.aws_cognito_identity_pool_id,
    healthscribe_service_role_arn: import.meta.env.VITE_HEALTHSCRIBE_ROLE_ARN || DEFAULT_CONFIG.healthscribe_service_role_arn,
    api_url: import.meta.env.VITE_API_URL || DEFAULT_CONFIG.api_url,
  };

  cachedConfig = envConfig;
  
  // Validate that required environment variables are set for local development
  const requiredEnvVars = [
    'VITE_USER_POOL_ID',
    'VITE_USER_POOL_CLIENT_ID', 
    'VITE_IDENTITY_POOL_ID',
    'VITE_S3_BUCKET',
    'VITE_HEALTHSCRIBE_ROLE_ARN',
    'VITE_API_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables for local development:', missingVars);
    console.log('💡 Create a .env.local file with these variables or run ./scripts/setup-local-dev.sh');
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  } else {
    console.log('✅ All required environment variables found');
    console.log('📋 Final config preview:', {
      aws_user_pools_id: cachedConfig.aws_user_pools_id,
      aws_user_files_s3_bucket: cachedConfig.aws_user_files_s3_bucket,
      api_url: cachedConfig.api_url
    });
  }

  return cachedConfig;
}

/**
 * Get cached configuration (must call loadAmplifyConfig first)
 * @returns AmplifyConfig | null
 */
export function getAmplifyConfig(): AmplifyConfig {
  if (!cachedConfig) {
    console.warn('⚠️ getAmplifyConfig called before loadAmplifyConfig. Using default configuration.');
    return DEFAULT_CONFIG;
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
