const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.USER_PREFERENCES_TABLE_NAME;

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
};

// Default user preferences
const DEFAULT_PREFERENCES = {
    providerName: '',
    providerSpecialty: 'FAMILY_MEDICINE',
    enabledNoteTemplates: ['HISTORY_AND_PHYSICAL', 'GIRPP', 'BIRP', 'SIRP', 'DAP', 'BH_SOAP', 'PH_SOAP'],
    defaultNoteTemplate: 'HISTORY_AND_PHYSICAL',
    comprehendMedicalEnabled: true,
    billingCycle: 'MONTHLY',
    region: 'us-east-1',
    apiTiming: false,
    defaultPlaybackSpeed: 1,
    skipInterval: 5,
    autoScroll: true,
    defaultTab: 'transcript',
    smallTalkDefault: false,
    silenceDefault: false,
    confidenceThreshold: 75,
    autoExtract: false,
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod, pathParameters, body } = event;
        const userId = pathParameters?.userId || 'anonymous-user';
        
        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'CORS preflight successful' })
            };
        }
        
        switch (httpMethod) {
            case 'GET':
                return await getPreferences(userId);
            case 'PUT':
                return await createOrUpdatePreferences(userId, JSON.parse(body || '{}'));
            case 'PATCH':
                return await updatePreferences(userId, JSON.parse(body || '{}'));
            case 'DELETE':
                return await deletePreferences(userId);
            default:
                return {
                    statusCode: 405,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Method not allowed' })
                };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

async function getPreferences(userId) {
    try {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES'
            }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (result.Item) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify(result.Item.preferences)
            };
        } else {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify(DEFAULT_PREFERENCES)
            };
        }
    } catch (error) {
        console.error('Error getting preferences:', error);
        throw error;
    }
}

async function createOrUpdatePreferences(userId, preferences) {
    try {
        const now = new Date().toISOString();
        
        const params = {
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES',
                preferences: { ...DEFAULT_PREFERENCES, ...preferences },
                version: 1,
                createdAt: now,
                updatedAt: now
            }
        };
        
        await dynamodb.put(params).promise();
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                message: 'Preferences saved successfully',
                preferences: params.Item.preferences
            })
        };
    } catch (error) {
        console.error('Error creating/updating preferences:', error);
        throw error;
    }
}

async function updatePreferences(userId, updates) {
    try {
        const getParams = {
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES'
            }
        };
        
        const existing = await dynamodb.get(getParams).promise();
        let currentPreferences = existing.Item ? existing.Item.preferences : DEFAULT_PREFERENCES;
        let currentVersion = existing.Item ? existing.Item.version : 0;
        
        const updatedPreferences = { ...currentPreferences, ...updates };
        
        const updateParams = {
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES',
                preferences: updatedPreferences,
                version: currentVersion + 1,
                createdAt: existing.Item ? existing.Item.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
        
        await dynamodb.put(updateParams).promise();
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                message: 'Preferences updated successfully',
                preferences: updatedPreferences
            })
        };
    } catch (error) {
        console.error('Error updating preferences:', error);
        throw error;
    }
}

async function deletePreferences(userId) {
    try {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PREFERENCES'
            }
        };
        
        await dynamodb.delete(params).promise();
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Preferences deleted successfully' })
        };
    } catch (error) {
        console.error('Error deleting preferences:', error);
        throw error;
    }
}
