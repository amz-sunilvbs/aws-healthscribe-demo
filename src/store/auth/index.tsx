import React, { createContext, useContext, useEffect, useState } from 'react';

import { useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { AuthUser } from 'aws-amplify/auth';

import { loadAmplifyConfig, AmplifyConfig } from '@/config/amplifyConfig';

type AuthContextType = {
    isUserAuthenticated: boolean;
    user: AuthUser | null;
    signOut: () => void;
    isConfigLoaded: boolean;
};

export const AuthContext = createContext<AuthContextType>({
    isUserAuthenticated: false,
    user: null,
    signOut: () => {},
    isConfigLoaded: false,
});

export function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthContextProvider');
    }
    return context;
}

export default function AuthContextProvider({ children }: { children: React.ReactElement }) {
    const { authStatus, user, signOut } = useAuthenticator((context) => [context.user]);

    const authContextValue = {
        isUserAuthenticated: authStatus === 'authenticated',
        user: user,
        signOut: signOut,
        isConfigLoaded: true, // Since we're inside ConfigLoader, config is always loaded
    };

    return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
}
