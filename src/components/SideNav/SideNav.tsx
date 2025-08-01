// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import SideNavigation from '@cloudscape-design/components/side-navigation';
import { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { Density, Mode, applyDensity, applyMode } from '@cloudscape-design/global-styles';

import ModalLoader from '@/components/SuspenseLoader/ModalLoader';
import { useAppThemeContext } from '@/store/appTheme';
import { useAuthContext } from '@/store/auth';

const Auth = lazy(() => import('@/components/Auth'));

export default function SideNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isUserAuthenticated, user, signOut } = useAuthContext();
    const { appTheme, setAppThemeColor, setAppThemeDensity } = useAppThemeContext();
    const [authVisible, setAuthVisible] = useState(false);
    const themeSetRef = useRef(false);

    // Set default theme to Light and Compact when user logs in (only once)
    useEffect(() => {
        if (isUserAuthenticated && !themeSetRef.current) {
            setAppThemeColor('appTheme.light');
            setAppThemeDensity('density.compact');
            themeSetRef.current = true;
        }
        if (!isUserAuthenticated) {
            themeSetRef.current = false;
        }
    }, [isUserAuthenticated]); // Remove the function dependencies

    // Apply theme changes
    useEffect(() => {
        if (appTheme.color === 'appTheme.light') {
            applyMode(Mode.Light);
        } else if (appTheme.color === 'appTheme.dark') {
            applyMode(Mode.Dark);
        }

        if (appTheme.density === 'density.comfortable') {
            applyDensity(Density.Comfortable);
        } else if (appTheme.density === 'density.compact') {
            applyDensity(Density.Compact);
        }
    }, [appTheme]);

    // Close auth modal when user authenticates
    useEffect(() => {
        if (isUserAuthenticated) {
            setAuthVisible(false);
        }
    }, [isUserAuthenticated]);

    const sideNavItems: SideNavigationProps.Item[] = [
        {
            type: 'link',
            text: 'New Encounter',
            href: '/',
        },
        {
            type: 'link',
            text: 'Encounters',
            href: '/conversations',
        },
        {
            type: 'link',
            text: 'File Upload',
            href: '/new',
        },
        { type: 'divider' },
        {
            type: 'link',
            text: 'Generate Audio',
            href: '/generate',
        },
        { type: 'divider' },
        {
            type: 'link',
            text: 'Settings',
            href: '/settings',
        },
        { type: 'divider' },
        ...(isUserAuthenticated
            ? [
                  {
                      type: 'link' as const,
                      text: 'Sign Out',
                      href: '#signout',
                  },
              ]
            : [
                  {
                      type: 'link' as const,
                      text: 'Sign In',
                      href: '#signin',
                  },
              ]),
    ];

    return (
        <>
            {authVisible && (
                <Suspense fallback={<ModalLoader />}>
                    <Auth setVisible={setAuthVisible} />
                </Suspense>
            )}
            <SideNavigation
                activeHref={`/${location.pathname.split('/')[1]}`}
                header={{ text: 'Naina HealthScribe', href: '/' }}
                items={sideNavItems}
                onFollow={(e) => {
                    e.preventDefault();
                    
                    const href = e.detail.href;
                    
                    // Handle authentication
                    if (href === '#signin') {
                        setAuthVisible(true);
                        return;
                    }
                    
                    if (href === '#signout') {
                        signOut();
                        return;
                    }
                    
                    // Handle regular navigation - don't ignore non-hash links
                    if (!href.startsWith('#')) {
                        navigate(href);
                        return;
                    }
                    
                    // Ignore other hash links
                }}
            />
        </>
    );
}
