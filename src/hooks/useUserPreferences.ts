// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, useEffect } from 'react';
import { UserPreferences, DEFAULT_USER_PREFERENCES, migrateNoteTemplate, migrateNoteTemplateArray } from '@/types/UserPreferences';
import { getAmplifyConfig } from '@/config/amplifyConfig';

const USER_PREFERENCES_KEY = 'user-preferences';
const USER_ID_KEY = 'anonymous-user-id';

function generateAnonymousUserId(): string {
  return `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateAnonymousUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

// Fallback localStorage functions
function loadPreferencesFromLocalStorage(): UserPreferences {
  try {
    const stored = localStorage.getItem(USER_PREFERENCES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const preferences = { ...DEFAULT_USER_PREFERENCES, ...parsed };
      
      // Apply migration for note templates
      preferences.enabledNoteTemplates = migrateNoteTemplateArray(preferences.enabledNoteTemplates);
      preferences.defaultNoteTemplate = migrateNoteTemplate(preferences.defaultNoteTemplate);
      
      return preferences;
    }
  } catch (error) {
    console.error('Error loading user preferences from localStorage:', error);
  }
  return DEFAULT_USER_PREFERENCES;
}

function savePreferencesToLocalStorage(preferences: UserPreferences): void {
  try {
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving user preferences to localStorage:', error);
  }
}

// DynamoDB API functions
async function loadPreferencesFromAPI(userId: string): Promise<UserPreferences> {
  try {
    const config = getAmplifyConfig();
    const API_BASE_URL = config?.api_url;
    
    if (!API_BASE_URL) {
      console.log('API not configured, using localStorage');
      return loadPreferencesFromLocalStorage();
    }

    const response = await fetch(`${API_BASE_URL}/preferences/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const preferences = { ...DEFAULT_USER_PREFERENCES, ...data.preferences };
      
      // Apply migration for note templates
      preferences.enabledNoteTemplates = migrateNoteTemplateArray(preferences.enabledNoteTemplates);
      preferences.defaultNoteTemplate = migrateNoteTemplate(preferences.defaultNoteTemplate);
      
      savePreferencesToLocalStorage(preferences);
      return preferences;
    } else if (response.status === 404) {
      // User preferences not found, return defaults
      return DEFAULT_USER_PREFERENCES;
    } else {
      console.error('Failed to load user preferences from API:', response.statusText);
      return loadPreferencesFromLocalStorage();
    }
  } catch (error) {
    console.error('Error loading user preferences from API:', error);
    return loadPreferencesFromLocalStorage();
  }
}

async function savePreferencesToAPI(userId: string, preferences: UserPreferences): Promise<boolean> {
  try {
    const config = getAmplifyConfig();
    const API_BASE_URL = config?.api_url;
    
    if (!API_BASE_URL) {
      console.log('API not configured, using localStorage');
      savePreferencesToLocalStorage(preferences);
      return true;
    }

    const response = await fetch(`${API_BASE_URL}/preferences/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferences }),
    });

    if (response.ok) {
      savePreferencesToLocalStorage(preferences);
      return true;
    } else {
      console.error('Failed to save user preferences to API:', response.statusText);
      savePreferencesToLocalStorage(preferences);
      return false;
    }
  } catch (error) {
    console.error('Error saving user preferences to API:', error);
    savePreferencesToLocalStorage(preferences);
    return false;
  }
}

// Main hook
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        setIsLoading(true);
        setError(null);
        
        const userId = getUserId();
        const loadedPreferences = await loadPreferencesFromAPI(userId);
        
        setPreferences(loadedPreferences);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to load user preferences:', err);
        
        // Fallback to localStorage
        const fallbackPreferences = loadPreferencesFromLocalStorage();
        setPreferences(fallbackPreferences);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  // Save preferences function
  const savePreferences = async (newPreferences: UserPreferences): Promise<boolean> => {
    try {
      setError(null);
      
      const userId = getUserId();
      const success = await savePreferencesToAPI(userId, newPreferences);
      
      if (success) {
        setPreferences(newPreferences);
        return true;
      } else {
        setError('Failed to save preferences to server');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to save user preferences:', err);
      return false;
    }
  };

  return {
    preferences,
    savePreferences,
    isLoading,
    error,
  };
}
