// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect, useCallback } from 'react';

import Autosuggest from '@cloudscape-design/components/autosuggest';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { useAuthContext } from '@/store/auth';
import { useNotificationsContext } from '@/store/notifications';
import { Patient, PatientSearchResult, CreatePatientRequest } from '@/types/Patient';
import { getProviderPatients, createPatient } from '@/utils/PatientApi';

import { CreatePatientModal } from './CreatePatientModal';

interface PatientAutosuggestProps {
    value: string;
    onChange: (patientName: string, patientId?: string) => void;
    onPatientSelect?: (patient: PatientSearchResult) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    description?: string;
}

interface AutosuggestOption {
    value: string;
    label: string;
    description?: string;
    tags?: string[];
    __isCreateNew?: boolean;
    __patientId?: string;
}

export function PatientAutosuggest({
    value,
    onChange,
    onPatientSelect,
    placeholder = "Enter patient name",
    disabled = false,
    label = "Patient Name",
    description
}: PatientAutosuggestProps) {
    const { user } = useAuthContext();
    const { addFlashMessage } = useNotificationsContext();
    
    const [options, setOptions] = useState<AutosuggestOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createPatientName, setCreatePatientName] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();

    // Get current provider ID
    const providerId = user?.username || (user as any)?.sub || '';

    // Debounced search function
    const searchPatients = useCallback(
        async (searchTerm: string) => {
            if (!providerId || !searchTerm.trim() || searchTerm === 'New Encounter') {
                setOptions([]);
                return;
            }

            setIsLoading(true);
            try {
                const patients = await getProviderPatients(providerId, searchTerm, 10);
                
                const patientOptions: AutosuggestOption[] = patients.map(patient => ({
                    value: patient.patientName,
                    label: patient.patientName,
                    description: [
                        patient.dateOfBirth && `DOB: ${patient.dateOfBirth}`,
                        patient.mrn && `MRN: ${patient.mrn}`,
                        patient.encounterCount > 0 && `${patient.encounterCount} encounter${patient.encounterCount > 1 ? 's' : ''}`
                    ].filter(Boolean).join(' • '),
                    tags: [patient.mrn, patient.dateOfBirth].filter((item): item is string => Boolean(item)),
                    __patientId: patient.patientId,
                }));

                // Add "Create new patient" option if no exact match
                const exactMatch = patients.find(p => 
                    p.patientName.toLowerCase() === searchTerm.toLowerCase()
                );
                
                if (!exactMatch && searchTerm.trim().length > 0) {
                    patientOptions.push({
                        value: searchTerm,
                        label: `Create new patient: "${searchTerm}"`,
                        description: 'Click to create a new patient record',
                        __isCreateNew: true,
                    });
                }

                setOptions(patientOptions);
            } catch (error) {
                console.error('Error searching patients:', error);
                addFlashMessage({
                    id: 'patient-search-error',
                    header: 'Patient Search Error',
                    content: 'Failed to search patients. Please try again.',
                    type: 'error',
                });
                setOptions([]);
            } finally {
                setIsLoading(false);
            }
        },
        [providerId, addFlashMessage]
    );

    // Handle input change with debouncing
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchPatients(value);
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [value, searchPatients]);

    // Handle option selection
    const handleSelect = (selectedOption: AutosuggestOption) => {
        if (selectedOption.__isCreateNew) {
            // Open create patient modal
            setCreatePatientName(selectedOption.value);
            setShowCreateModal(true);
        } else {
            // Select existing patient
            const patientId = selectedOption.__patientId;
            setSelectedPatientId(patientId);
            onChange(selectedOption.value, patientId);
            
            // Notify parent component if callback provided
            if (onPatientSelect && patientId) {
                const patient = options.find(opt => opt.__patientId === patientId);
                if (patient) {
                    onPatientSelect({
                        patientId,
                        patientName: patient.label,
                        // Add other fields as needed
                        encounterCount: 0, // This would come from the search results
                    });
                }
            }
            
            setOptions([]); // Clear options after selection
        }
    };

    // Handle patient creation
    const handleCreatePatient = async (patientData: CreatePatientRequest): Promise<Patient> => {
        try {
            const newPatient = await createPatient(providerId, patientData);
            
            // Update the input with the new patient
            setSelectedPatientId(newPatient.patientId);
            onChange(newPatient.patientName, newPatient.patientId);
            
            // Notify parent component
            if (onPatientSelect) {
                onPatientSelect({
                    patientId: newPatient.patientId,
                    patientName: newPatient.patientName,
                    dateOfBirth: newPatient.dateOfBirth,
                    mrn: newPatient.mrn,
                    encounterCount: 0,
                });
            }

            addFlashMessage({
                id: 'patient-created',
                header: 'Patient Created',
                content: `Successfully created patient record for ${newPatient.patientName}`,
                type: 'success',
            });

            return newPatient;
        } catch (error) {
            console.error('Error creating patient:', error);
            throw new Error('Failed to create patient. Please try again.');
        }
    };

    // Handle input change
    const handleChange = (newValue: string) => {
        onChange(newValue);
        
        // Clear selected patient ID if user is typing a new name
        if (selectedPatientId && newValue !== value) {
            setSelectedPatientId(undefined);
        }
    };

    // Handle focus - clear "New Encounter" default
    const handleFocus = () => {
        if (value === 'New Encounter') {
            onChange('');
        }
    };

    return (
        <>
            <FormField label={label} description={description}>
                <SpaceBetween direction="vertical" size="xs">
                    <Autosuggest
                        value={value}
                        onChange={({ detail }) => handleChange(detail.value)}
                        onFocus={handleFocus}
                        onSelect={({ detail }) => {
                            const selectedOption = options.find(opt => opt.value === detail.value);
                            if (selectedOption) {
                                handleSelect(selectedOption);
                            }
                        }}
                        options={options}
                        placeholder={placeholder}
                        disabled={disabled}
                        loadingText="Searching patients..."
                        statusType={isLoading ? "loading" : "finished"}
                        empty="No patients found"
                        enteredTextLabel={(value) => `Use "${value}"`}
                        ariaLabel="Patient name autosuggest"
                    />
                    
                    {/* Quick create button for better UX */}
                    {value && value !== 'New Encounter' && value.trim().length > 0 && !selectedPatientId && (
                        <Box>
                            <Button
                                variant="link"
                                iconName="add-plus"
                                onClick={() => {
                                    setCreatePatientName(value);
                                    setShowCreateModal(true);
                                }}
                                disabled={disabled}
                            >
                                Create new patient "{value}"
                            </Button>
                        </Box>
                    )}
                </SpaceBetween>
            </FormField>

            <CreatePatientModal
                visible={showCreateModal}
                onDismiss={() => {
                    setShowCreateModal(false);
                    setCreatePatientName('');
                }}
                onCreatePatient={handleCreatePatient}
                initialName={createPatientName}
            />
        </>
    );
}
