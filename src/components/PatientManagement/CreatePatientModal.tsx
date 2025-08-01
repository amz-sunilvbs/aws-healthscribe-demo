// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState } from 'react';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import DatePicker from '@cloudscape-design/components/date-picker';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import { CreatePatientRequest, Patient } from '@/types/Patient';

interface CreatePatientModalProps {
    visible: boolean;
    onDismiss: () => void;
    onCreatePatient: (patientData: CreatePatientRequest) => Promise<Patient>;
    initialName?: string;
}

const GENDER_OPTIONS = [
    { label: 'Select gender', value: '' },
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

export function CreatePatientModal({ 
    visible, 
    onDismiss, 
    onCreatePatient, 
    initialName = '' 
}: CreatePatientModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string>('');
    
    // Form state
    const [patientName, setPatientName] = useState(initialName);
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [mrn, setMrn] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [gender, setGender] = useState({ label: 'Select gender', value: '' });

    // Reset form when modal opens/closes
    React.useEffect(() => {
        if (visible) {
            setPatientName(initialName);
            setDateOfBirth('');
            setMrn('');
            setPhoneNumber('');
            setEmail('');
            setGender({ label: 'Select gender', value: '' });
            setFormError('');
        }
    }, [visible, initialName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!patientName.trim()) {
            setFormError('Patient name is required');
            return;
        }

        setIsSubmitting(true);
        setFormError('');

        try {
            const patientData: CreatePatientRequest = {
                patientName: patientName.trim(),
                dateOfBirth: dateOfBirth || undefined,
                mrn: mrn || undefined,
                phoneNumber: phoneNumber || undefined,
                email: email || undefined,
                demographics: gender.value ? { gender: gender.value } : undefined,
            };

            await onCreatePatient(patientData);
            onDismiss();
        } catch (error) {
            console.error('Error creating patient:', error);
            setFormError(error instanceof Error ? error.message : 'Failed to create patient');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            onDismiss={onDismiss}
            header="Create New Patient"
            size="medium"
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" onClick={onDismiss} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={() => handleSubmit(new Event('submit') as any)}
                            disabled={isSubmitting || !patientName.trim()}
                        >
                            {isSubmitting ? <Spinner /> : 'Create Patient'}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
        >
            <form onSubmit={handleSubmit}>
                <Form errorText={formError}>
                    <SpaceBetween direction="vertical" size="l">
                        {/* Required Fields */}
                        <FormField 
                            label="Patient Name" 
                            description="Full name of the patient"
                        >
                            <Input
                                value={patientName}
                                onChange={({ detail }) => setPatientName(detail.value)}
                                placeholder="Enter patient's full name"
                                disabled={isSubmitting}
                            />
                        </FormField>

                        {/* Optional Fields */}
                        <Grid gridDefinition={[
                            { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } },
                            { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }
                        ]}>
                            <FormField 
                                label="Date of Birth" 
                                description="Patient's date of birth (optional)"
                            >
                                <DatePicker
                                    value={dateOfBirth}
                                    onChange={({ detail }) => setDateOfBirth(detail.value)}
                                    placeholder="YYYY-MM-DD"
                                    disabled={isSubmitting}
                                />
                            </FormField>

                            <FormField 
                                label="Medical Record Number" 
                                description="MRN or patient ID (optional)"
                            >
                                <Input
                                    value={mrn}
                                    onChange={({ detail }) => setMrn(detail.value)}
                                    placeholder="Enter MRN"
                                    disabled={isSubmitting}
                                />
                            </FormField>
                        </Grid>

                        <Grid gridDefinition={[
                            { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } },
                            { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }
                        ]}>
                            <FormField 
                                label="Phone Number" 
                                description="Contact phone number (optional)"
                            >
                                <Input
                                    value={phoneNumber}
                                    onChange={({ detail }) => setPhoneNumber(detail.value)}
                                    placeholder="(555) 123-4567"
                                    disabled={isSubmitting}
                                />
                            </FormField>

                            <FormField 
                                label="Email" 
                                description="Contact email address (optional)"
                            >
                                <Input
                                    value={email}
                                    onChange={({ detail }) => setEmail(detail.value)}
                                    placeholder="patient@example.com"
                                    type="email"
                                    disabled={isSubmitting}
                                />
                            </FormField>
                        </Grid>

                        <FormField 
                            label="Gender" 
                            description="Patient's gender (optional)"
                        >
                            <Select
                                selectedOption={gender}
                                onChange={({ detail }) => setGender(detail.selectedOption as { label: string; value: string })}
                                options={GENDER_OPTIONS}
                                disabled={isSubmitting}
                            />
                        </FormField>
                    </SpaceBetween>
                </Form>
            </form>
        </Modal>
    );
}
