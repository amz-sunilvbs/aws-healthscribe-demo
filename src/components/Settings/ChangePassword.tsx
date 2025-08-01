// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Alert from '@cloudscape-design/components/alert';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      // TODO: Implement actual password change logic
      // This would typically call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ContentLayout
      headerVariant="high-contrast"
      header={
        <Header 
          variant="h2" 
          description="Update your account password"
        >
          Change Password
        </Header>
      }
    >
      <Container>
        <form onSubmit={handleSubmit}>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button 
                  formAction="none" 
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                >
                  {isSubmitting ? 'Changing Password...' : 'Change Password'}
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="m">
              {message && (
                <Alert type={message.type}>
                  {message.text}
                </Alert>
              )}
              
              <FormField
                label="Current Password"
                description="Enter your current password"
              >
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={({ detail }) => setCurrentPassword(detail.value)}
                  placeholder="Enter current password"
                />
              </FormField>

              <FormField
                label="New Password"
                description="Password must be at least 8 characters long"
              >
                <Input
                  type="password"
                  value={newPassword}
                  onChange={({ detail }) => setNewPassword(detail.value)}
                  placeholder="Enter new password"
                />
              </FormField>

              <FormField
                label="Confirm New Password"
                description="Re-enter your new password"
              >
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={({ detail }) => setConfirmPassword(detail.value)}
                  placeholder="Confirm new password"
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </Container>
    </ContentLayout>
  );
}
