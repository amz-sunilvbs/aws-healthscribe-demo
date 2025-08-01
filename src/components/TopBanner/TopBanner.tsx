// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';

import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record';
import { MedicalScribeNoteTemplate } from '@aws-sdk/client-transcribe';

import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useS3 } from '@/hooks/useS3';
import { startMedicalScribeJob } from '@/utils/HealthScribeApi';
import { fileUpload } from '@/utils/S3Api';
import { getAmplifyConfig } from '@/config/amplifyConfig';
import { CLINICAL_NOTE_TEMPLATES, ClinicalNoteTemplate } from '@/types/UserPreferences';

import styles from './TopBanner.module.css';

export default function TopBanner() {
    const navigate = useNavigate();
    const { preferences } = useUserPreferences();
    const [bucketName, getUploadMetadata] = useS3();
    
    // Form state
    const [patientName, setPatientName] = useState('');
    const [selectedNoteType, setSelectedNoteType] = useState<ClinicalNoteTemplate>('HISTORY_AND_PHYSICAL');
    
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // WaveSurfer refs
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const recordPluginRef = useRef<RecordPlugin | null>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    
    // Timer for recording duration
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize WaveSurfer
    useEffect(() => {
        const initializeWaveSurfer = async () => {
            if (waveformContainerRef.current && !wavesurferRef.current) {
                try {
                    // Clear any existing content
                    waveformContainerRef.current.innerHTML = '';
                    
                    wavesurferRef.current = WaveSurfer.create({
                        container: waveformContainerRef.current,
                        waveColor: '#0073bb',
                        progressColor: '#005a9f',
                        height: 60,
                        barWidth: 2,
                        barGap: 1,
                        barRadius: 2,
                        normalize: true,
                        backend: 'WebAudio',
                    });

                    recordPluginRef.current = wavesurferRef.current.registerPlugin(RecordPlugin.create({
                        scrollingWaveform: true,
                        renderRecordedAudio: true,
                    }));

                    recordPluginRef.current.on('record-end', (blob: Blob) => {
                        setRecordedBlob(blob);
                        setIsRecording(false);
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                        }
                    });

                    recordPluginRef.current.on('record-start', () => {
                        console.log('Recording started');
                    });

                    recordPluginRef.current.on('record-progress', (time: number) => {
                        // This will show the waveform as recording progresses
                        console.log('Recording progress:', time);
                    });

                } catch (error) {
                    console.error('Error initializing WaveSurfer:', error);
                }
            }
        };

        // Add a small delay to ensure DOM is ready
        const timer = setTimeout(initializeWaveSurfer, 100);

        return () => {
            clearTimeout(timer);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (recordPluginRef.current) {
                recordPluginRef.current.destroy();
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    }, []);

    // Available note types based on user preferences
    const availableNoteTypes = CLINICAL_NOTE_TEMPLATES.filter(template => 
        preferences.enabledNoteTemplates.includes(template.value)
    ).map(template => ({
        label: template.label,
        value: template.value,
    }));

    const handleStartRecording = async () => {
        if (!recordPluginRef.current) {
            console.error('Record plugin not initialized');
            alert('Recording system not ready. Please refresh the page and try again.');
            return;
        }

        try {
            // Check for microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream

            setIsRecording(true);
            setRecordedBlob(null);
            setRecordingDuration(0);
            
            // Start recording
            await recordPluginRef.current.startRecording();
            
            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            console.log('Recording started successfully');
        } catch (error) {
            console.error('Error starting recording:', error);
            setIsRecording(false);
            
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    alert('Microphone access denied. Please allow microphone access and try again.');
                } else if (error.name === 'NotFoundError') {
                    alert('No microphone found. Please connect a microphone and try again.');
                } else {
                    alert(`Recording error: ${error.message}`);
                }
            } else {
                alert('Failed to start recording. Please try again.');
            }
        }
    };

    const handleStopRecording = async () => {
        if (!recordPluginRef.current || !isRecording) return;

        try {
            recordPluginRef.current.stopRecording();
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    };

    const handleSubmitJob = async () => {
        if (!recordedBlob || !patientName.trim()) {
            alert('Please provide a patient name and complete a recording first.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Create file from blob
            const audioFile = new File([recordedBlob], `${patientName}-recording.wav`, {
                type: 'audio/wav',
            });

            // Upload to S3 using Amplify Storage
            const s3Location = getUploadMetadata();
            await fileUpload({
                Bucket: s3Location.bucket,
                Key: s3Location.key,
                Body: audioFile,
                ContentType: 'audio/wav',
            });

            // Generate unique job name
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const jobName = `${patientName.replace(/\s+/g, '')}-${timestamp}`;

            // Submit HealthScribe job
            const jobParams = {
                MedicalScribeJobName: jobName,
                DataAccessRoleArn: getAmplifyConfig()?.healthscribe_service_role_arn || '',
                OutputBucketName: bucketName,
                Media: {
                    MediaFileUri: `s3://${s3Location.bucket}/${s3Location.key}`,
                },
                Settings: {
                    ShowSpeakerLabels: true,
                    MaxSpeakerLabels: 2,
                    ClinicalNoteGenerationSettings: {
                        NoteTemplate: selectedNoteType as MedicalScribeNoteTemplate,
                    },
                },
            };

            await startMedicalScribeJob(jobParams);

            // Navigate to conversations page
            navigate('/conversations');
        } catch (error) {
            console.error('Error submitting HealthScribe job:', error);
            alert('Failed to submit HealthScribe job. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Box padding={{ top: 'xs', bottom: 'l' }}>
            <Grid
                gridDefinition={[
                    { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }, 
                    { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }
                ]}
            >
                {/* Left Side - Recording Interface */}
                <SpaceBetween size="xl">
                    {/* Recording Interface */}
                    <Container>
                        <SpaceBetween size="m">
                            <Box variant="h3" fontWeight="bold">
                                Audio Recording
                            </Box>
                            
                            {/* Waveform Display */}
                            <div className={styles.waveformContainer}>
                                <div ref={waveformContainerRef} className={styles.waveform} />
                                {!isRecording && !recordedBlob && (
                                    <div className={styles.waveformPlaceholder}>
                                        Click "Start Recording" to begin audio capture
                                    </div>
                                )}
                                {isRecording && (
                                    <Box textAlign="center" padding={{ top: 's' }}>
                                        <StatusIndicator type="in-progress">
                                            <span className={styles.recordingInProgress}>
                                                Recording: {formatDuration(recordingDuration)}
                                            </span>
                                        </StatusIndicator>
                                    </Box>
                                )}
                                {recordedBlob && !isRecording && (
                                    <Box textAlign="center" padding={{ top: 's' }}>
                                        <StatusIndicator type="success">
                                            <span className={styles.recordingComplete}>
                                                Recording complete: {formatDuration(recordingDuration)}
                                            </span>
                                        </StatusIndicator>
                                    </Box>
                                )}
                            </div>

                            {/* Recording Controls */}
                            <Box textAlign="center">
                                {!isRecording ? (
                                    <Button
                                        variant="primary"
                                        iconName="microphone"
                                        onClick={handleStartRecording}
                                        disabled={isSubmitting}
                                    >
                                        Start Recording
                                    </Button>
                                ) : (
                                    <Button
                                        variant="normal"
                                        iconName="pause"
                                        onClick={handleStopRecording}
                                    >
                                        Stop Recording
                                    </Button>
                                )}
                            </Box>
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>

                {/* Right Side - Form */}
                <Container>
                    <SpaceBetween size="l">
                        <Box variant="h3" fontWeight="bold">
                            Patient Information
                        </Box>
                        
                        <FormField label="Patient Name" stretch>
                            <Input
                                value={patientName}
                                onChange={({ detail }) => setPatientName(detail.value)}
                                placeholder="Enter patient name"
                                disabled={isSubmitting}
                            />
                        </FormField>

                        <FormField label="Note Type" stretch>
                            <Select
                                selectedOption={availableNoteTypes.find(option => option.value === selectedNoteType) || availableNoteTypes[0]}
                                onChange={({ detail }) => setSelectedNoteType(detail.selectedOption.value as ClinicalNoteTemplate)}
                                options={availableNoteTypes}
                                disabled={isSubmitting}
                            />
                        </FormField>

                        <Button
                            variant="primary"
                            onClick={handleSubmitJob}
                            disabled={!recordedBlob || !patientName.trim() || isSubmitting}
                            loading={isSubmitting}
                            fullWidth
                        >
                            {isSubmitting ? 'Submitting Job...' : 'Submit HealthScribe Job'}
                        </Button>

                        {recordedBlob && (
                            <Box variant="small" color="text-body-secondary">
                                Recording ready for submission. Click "Submit HealthScribe Job" to process.
                            </Box>
                        )}
                    </SpaceBetween>
                </Container>
            </Grid>
        </Box>
    );
}
