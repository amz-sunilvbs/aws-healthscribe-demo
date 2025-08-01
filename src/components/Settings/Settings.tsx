// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import Checkbox from '@cloudscape-design/components/checkbox';
import RadioGroup from '@cloudscape-design/components/radio-group';
import Alert from '@cloudscape-design/components/alert';

import { SettingSelect } from '@/components/Settings/Common';
import { useAppSettingsContext } from '@/store/appSettings';
import { AppSettingKeys, AppSettings } from '@/store/appSettings/appSettings.type';
import { DEFAULT_SETTINGS } from '@/store/appSettings/defaultSettings';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { 
  MEDICAL_SPECIALTIES, 
  CLINICAL_NOTE_TEMPLATES, 
  ClinicalNoteTemplate,
  MedicalSpecialty,
  UserPreferences,
  DEFAULT_USER_PREFERENCES
} from '@/types/UserPreferences';

export default function Settings() {
    const { appSettings, setAppSettings } = useAppSettingsContext();
    const { preferences, savePreferences, isLoading, error } = useUserPreferences();
    
    // Saving is instant, but create artificial wait
    const [isSaving, setIsSaving] = useState(false);
    // Make a copy of appSettings, write back it after form validation
    const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings);

    // Helper functions for the old API
    const updatePreferences = async (partialPreferences: Partial<UserPreferences>) => {
        const updatedPreferences = { ...preferences, ...partialPreferences };
        return await savePreferences(updatedPreferences);
    };

    const resetToDefaults = async () => {
        return await savePreferences(DEFAULT_USER_PREFERENCES);
    };

    // Reset settings to defaults, defined in consts
    function handleResetToDefaults() {
        setLocalSettings(DEFAULT_SETTINGS);
        resetToDefaults();
    }

    // Reload settings from appSettings from appContext
    function handleReload() {
        setLocalSettings(appSettings);
        // Preferences are already loaded from the hook
    }

    function handleSave() {
        setIsSaving(true);
        setTimeout(() => {
            setAppSettings(localSettings);
            setIsSaving(false);
            window.location.reload();
        }, 300);
    }

    const handleNoteTemplateChange = (template: ClinicalNoteTemplate, checked: boolean) => {
        const currentTemplates = preferences.enabledNoteTemplates;
        let newTemplates: ClinicalNoteTemplate[];
        
        if (checked) {
            newTemplates = [...currentTemplates, template];
        } else {
            newTemplates = currentTemplates.filter(t => t !== template);
            // Ensure at least one template is selected
            if (newTemplates.length === 0) {
                return; // Don't allow unchecking all templates
            }
        }
        
        updatePreferences({ 
            enabledNoteTemplates: newTemplates,
            // If we unchecked the default template, set a new default
            defaultNoteTemplate: newTemplates.includes(preferences.defaultNoteTemplate) 
                ? preferences.defaultNoteTemplate 
                : newTemplates[0]
        });
    };

    return (
        <ContentLayout
            headerVariant={'high-contrast'}
            header={
                <Header variant="h2" description="Settings are saved locally to the browser">
                    Settings
                </Header>
            }
        >
            <Container>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSave();
                    }}
                >
                    <Form
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                <Button disabled={isSaving} formAction="none" onClick={() => handleReload()}>
                                    Reload
                                </Button>
                                <Button disabled={isSaving} variant="primary">
                                    {isSaving ? <Spinner /> : 'Save'}
                                </Button>
                            </SpaceBetween>
                        }
                        secondaryActions={
                            <Button disabled={isSaving} formAction="none" onClick={() => handleResetToDefaults()}>
                                Reset to Defaults
                            </Button>
                        }
                    >
                        <SpaceBetween size={'l'}>
                            {/* Provider Information */}
                            <ExpandableSection headerText="Provider Information" defaultExpanded>
                                <SpaceBetween size="m">
                                    <FormField
                                        label="Provider's Name"
                                        description="Enter your full name as it should appear in clinical documentation"
                                    >
                                        <Input
                                            value={preferences.providerName}
                                            onChange={({ detail }) => 
                                                updatePreferences({ providerName: detail.value })
                                            }
                                            placeholder="Dr. John Smith"
                                        />
                                    </FormField>

                                    <FormField
                                        label="Provider's Specialty"
                                        description="Select your medical specialty"
                                    >
                                        <Select
                                            selectedOption={
                                                MEDICAL_SPECIALTIES.find(s => s.value === preferences.providerSpecialty) || 
                                                MEDICAL_SPECIALTIES[0]
                                            }
                                            onChange={({ detail }) => 
                                                updatePreferences({ 
                                                    providerSpecialty: detail.selectedOption.value as MedicalSpecialty 
                                                })
                                            }
                                            options={MEDICAL_SPECIALTIES}
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>

                            {/* Clinical Note Preferences */}
                            <ExpandableSection headerText="Clinical Note Preferences" defaultExpanded>
                                <SpaceBetween size="m">
                                    <FormField
                                        label="Available Note Templates"
                                        description="Select which note templates should be available when uploading audio files. At least one must be selected."
                                    >
                                        <SpaceBetween size="s">
                                            {CLINICAL_NOTE_TEMPLATES.map((template) => (
                                                <Checkbox
                                                    key={template.value}
                                                    checked={preferences.enabledNoteTemplates.includes(template.value)}
                                                    onChange={({ detail }) => 
                                                        handleNoteTemplateChange(template.value, detail.checked)
                                                    }
                                                    description={template.description}
                                                >
                                                    {template.label}
                                                </Checkbox>
                                            ))}
                                        </SpaceBetween>
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>

                            {/* Medical Entity Extraction */}
                            <ExpandableSection headerText="Medical Entity Extraction" defaultExpanded>
                                <SpaceBetween size="m">
                                    <FormField
                                        label="Ontology linking and Medical Entity extraction"
                                        description={
                                            <>
                                                Enable{' '}
                                                <Link
                                                    href="https://aws.amazon.com/comprehend/medical/"
                                                    external={true}
                                                    variant="primary"
                                                    fontSize="body-s"
                                                >
                                                    Amazon Comprehend Medical
                                                </Link>{' '}
                                                for advanced medical entity extraction and ontology linking.
                                            </>
                                        }
                                    >
                                        <Checkbox
                                            checked={preferences.comprehendMedicalEnabled}
                                            onChange={({ detail }) => 
                                                updatePreferences({ comprehendMedicalEnabled: detail.checked })
                                            }
                                        >
                                            Enable Medical Entity Extraction
                                        </Checkbox>
                                    </FormField>
                                    
                                    {preferences.comprehendMedicalEnabled && (
                                        <Alert type="info">
                                            <strong>Additional Costs Apply:</strong> Amazon Comprehend Medical is a paid service 
                                            that charges per request. Enabling this feature will incur additional costs beyond 
                                            the base HealthScribe service. Review the{' '}
                                            <Link 
                                                href="https://aws.amazon.com/comprehend/medical/pricing/" 
                                                external={true}
                                            >
                                                pricing details
                                            </Link>{' '}
                                            before enabling.
                                        </Alert>
                                    )}
                                </SpaceBetween>
                            </ExpandableSection>

                            {/* Billing Preferences */}
                            <ExpandableSection headerText="Billing Preferences">
                                <SpaceBetween size="m">
                                    <FormField
                                        label="Billing Cycle"
                                        description="Choose your preferred billing frequency"
                                    >
                                        <RadioGroup
                                            value={preferences.billingCycle}
                                            onChange={({ detail }) => 
                                                updatePreferences({ billingCycle: detail.value as 'MONTHLY' | 'YEARLY' })
                                            }
                                            items={[
                                                { value: 'MONTHLY', label: 'Monthly billing' },
                                                { value: 'YEARLY', label: 'Yearly billing (save 10%)' }
                                            ]}
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>

                            {/* Account Management */}
                            <ExpandableSection headerText="Account Management">
                                <SpaceBetween size="m">
                                    <FormField
                                        label="Password"
                                        description="Update your account password"
                                    >
                                        <Link href="/settings/change-password" variant="primary">
                                            Change Password
                                        </Link>
                                    </FormField>
                                </SpaceBetween>
                            </ExpandableSection>

                            {/* Existing App Settings */}
                            <ExpandableSection headerText="Application Settings">
                                <SpaceBetween size="m">
                                    <SettingSelect
                                        formLabel="HealthScribe Region"
                                        formDescription="As of April 13, 2024, HealthScribe is available in the US East (N. Virginia) region."
                                        optionKey={AppSettingKeys.Region}
                                        selectedOption={localSettings['app.region']}
                                        setLocalSettings={setLocalSettings}
                                    />
                                    <SettingSelect
                                        formLabel="API Timing"
                                        formDescription="Print API timing information in the browser console."
                                        optionKey={AppSettingKeys.ApiTiming}
                                        selectedOption={localSettings['app.apiTiming']}
                                        setLocalSettings={setLocalSettings}
                                    />
                                </SpaceBetween>
                            </ExpandableSection>
                        </SpaceBetween>
                    </Form>
                </form>
            </Container>
        </ContentLayout>
    );
}
