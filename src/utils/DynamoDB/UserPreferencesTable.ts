// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * DynamoDB Table Schema for User Preferences
 * 
 * Table Name: user-preferences
 * 
 * Primary Key:
 * - PK (Partition Key): USER#{userId}
 * - SK (Sort Key): PREFERENCES
 * 
 * Attributes:
 * - preferences: JSON object containing all user preferences
 * - version: Integer for schema versioning
 * - createdAt: ISO timestamp
 * - updatedAt: ISO timestamp
 * 
 * Example Record:
 * {
 *   "PK": "USER#anonymous-1690747200000-abc123def",
 *   "SK": "PREFERENCES",
 *   "preferences": {
 *     "providerName": "Dr. John Smith",
 *     "providerSpecialty": "FAMILY_MEDICINE",
 *     "enabledNoteTemplates": ["SOAP", "GIRPP"],
 *     "defaultNoteTemplate": "SOAP",
 *     "comprehendMedicalEnabled": true,
 *     "billingCycle": "MONTHLY",
 *     "region": "us-east-1",
 *     "apiTiming": false,
 *     "defaultPlaybackSpeed": 1,
 *     "skipInterval": 5,
 *     "autoScroll": true,
 *     "defaultTab": "transcript",
 *     "smallTalkDefault": false,
 *     "silenceDefault": false,
 *     "confidenceThreshold": 75,
 *     "autoExtract": false
 *   },
 *   "version": 1,
 *   "createdAt": "2024-07-30T20:00:00.000Z",
 *   "updatedAt": "2024-07-30T20:00:00.000Z"
 * }
 */

import { UserPreferencesRecord, UserPreferences } from '@/types/UserPreferences';

export class UserPreferencesTable {
  private tableName: string;

  constructor(tableName: string = 'user-preferences') {
    this.tableName = tableName;
  }

  /**
   * Generate the partition key for a user
   */
  static getUserPK(userId: string): string {
    return `USER#${userId}`;
  }

  /**
   * Generate the sort key for preferences
   */
  static getPreferencesSK(): string {
    return 'PREFERENCES';
  }

  /**
   * Create a new user preferences record
   */
  static createRecord(userId: string, preferences: UserPreferences): UserPreferencesRecord {
    const now = new Date().toISOString();
    
    return {
      PK: this.getUserPK(userId),
      SK: this.getPreferencesSK(),
      preferences,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update an existing user preferences record
   */
  static updateRecord(
    existingRecord: UserPreferencesRecord, 
    updates: Partial<UserPreferences>
  ): UserPreferencesRecord {
    return {
      ...existingRecord,
      preferences: {
        ...existingRecord.preferences,
        ...updates,
      },
      version: existingRecord.version + 1,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * CloudFormation Template for DynamoDB Table
 * 
 * Resources:
 *   UserPreferencesTable:
 *     Type: AWS::DynamoDB::Table
 *     Properties:
 *       TableName: user-preferences
 *       BillingMode: PAY_PER_REQUEST
 *       AttributeDefinitions:
 *         - AttributeName: PK
 *           AttributeType: S
 *         - AttributeName: SK
 *           AttributeType: S
 *       KeySchema:
 *         - AttributeName: PK
 *           KeyType: HASH
 *         - AttributeName: SK
 *           KeyType: RANGE
 *       PointInTimeRecoverySpecification:
 *         PointInTimeRecoveryEnabled: true
 *       Tags:
 *         - Key: Application
 *           Value: HealthScribe
 *         - Key: Component
 *           Value: UserPreferences
 */

/**
 * API Endpoints for User Preferences
 * 
 * GET /api/preferences/{userId}
 * - Retrieve user preferences
 * - Returns: UserPreferences object
 * 
 * PUT /api/preferences/{userId}
 * - Create or replace user preferences
 * - Body: UserPreferences object
 * - Returns: Success/Error status
 * 
 * PATCH /api/preferences/{userId}
 * - Update specific preference fields
 * - Body: Partial<UserPreferences> object
 * - Returns: Updated UserPreferences object
 * 
 * DELETE /api/preferences/{userId}
 * - Delete user preferences (reset to defaults)
 * - Returns: Success/Error status
 */
