// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useMemo, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Header from '@cloudscape-design/components/header';
import RadioGroup from '@cloudscape-design/components/radio-group';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import TokenGroup from '@cloudscape-design/components/token-group';

import {
    ClinicalNoteGenerationSettings,
    MedicalScribeNoteTemplate,
    MedicalScribeParticipantRole,
    StartMedicalScribeJobRequest,
} from '@aws-sdk/client-transcribe';
import { Progress } from '@aws-sdk/lib-storage';
import dayjs from 'dayjs';

import { useS3 } from '@/hooks/useS3';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useNotificationsContext } from '@/store/notifications';
import { startMedicalScribeJob } from '@/utils/HealthScribeApi';
import { fileUpload } from '@/utils/S3Api';
import sleep from '@/utils/sleep';
import { getAmplifyConfig } from '@/config/amplifyConfig';

import AudioRecorder from './AudioRecorder';
import { AudioDropzone } from './Dropzone';
import { AudioDetailSettings, AudioIdentificationType, InputName, NoteType } from './FormComponents';
import styles from './NewConversation.module.css';
import { verifyJobParams } from './formUtils';
import { AudioDetails, AudioSelection } from './types';

export default function NewEncounter() {
    const { updateProgressBar } = useNotificationsContext();
    const { preferences } = useUserPreferences();
    const navigate = useNavigate();
    const location = useLocation();

    // Get initial values from location state (passed from Welcome page)
    const locationState = location.state as {
        patientName?: string;
        noteType?: string;
        notes?: string;
        uploadMode?: boolean;
    } | null;

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // is job submitting
    const [formError, setFormError] = useState<string | React.ReactElement[]>('');
    const [jobName, setJobName] = useState<string>(locationState?.patientName || ''); // form - job name
    const [noteType, setNoteType] = useState<MedicalScribeNoteTemplate>(
        (locationState?.noteType as MedicalScribeNoteTemplate) || 
        (preferences.defaultNoteTemplate as MedicalScribeNoteTemplate) || 
        'HISTORY_AND_PHYSICAL'
    ); // form - note type
    const [audioSelection, setAudioSelection] = useState<AudioSelection>('speakerPartitioning'); // form - audio selection
    // form - audio details
    const [audioDetails, setAudioDetails] = useState<AudioDetails>({
        speakerPartitioning: {
            maxSpeakers: 2,
        },
        channelIdentification: {
            channel1: 'CLINICIAN',
        },
    });
    const [filePath, setFilePath] = useState<File>(); // only one file is allowed from react-dropzone. NOT an array
    const [outputBucket, getUploadMetadata] = useS3(); // outputBucket is the Amplify bucket, and uploadMetadata contains uuid4

    const [submissionMode, setSubmissionMode] = useState<string>(
        locationState?.uploadMode ? 'uploadAudio' : 'uploadAudio'
    ); // to hide or show the live recorder
    const [recordedAudio, setRecordedAudio] = useState<File | undefined>(); // audio file recorded via live recorder

    // Initialize submission mode based on location state
    useEffect(() => {
        if (locationState?.uploadMode) {
            setSubmissionMode('uploadAudio');
        }
    }, [locationState]);

    // Set array for TokenGroup items
    const fileToken = useMemo(() => {
        if (!filePath) {
            return undefined;
        } else {
            return {
                label: filePath.name,
                description: `Size: ${Number((filePath.size / 1000).toFixed(2)).toLocaleString()} kB`,
            };
        }
    }, [filePath]);

    /**
     * @description Callback function used by the lib-storage SDK Upload function. Updates the progress bar
     *              with the status of the upload
     * @param loaded {number} number of bytes uploaded
     * @param total {number} total number of bytes to be uploaded
     */
    function s3UploadCallback({ loaded, total }: Progress) {
        // Last 1% is for submitting to the HealthScribe API
        const value = Math.round(((loaded || 1) / (total || 100)) * 99);
        const loadedMb = Math.round((loaded || 1) / 1024 / 1024);
        const totalMb = Math.round((total || 1) / 1024 / 1024);
        updateProgressBar({
            id: `New HealthScribe Job: ${jobName}`,
            value: value,
            description: `Uploaded ${loadedMb}MB / ${totalMb}MB`,
        });
    }

    /**
     * @description Submit the form to create a new HealthScribe job
     */
    async function submitJob(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError('');

        const clinicalNoteGenerationSettings: ClinicalNoteGenerationSettings = {
            NoteTemplate: noteType,
        };

        // build job params with StartMedicalScribeJob request syntax
        const jobSettings =
            audioSelection === 'speakerPartitioning'
                ? {
                      Settings: {
                          ClinicalNoteGenerationSettings: clinicalNoteGenerationSettings,
                          MaxSpeakerLabels: audioDetails.speakerPartitioning.maxSpeakers,
                          ShowSpeakerLabels: true,
                      },
                  }
                : {
                      Settings: {
                          ChannelIdentification: true,
                          ClinicalNoteGenerationSettings: clinicalNoteGenerationSettings,
                      },
                      ChannelDefinitions: [
                          {
                              ChannelId: 0,
                              ParticipantRole: audioDetails.channelIdentification
                                  .channel1 as MedicalScribeParticipantRole,
                          },
                          {
                              ChannelId: 1,
                              ParticipantRole:
                                  audioDetails.channelIdentification.channel1 === 'CLINICIAN'
                                      ? 'PATIENT'
                                      : ('CLINICIAN' as MedicalScribeParticipantRole),
                          },
                      ],
                  };

        const uploadLocation = getUploadMetadata();
        const s3Location = {
            Bucket: uploadLocation.bucket,
            Key: `${uploadLocation.key}/${(filePath as File).name}`,
        };

        const jobParams: StartMedicalScribeJobRequest = {
            MedicalScribeJobName: jobName,
            DataAccessRoleArn: getAmplifyConfig()?.healthscribe_service_role_arn || '',
            OutputBucketName: outputBucket,
            Media: {
                MediaFileUri: `s3://${s3Location.Bucket}/${s3Location.Key}`,
            },
            ...jobSettings,
        };

        const verifyParamResults = verifyJobParams(jobParams);
        if (!verifyParamResults.verified) {
            setFormError(verifyParamResults.message);
            setIsSubmitting(false);
            return;
        }

        // Scroll to top
        window.scrollTo(0, 0);

        // Add initial progress flash message
        updateProgressBar({
            id: `New HealthScribe Job: ${jobName}`,
            value: 0,
            description: 'Upload to S3 in progress...',
        });

        try {
            await fileUpload({
                ...s3Location,
                Body: filePath as File,
                ContentType: filePath?.type,
                callbackFn: s3UploadCallback,
            });
        } catch (e) {
            updateProgressBar({
                id: `New HealthScribe Job: ${jobName}`,
                type: 'error',
                value: 0,
                description: 'Uploading files to S3 failed',
                additionalInfo: `Error uploading ${filePath!.name}: ${(e as Error).message}`,
            });
            setIsSubmitting(false);
            throw e;
        }

        try {
            const startJob = await startMedicalScribeJob(jobParams);
            if (startJob?.MedicalScribeJob?.MedicalScribeJobStatus) {
                updateProgressBar({
                    id: `New HealthScribe Job: ${jobName}`,
                    type: 'success',
                    value: 100,
                    description: 'HealthScribe job submitted',
                    additionalInfo: `Audio file successfully uploaded to S3 and submitted to HealthScribe at ${dayjs(
                        startJob.MedicalScribeJob.StartTime
                    ).format('MM/DD/YYYY hh:mm A')}. Redirecting to encounter list in 5 seconds.`,
                });
                await sleep(5000);
                navigate('/conversations');
            } else {
                updateProgressBar({
                    id: `New HealthScribe Job: ${jobName}`,
                    type: 'info',
                    value: 100,
                    description: 'Unable to confirm HealthScribe job submission',
                    additionalInfo: `Response from HealthScribe: ${JSON.stringify(startJob)}`,
                });
            }
        } catch (e) {
            updateProgressBar({
                id: `New HealthScribe Job: ${jobName}`,
                type: 'error',
                value: 0,
                description: 'Submitting job to HealthScribe failed',
                additionalInfo: `Error submitting job to HealthScribe: ${(e as Error).message}`,
            });
            setIsSubmitting(false);
            throw e;
        }

        setIsSubmitting(false);
    }

    useEffect(() => {
        setFilePath(recordedAudio);
    }, [recordedAudio]);

    return (
        <ContentLayout
            headerVariant={'high-contrast'}
            header={
                <Header
                    description="Upload your audio file to be processed by Naina HealthScribe"
                    variant="awsui-h1-sticky"
                >
                    Upload Audio File
                </Header>
            }
        >
            <Container>
                <form onSubmit={(e) => submitJob(e)}>
                    <Form
                        errorText={formError}
                        actions={
                            <SpaceBetween direction="horizontal" size="xs">
                                {isSubmitting ? (
                                    <Button formAction="submit" variant="primary" disabled={true}>
                                        <Spinner />
                                    </Button>
                                ) : (
                                    <Button formAction="submit" variant="primary" disabled={!filePath}>
                                        Submit
                                    </Button>
                                )}
                            </SpaceBetween>
                        }
                    >
                        <SpaceBetween direction="vertical" size="xl">
                            {/* Patient Name and Note Type in one row */}
                            <Grid gridDefinition={[
                                { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } },
                                { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }
                            ]}>
                                <InputName jobName={jobName} setJobName={setJobName} />
                                <NoteType noteType={noteType} setNoteType={setNoteType} />
                            </Grid>

                            {/* File Upload Section */}
                            <FormField label="Select Files">
                                <div style={{ width: '100%' }}>
                                    <AudioDropzone setFilePath={setFilePath} setFormError={setFormError} />
                                </div>
                                <TokenGroup
                                    i18nStrings={{
                                        limitShowFewer: 'Show fewer files',
                                        limitShowMore: 'Show more files',
                                    }}
                                    onDismiss={() => {
                                        setFilePath(undefined);
                                    }}
                                    items={fileToken ? [fileToken] : []}
                                    alignment="vertical"
                                    limit={1}
                                />
                            </FormField>
                        </SpaceBetween>
                    </Form>
                </form>
            </Container>
        </ContentLayout>
    );
}
