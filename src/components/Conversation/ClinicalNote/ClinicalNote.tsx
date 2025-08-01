// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import TextContent from '@cloudscape-design/components/text-content';

import { MedicalScribeJob } from '@aws-sdk/client-transcribe';

import { IHealthScribeSummary } from '@/types/HealthScribeSummary';

import LoadingContainer from '../Common/LoadingContainer';

type ClinicalNoteProps = {
    jobLoading: boolean;
    jobDetails: MedicalScribeJob | null;
    summary: IHealthScribeSummary | undefined;
};

export default function ClinicalNote({ jobLoading, jobDetails, summary }: ClinicalNoteProps) {
    if (jobLoading) {
        return <LoadingContainer containerTitle="Clinical Note" />;
    }

    if (!summary) {
        return (
            <Container>
                <Box textAlign="center" color="text-status-inactive">
                    No clinical documentation available
                </Box>
            </Container>
        );
    }

    // Get the note template from job details
    const getNoteType = () => {
        const noteTemplate = jobDetails?.Settings?.ClinicalNoteGenerationSettings?.NoteTemplate;
        
        console.log('Note template from job details:', noteTemplate);
        
        if (noteTemplate) {
            // Map the template to a readable format
            switch (noteTemplate) {
                case 'HISTORY_AND_PHYSICAL':
                    return 'History and Physical';
                case 'GIRPP':
                    return 'GIRPP Note';
                case 'BIRP' as any:
                    return 'BIRP Note';
                case 'SIRP' as any:
                    return 'SIRP Note';
                case 'DAP' as any:
                    return 'DAP Note';
                case 'BH_SOAP' as any:
                    return 'BH-SOAP Note';
                case 'PH_SOAP' as any:
                    return 'PH-SOAP Note';
                default:
                    return `${noteTemplate} Note`;
            }
        }
        
        // Fallback to generic if not specified
        return 'Clinical Note';
    };

    const noteType = getNoteType();

    return (
        <Container
            header={
                <Header 
                    variant="h2"
                    description="Structured clinical documentation generated from the conversation"
                >
                    {noteType}
                </Header>
            }
        >
            <TextContent>
                <SpaceBetween size="l" direction="vertical">
                    {summary.ClinicalDocumentation.Sections.map((section, index) => (
                        <div key={index}>
                            <h3>{section.SectionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                            <div style={{ marginLeft: '16px' }}>
                                {section.Summary.map((item, itemIndex) => (
                                    <p key={itemIndex} style={{ marginBottom: '8px', lineHeight: '1.5' }}>
                                        {item.SummarizedSegment}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </SpaceBetween>
            </TextContent>
        </Container>
    );
}
