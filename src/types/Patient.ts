// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Multi-tenant Patient Management Types
 * Supports provider-level data isolation as per README architecture
 */

export interface Patient {
    patientId: string;          // PK: UUID
    providerId: string;         // GSI: Provider's patients (multi-tenant isolation)
    patientName: string;        // Patient's full name
    dateOfBirth?: string;       // Optional DOB (YYYY-MM-DD)
    mrn?: string;              // Medical Record Number
    phoneNumber?: string;       // Contact information
    email?: string;            // Contact information
    demographics?: {           // Optional demographics
        gender?: string;
        race?: string;
        ethnicity?: string;
    };
    isActive: boolean;         // Soft delete flag
    createdAt: string;         // ISO timestamp
    updatedAt: string;         // ISO timestamp
    lastEncounterDate?: string; // Last encounter with this patient
    encounterCount: number;    // Total encounters for this patient
}

export interface CreatePatientRequest {
    patientName: string;       // Required
    dateOfBirth?: string;      // Optional
    mrn?: string;             // Optional
    phoneNumber?: string;      // Optional
    email?: string;           // Optional
    demographics?: {
        gender?: string;
        race?: string;
        ethnicity?: string;
    };
}

export interface UpdatePatientRequest {
    patientName?: string;
    dateOfBirth?: string;
    mrn?: string;
    phoneNumber?: string;
    email?: string;
    demographics?: {
        gender?: string;
        race?: string;
        ethnicity?: string;
    };
}

export interface PatientSearchResult {
    patientId: string;
    patientName: string;
    dateOfBirth?: string;
    mrn?: string;
    lastEncounterDate?: string;
    encounterCount: number;
}

export interface PatientAutosuggestOption {
    value: string;             // patientId
    label: string;            // patientName
    description?: string;      // Additional info (DOB, MRN, etc.)
    tags?: string[];          // For filtering/display
}
