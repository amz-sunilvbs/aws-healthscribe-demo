// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand, 
    QueryCommand, 
    UpdateCommand,
    ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { fetchAuthSession } from 'aws-amplify/auth';

import { getAmplifyConfig } from '@/config/amplifyConfig';
import { Patient, CreatePatientRequest, UpdatePatientRequest, PatientSearchResult } from '@/types/Patient';

// Initialize DynamoDB client with Amplify credentials
const getDynamoDBClient = async () => {
    try {
        const config = await getAmplifyConfig();
        const session = await fetchAuthSession();
        
        const client = new DynamoDBClient({
            region: config?.aws_project_region || 'us-east-1',
            credentials: session.credentials,
        });
        
        return DynamoDBDocumentClient.from(client);
    } catch (error) {
        console.error('Error initializing DynamoDB client:', error);
        throw new Error('Failed to initialize database connection');
    }
};

const PATIENTS_TABLE = import.meta.env.VITE_PATIENTS_TABLE_NAME || 'NainaHealthScribe-Patients-HealthScribeFullStack-dev';

/**
 * Test function to verify DynamoDB access and table existence
 */
export const testPatientTableAccess = async (): Promise<{ success: boolean; message: string }> => {
    try {
        console.log('Testing patient table access...');
        console.log('Table name:', PATIENTS_TABLE);
        
        const client = await getDynamoDBClient();
        console.log('DynamoDB client created successfully');
        
        // Try to scan the table with a limit of 1 to test access
        const command = new ScanCommand({
            TableName: PATIENTS_TABLE,
            Limit: 1,
        });
        
        const response = await client.send(command);
        console.log('Table scan successful:', response);
        
        return {
            success: true,
            message: `Successfully connected to table ${PATIENTS_TABLE}. Found ${response.Count || 0} items.`
        };
        
    } catch (error) {
        console.error('Table access test failed:', error);
        
        let message = 'Unknown error';
        if (error instanceof Error) {
            if (error.message.includes('ResourceNotFoundException')) {
                message = `Table ${PATIENTS_TABLE} does not exist`;
            } else if (error.message.includes('AccessDeniedException')) {
                message = 'Access denied - check IAM permissions';
            } else if (error.message.includes('UnrecognizedClientException')) {
                message = 'Invalid AWS credentials';
            } else {
                message = error.message;
            }
        }
        
        return {
            success: false,
            message: `Table access failed: ${message}`
        };
    }
};

/**
 * Create a new patient for the current provider
 */
export const createPatient = async (
    providerId: string, 
    patientData: CreatePatientRequest
): Promise<Patient> => {
    const client = await getDynamoDBClient();
    const now = new Date().toISOString();
    
    const patient: Patient = {
        patientId: uuidv4(),
        providerId,
        patientName: patientData.patientName.trim(),
        dateOfBirth: patientData.dateOfBirth,
        mrn: patientData.mrn,
        phoneNumber: patientData.phoneNumber,
        email: patientData.email,
        demographics: patientData.demographics,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        encounterCount: 0,
    };

    await client.send(new PutCommand({
        TableName: PATIENTS_TABLE,
        Item: patient,
        ConditionExpression: 'attribute_not_exists(patientId)', // Prevent overwrites
    }));

    return patient;
};

/**
 * Get all active patients for a provider (with optional search)
 */
export const getProviderPatients = async (
    providerId: string,
    searchTerm?: string,
    limit: number = 50
): Promise<PatientSearchResult[]> => {
    try {
        console.log('Searching patients for provider:', providerId, 'searchTerm:', searchTerm);
        
        if (!providerId) {
            console.warn('No provider ID provided');
            return [];
        }

        const client = await getDynamoDBClient();
        console.log('DynamoDB client initialized successfully');

        // Query by providerId GSI
        const command = new QueryCommand({
            TableName: PATIENTS_TABLE,
            IndexName: 'providerId-patientName-index',
            KeyConditionExpression: 'providerId = :providerId',
            FilterExpression: 'isActive = :isActive',
            ExpressionAttributeValues: {
                ':providerId': providerId,
                ':isActive': true,
            },
            Limit: limit,
            ScanIndexForward: false, // Most recent first
        });

        console.log('Executing DynamoDB query with command:', JSON.stringify(command, null, 2));
        const response = await client.send(command);
        console.log('DynamoDB query response:', response);
        
        let patients = (response.Items || []) as Patient[];
        console.log('Found patients:', patients.length);

        // Client-side filtering for search term (in production, consider using ElasticSearch)
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            patients = patients.filter(patient => 
                patient.patientName.toLowerCase().includes(term) ||
                (patient.mrn && patient.mrn.toLowerCase().includes(term)) ||
                (patient.email && patient.email.toLowerCase().includes(term))
            );
            console.log('Filtered patients:', patients.length, 'for term:', term);
        }

        // Convert to search results
        const results = patients.map(patient => ({
            patientId: patient.patientId,
            patientName: patient.patientName,
            dateOfBirth: patient.dateOfBirth,
            mrn: patient.mrn,
            lastEncounterDate: patient.lastEncounterDate,
            encounterCount: patient.encounterCount,
        }));

        console.log('Returning patient search results:', results);
        return results;
        
    } catch (error) {
        console.error('Error in getProviderPatients:', error);
        
        // Provide more specific error information
        if (error instanceof Error) {
            if (error.message.includes('ResourceNotFoundException')) {
                throw new Error(`Patients table not found: ${PATIENTS_TABLE}`);
            } else if (error.message.includes('AccessDeniedException')) {
                throw new Error('Access denied to patients table. Check IAM permissions.');
            } else if (error.message.includes('ValidationException')) {
                throw new Error('Invalid query parameters. Check table schema.');
            }
        }
        
        throw new Error(`Failed to search patients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Get a specific patient by ID (with provider authorization)
 */
export const getPatientById = async (
    patientId: string, 
    providerId: string
): Promise<Patient | null> => {
    const client = await getDynamoDBClient();

    const response = await client.send(new GetCommand({
        TableName: PATIENTS_TABLE,
        Key: { patientId },
    }));

    const patient = response.Item as Patient;
    
    // Verify provider ownership and active status
    if (!patient || patient.providerId !== providerId || !patient.isActive) {
        return null;
    }

    return patient;
};

/**
 * Update patient information
 */
export const updatePatient = async (
    patientId: string,
    providerId: string,
    updates: UpdatePatientRequest
): Promise<Patient | null> => {
    const client = await getDynamoDBClient();
    const now = new Date().toISOString();

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {
        ':providerId': providerId,
        ':updatedAt': now,
        ':isActive': true,
    };

    // Add fields to update
    if (updates.patientName !== undefined) {
        updateExpressions.push('#patientName = :patientName');
        expressionAttributeNames['#patientName'] = 'patientName';
        expressionAttributeValues[':patientName'] = updates.patientName.trim();
    }

    if (updates.dateOfBirth !== undefined) {
        updateExpressions.push('dateOfBirth = :dateOfBirth');
        expressionAttributeValues[':dateOfBirth'] = updates.dateOfBirth;
    }

    if (updates.mrn !== undefined) {
        updateExpressions.push('mrn = :mrn');
        expressionAttributeValues[':mrn'] = updates.mrn;
    }

    if (updates.phoneNumber !== undefined) {
        updateExpressions.push('phoneNumber = :phoneNumber');
        expressionAttributeValues[':phoneNumber'] = updates.phoneNumber;
    }

    if (updates.email !== undefined) {
        updateExpressions.push('email = :email');
        expressionAttributeValues[':email'] = updates.email;
    }

    if (updates.demographics !== undefined) {
        updateExpressions.push('demographics = :demographics');
        expressionAttributeValues[':demographics'] = updates.demographics;
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('updatedAt = :updatedAt');

    const response = await client.send(new UpdateCommand({
        TableName: PATIENTS_TABLE,
        Key: { patientId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ConditionExpression: 'providerId = :providerId AND isActive = :isActive',
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }));

    return response.Attributes as Patient;
};

/**
 * Soft delete a patient (set isActive to false)
 */
export const deletePatient = async (
    patientId: string,
    providerId: string
): Promise<boolean> => {
    const client = await getDynamoDBClient();
    const now = new Date().toISOString();

    try {
        await client.send(new UpdateCommand({
            TableName: PATIENTS_TABLE,
            Key: { patientId },
            UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
            ConditionExpression: 'providerId = :providerId AND isActive = :currentActive',
            ExpressionAttributeValues: {
                ':isActive': false,
                ':updatedAt': now,
                ':providerId': providerId,
                ':currentActive': true,
            },
        }));
        return true;
    } catch (error) {
        console.error('Error deleting patient:', error);
        return false;
    }
};

/**
 * Update patient's last encounter date and increment encounter count
 */
export const updatePatientEncounterInfo = async (
    patientId: string,
    providerId: string,
    encounterDate: string
): Promise<void> => {
    const client = await getDynamoDBClient();
    const now = new Date().toISOString();

    await client.send(new UpdateCommand({
        TableName: PATIENTS_TABLE,
        Key: { patientId },
        UpdateExpression: 'SET lastEncounterDate = :encounterDate, encounterCount = encounterCount + :increment, updatedAt = :updatedAt',
        ConditionExpression: 'providerId = :providerId AND isActive = :isActive',
        ExpressionAttributeValues: {
            ':encounterDate': encounterDate,
            ':increment': 1,
            ':updatedAt': now,
            ':providerId': providerId,
            ':isActive': true,
        },
    }));
};
