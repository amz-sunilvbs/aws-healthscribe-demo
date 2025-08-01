// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import TopNavigation from '@cloudscape-design/components/top-navigation';

import './TopNav.css';

export default function TopNav() {
    return (
        <TopNavigation
            identity={{
                href: '/',
                title: 'Naina HealthScribe',
            }}
            utilities={[]}
        />
    );
}
