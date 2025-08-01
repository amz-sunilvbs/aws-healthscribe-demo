// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState } from 'react';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';

import { useAuthContext } from '@/store/auth';
import { testPatientTableAccess, getProviderPatients } from '@/utils/PatientApi';

export function PatientApiTest() {
    const { user } = useAuthContext();
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleTestAccess = async () => {
        setIsLoading(true);
        try {
            const result = await testPatientTableAccess();
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestSearch = async () => {
        setIsLoading(true);
        try {
            const providerId = user?.username || (user as any)?.sub || 'test-provider';
            console.log('Testing search with provider ID:', providerId);
            
            const patients = await getProviderPatients(providerId, '', 5);
            setTestResult({
                success: true,
                message: `Search successful! Found ${patients.length} patients for provider ${providerId}`
            });
        } catch (error) {
            setTestResult({
                success: false,
                message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container
            header={
                <Header variant="h2">
                    Patient API Debug Test
                </Header>
            }
        >
            <SpaceBetween direction="vertical" size="m">
                <Box>
                    <strong>Current User:</strong> {user?.username || 'Not authenticated'}
                </Box>
                
                <Box>
                    <strong>Provider ID:</strong> {user?.username || (user as any)?.sub || 'Not available'}
                </Box>

                <SpaceBetween direction="horizontal" size="s">
                    <Button
                        variant="primary"
                        onClick={handleTestAccess}
                        loading={isLoading}
                    >
                        Test Table Access
                    </Button>
                    
                    <Button
                        onClick={handleTestSearch}
                        loading={isLoading}
                        disabled={!user}
                    >
                        Test Patient Search
                    </Button>
                </SpaceBetween>

                {testResult && (
                    <Box>
                        <StatusIndicator type={testResult.success ? 'success' : 'error'}>
                            {testResult.success ? 'Success' : 'Error'}
                        </StatusIndicator>
                        <Box variant="p" margin={{ top: 'xs' }}>
                            {testResult.message}
                        </Box>
                    </Box>
                )}
            </SpaceBetween>
        </Container>
    );
}
