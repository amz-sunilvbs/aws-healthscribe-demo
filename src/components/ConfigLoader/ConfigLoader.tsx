// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { loadAmplifyConfig } from '@/config/amplifyConfig';

interface ConfigLoaderProps {
  children: React.ReactNode;
}

export function ConfigLoader({ children }: ConfigLoaderProps) {
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeConfig() {
      try {
        console.log('🔧 ConfigLoader: Starting configuration initialization...');
        const config = await loadAmplifyConfig();
        
        // Validate that we have the minimum required configuration
        if (!config.aws_user_pools_id || !config.aws_user_pools_web_client_id) {
          throw new Error('Invalid configuration: Missing User Pool ID or Client ID');
        }
        
        // Configure Amplify with the loaded configuration
        console.log('🔧 ConfigLoader: Configuring Amplify...');
        Amplify.configure(config);
        
        console.log('✅ ConfigLoader: Amplify configuration completed successfully');
        setIsConfigLoaded(true);
      } catch (error) {
        console.error('❌ ConfigLoader: Failed to load Amplify configuration:', error);
        setConfigError(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    initializeConfig();
  }, []);

  if (configError) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: '#fee', 
        border: '1px solid #fcc',
        borderRadius: '4px',
        margin: '20px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h2 style={{ color: '#c33', marginBottom: '16px' }}>⚠️ Configuration Error</h2>
        <p style={{ marginBottom: '16px' }}>
          <strong>Failed to load application configuration:</strong><br />
          {configError}
        </p>
        
        <div style={{ 
          backgroundColor: '#fff', 
          border: '1px solid #ddd', 
          borderRadius: '4px', 
          padding: '16px', 
          marginBottom: '16px',
          textAlign: 'left'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>🔧 For Local Development:</h3>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Make sure your stack is deployed:
              <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
cd infrastructure/cdk{'\n'}cdk deploy --context env=dev
              </pre>
            </li>
            <li>Run the setup script:
              <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
./scripts/setup-local-dev.sh
              </pre>
            </li>
            <li>Start local development:
              <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
npm run dev
              </pre>
            </li>
          </ol>
        </div>

        <details style={{ textAlign: 'left', marginTop: '16px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>📋 Required Environment Variables</summary>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li><code>VITE_AWS_REGION</code></li>
            <li><code>VITE_USER_POOL_ID</code></li>
            <li><code>VITE_USER_POOL_CLIENT_ID</code></li>
            <li><code>VITE_IDENTITY_POOL_ID</code></li>
            <li><code>VITE_S3_BUCKET</code></li>
            <li><code>VITE_HEALTHSCRIBE_ROLE_ARN</code></li>
            <li><code>VITE_API_URL</code></li>
          </ul>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
            These should be automatically created by running <code>./scripts/setup-local-dev.sh</code>
          </p>
        </details>
      </div>
    );
  }

  if (!isConfigLoaded) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Loading configuration...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Initializing AWS Amplify configuration
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
