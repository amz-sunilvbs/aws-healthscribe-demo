// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export type MedicalSpecialty = 
  | 'FAMILY_MEDICINE'
  | 'INTERNAL_MEDICINE'
  | 'PEDIATRICS'
  | 'CARDIOLOGY'
  | 'DERMATOLOGY'
  | 'EMERGENCY_MEDICINE'
  | 'ENDOCRINOLOGY'
  | 'GASTROENTEROLOGY'
  | 'NEUROLOGY'
  | 'ONCOLOGY'
  | 'ORTHOPEDICS'
  | 'PSYCHIATRY'
  | 'RADIOLOGY'
  | 'SURGERY'
  | 'UROLOGY'
  | 'OTHER';

export type ClinicalNoteTemplate = 
  | 'HISTORY_AND_PHYSICAL'
  | 'GIRPP' 
  | 'BIRP'
  | 'SIRP'
  | 'DAP'
  | 'BEHAVIORAL_SOAP'
  | 'PHYSICAL_SOAP';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface UserPreferences {
  // Provider Information
  providerName: string;
  providerSpecialty: MedicalSpecialty;
  
  // Clinical Note Preferences
  enabledNoteTemplates: ClinicalNoteTemplate[];
  defaultNoteTemplate: ClinicalNoteTemplate;
  
  // Medical Entity Extraction
  comprehendMedicalEnabled: boolean;
  
  // Billing
  billingCycle: BillingCycle;
  
  // App Settings (existing)
  region: string;
  apiTiming: boolean;
  
  // Audio Preferences
  defaultPlaybackSpeed: number;
  skipInterval: number;
  autoScroll: boolean;
  
  // UI Preferences
  defaultTab: 'transcript' | 'clinical-note' | 'insights';
  smallTalkDefault: boolean;
  silenceDefault: boolean;
  
  // Insights Preferences
  confidenceThreshold: number;
  autoExtract: boolean;
}

export interface UserPreferencesRecord {
  PK: string; // USER#{userId}
  SK: string; // PREFERENCES
  preferences: UserPreferences;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  // Provider Information
  providerName: '',
  providerSpecialty: 'FAMILY_MEDICINE',
  
  // Clinical Note Preferences
  enabledNoteTemplates: ['HISTORY_AND_PHYSICAL', 'GIRPP', 'BIRP', 'SIRP', 'DAP', 'BEHAVIORAL_SOAP', 'PHYSICAL_SOAP'],
  defaultNoteTemplate: 'HISTORY_AND_PHYSICAL',
  
  // Medical Entity Extraction
  comprehendMedicalEnabled: true,
  
  // Billing
  billingCycle: 'MONTHLY',
  
  // App Settings
  region: 'us-east-1',
  apiTiming: false,
  
  // Audio Preferences
  defaultPlaybackSpeed: 1,
  skipInterval: 5,
  autoScroll: true,
  
  // UI Preferences
  defaultTab: 'transcript',
  smallTalkDefault: false,
  silenceDefault: false,
  
  // Insights Preferences
  confidenceThreshold: 75,
  autoExtract: false,
};

export const MEDICAL_SPECIALTIES: { label: string; value: MedicalSpecialty }[] = [
  { label: 'Family Medicine', value: 'FAMILY_MEDICINE' },
  { label: 'Internal Medicine', value: 'INTERNAL_MEDICINE' },
  { label: 'Pediatrics', value: 'PEDIATRICS' },
  { label: 'Cardiology', value: 'CARDIOLOGY' },
  { label: 'Dermatology', value: 'DERMATOLOGY' },
  { label: 'Emergency Medicine', value: 'EMERGENCY_MEDICINE' },
  { label: 'Endocrinology', value: 'ENDOCRINOLOGY' },
  { label: 'Gastroenterology', value: 'GASTROENTEROLOGY' },
  { label: 'Neurology', value: 'NEUROLOGY' },
  { label: 'Oncology', value: 'ONCOLOGY' },
  { label: 'Orthopedics', value: 'ORTHOPEDICS' },
  { label: 'Psychiatry', value: 'PSYCHIATRY' },
  { label: 'Radiology', value: 'RADIOLOGY' },
  { label: 'Surgery', value: 'SURGERY' },
  { label: 'Urology', value: 'UROLOGY' },
  { label: 'Other', value: 'OTHER' },
];

/**
 * Migration function to convert old note template values to new ones
 * This handles the API change from BH_SOAP/PH_SOAP to BEHAVIORAL_SOAP/PHYSICAL_SOAP
 */
export function migrateNoteTemplate(template: string): ClinicalNoteTemplate {
  const migrationMap: Record<string, ClinicalNoteTemplate> = {
    'BH_SOAP': 'BEHAVIORAL_SOAP',
    'PH_SOAP': 'PHYSICAL_SOAP',
  };
  
  return (migrationMap[template] as ClinicalNoteTemplate) || (template as ClinicalNoteTemplate);
}

/**
 * Migration function to convert old note template arrays to new ones
 */
export function migrateNoteTemplateArray(templates: string[]): ClinicalNoteTemplate[] {
  return templates.map(template => migrateNoteTemplate(template));
}

export const CLINICAL_NOTE_TEMPLATES: { label: string; value: ClinicalNoteTemplate; description: string }[] = [
  { 
    label: 'History and Physical', 
    value: 'HISTORY_AND_PHYSICAL',
    description: 'Comprehensive clinical documentation with sections like Chief Complaint, History of Present Illness, Review of Systems, Past Medical History, Assessment, and Plan'
  },
  { 
    label: 'GIRPP (Goal, Intervention, Response, Progress, Plan)', 
    value: 'GIRPP',
    description: 'Goal-oriented documentation format focusing on treatment goals and patient progress'
  },
  { 
    label: 'BIRP (Behavior, Intervention, Response, Plan)', 
    value: 'BIRP',
    description: 'Behavioral health format focusing on patient behavioral patterns and responses to treatment'
  },
  { 
    label: 'SIRP (Situation, Intervention, Response, Plan)', 
    value: 'SIRP',
    description: 'Therapy-focused format emphasizing situational context and therapeutic interventions'
  },
  { 
    label: 'DAP (Data, Assessment, Plan)', 
    value: 'DAP',
    description: 'Simplified clinical documentation format with patient data, clinical assessment, and treatment plan'
  },
  { 
    label: 'Behavioral SOAP', 
    value: 'BEHAVIORAL_SOAP',
    description: 'Behavioral health focused SOAP format with Subjective, Objective, Assessment, and Plan sections'
  },
  { 
    label: 'Physical SOAP', 
    value: 'PHYSICAL_SOAP',
    description: 'Physical health focused SOAP format with Subjective, Objective, Assessment, and Plan sections'
  },
];
