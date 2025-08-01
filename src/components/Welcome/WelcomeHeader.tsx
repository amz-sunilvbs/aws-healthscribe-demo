// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { Suspense, lazy, useMemo, useState, useEffect, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import Autosuggest from '@cloudscape-design/components/autosuggest';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Grid from '@cloudscape-design/components/grid';
import Icon from '@cloudscape-design/components/icon';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';

import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record';
import { MedicalScribeNoteTemplate } from '@aws-sdk/client-transcribe';

import ModalLoader from '@/components/SuspenseLoader/ModalLoader';
import { PatientAutosuggest } from '@/components/PatientManagement/PatientAutosuggest';
import { useAuthContext } from '@/store/auth';
import { useS3 } from '@/hooks/useS3';
import { useNotificationsContext } from '@/store/notifications';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { startMedicalScribeJob } from '@/utils/HealthScribeApi';
import { fileUpload } from '@/utils/S3Api';
import { getAmplifyConfig } from '@/config/amplifyConfig';
import { CLINICAL_NOTE_TEMPLATES } from '@/types/UserPreferences';
import { PatientSearchResult } from '@/types/Patient';
import { updatePatientEncounterInfo, createPatient } from '@/utils/PatientApi';

const Auth = lazy(() => import('@/components/Auth'));

const PLAYBACK_SPEEDS: number[] = [0.5, 1, 1.2, 1.5, 2];

export default function WelcomeHeader() {
    const navigate = useNavigate();
    const { isUserAuthenticated, user } = useAuthContext();
    const { updateProgressBar } = useNotificationsContext();
    const [outputBucket, getUploadMetadata] = useS3();
    const [authVisible, setAuthVisible] = useState(false);
    
    // Form state for the quick start interface
    const [patientName, setPatientName] = useState<string>('New Encounter');
    const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
    const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | undefined>();
    const [noteType, setNoteType] = useState({ label: 'SOAP', value: 'SOAP' });

    // Waveform and recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Audio playback state
    const [playingAudio, setPlayingAudio] = useState(false);
    const [playBackSpeed, setPlayBackSpeed] = useState(1); // Index for PLAYBACK_SPEEDS array
    
    // WaveSurfer refs
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const recordPluginRef = useRef<RecordPlugin | null>(null);
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const noteTypeOptions = [
        { label: 'SOAP', value: 'SOAP' },
        { label: 'Consultation', value: 'Consultation' },
        { label: 'Progress Note', value: 'ProgressNote' },
        { label: 'Discharge Summary', value: 'DischargeSummary' }
    ];

    // Initialize WaveSurfer
    useEffect(() => {
        if (!isUserAuthenticated || !waveformContainerRef.current) return;

        const initializeWaveSurfer = () => {
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }

            try {
                const wavesurfer = WaveSurfer.create({
                    container: waveformContainerRef.current!,
                    waveColor: '#4285f4',
                    progressColor: '#1a73e8',
                    cursorColor: '#1a73e8',
                    height: 60,
                    normalize: true,
                    fillParent: true,
                });

                // Add playback event listeners
                wavesurfer.on('play', () => setPlayingAudio(true));
                wavesurfer.on('pause', () => setPlayingAudio(false));
                wavesurfer.on('finish', () => setPlayingAudio(false));

                const recordPlugin = wavesurfer.registerPlugin(RecordPlugin.create({
                    renderRecordedAudio: true,
                    scrollingWaveform: false,
                    continuousWaveform: true,
                }));

                recordPlugin.on('record-start', () => {
                    console.log('Recording started');
                    setIsRecording(true);
                    setRecordedBlob(null);
                    setRecordingDuration(0);
                    
                    // Start manual timer for more reliable updates
                    timerRef.current = setInterval(() => {
                        setRecordingDuration(prev => prev + 1);
                    }, 1000);
                });

                recordPlugin.on('record-end', (blob: Blob) => {
                    console.log('Recording ended, blob size:', blob.size);
                    setRecordedBlob(blob);
                    setIsRecording(false);
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                    }
                });

                wavesurferRef.current = wavesurfer;
                recordPluginRef.current = recordPlugin;
            } catch (error) {
                console.error('Error initializing WaveSurfer:', error);
            }
        };

        const timer = setTimeout(initializeWaveSurfer, 100);

        return () => {
            clearTimeout(timer);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (recordPluginRef.current) {
                recordPluginRef.current.destroy();
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
                wavesurferRef.current = null;
            }
        };
    }, [isUserAuthenticated]);

    // Close auth modal when user authenticates
    useEffect(() => {
        if (isUserAuthenticated) {
            setAuthVisible(false);
        }
    }, [isUserAuthenticated]);

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

            // Start recording - the record-start event will handle state updates
            await recordPluginRef.current.startRecording();
            
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
            console.log('Recording stopped');
        } catch (error) {
            console.error('Error stopping recording:', error);
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    function handleUploadFile() {
        navigate('/new', { 
            state: { 
                patientName, 
                noteType: noteType.value,
                uploadMode: true 
            } 
        });
    }

    const handleStartTranscription = async () => {
        if (!recordedBlob) {
            alert('Please complete a recording first.');
            return;
        }

        if (!patientName.trim()) {
            alert('Please provide a patient name.');
            return;
        }

        setIsSubmitting(true);

        // Generate job name once at the beginning
        const jobName = `${patientName.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;

        try {
            // Create file from blob with proper filename
            const fileName = `${patientName.replace(/[^a-zA-Z0-9]/g, '')}-recording.wav`;
            const audioFile = new File([recordedBlob], fileName, {
                type: 'audio/wav',
            });

            // Get S3 upload location (same as New Encounter page)
            const uploadLocation = getUploadMetadata();
            const s3Location = {
                Bucket: uploadLocation.bucket,
                Key: `${uploadLocation.key}/${fileName}`,
            };

            // Add initial progress flash message
            updateProgressBar({
                id: `New HealthScribe Job: ${jobName}`,
                value: 0,
                description: 'Upload to S3 in progress...',
            });

            // Create callback function with fixed job name
            const uploadCallback = ({ loaded, total }: { loaded?: number; total?: number }) => {
                const value = Math.round(((loaded || 1) / (total || 100)) * 99);
                const loadedMb = Math.round((loaded || 1) / 1024 / 1024);
                const totalMb = Math.round((total || 100) / 1024 / 1024);

                updateProgressBar({
                    id: `New HealthScribe Job: ${jobName}`,
                    value: value,
                    description: `Uploading audio file: ${loadedMb} MB / ${totalMb} MB`,
                });
            };

            // Upload to S3 using the same structure as New Encounter page
            await fileUpload({
                ...s3Location,
                Body: audioFile,
                ContentType: audioFile.type,
                callbackFn: uploadCallback,
            });

            // Update progress bar for HealthScribe submission
            updateProgressBar({
                id: `New HealthScribe Job: ${jobName}`,
                value: 99,
                description: 'Submitting job to HealthScribe...',
            });

            const amplifyConfig = await getAmplifyConfig();

            // Submit to HealthScribe with same structure as New Encounter page
            const jobParams = {
                MedicalScribeJobName: jobName,
                DataAccessRoleArn: amplifyConfig?.healthscribe_service_role_arn || '',
                OutputBucketName: outputBucket,
                Media: {
                    MediaFileUri: `s3://${s3Location.Bucket}/${s3Location.Key}`,
                },
                Settings: {
                    ShowSpeakerLabels: true,
                    MaxSpeakerLabels: 2,
                    ChannelIdentification: false,
                },
                ClinicalNoteSettings: {
                    NoteTemplate: noteType.value as MedicalScribeNoteTemplate,
                },
            };

            const startJob = await startMedicalScribeJob(jobParams);
            
            if (startJob?.MedicalScribeJob?.MedicalScribeJobStatus) {
                updateProgressBar({
                    id: `New HealthScribe Job: ${jobName}`,
                    type: 'success',
                    value: 100,
                    description: 'Job submitted successfully!',
                });

                // Update patient encounter info if we have a selected patient
                if (selectedPatientId && user?.username) {
                    try {
                        await updatePatientEncounterInfo(
                            selectedPatientId,
                            user.username,
                            new Date().toISOString()
                        );
                    } catch (error) {
                        console.warn('Failed to update patient encounter info:', error);
                        // Don't fail the whole operation for this
                    }
                } else if (user?.username && patientName && patientName !== 'New Encounter') {
                    // Auto-create patient record if none selected but name provided
                    try {
                        console.log('Auto-creating patient record for:', patientName);
                        const newPatient = await createPatient(user.username, {
                            patientName: patientName.trim(),
                        });
                        
                        await updatePatientEncounterInfo(
                            newPatient.patientId,
                            user.username,
                            new Date().toISOString()
                        );
                        
                        console.log('Auto-created patient and updated encounter info');
                    } catch (error) {
                        console.warn('Failed to auto-create patient:', error);
                        // Don't fail the whole operation for this
                    }
                }

                // Navigate to the encounters list page
                navigate('/conversations');
            } else {
                throw new Error('Failed to start HealthScribe job');
            }

        } catch (error) {
            console.error('Error submitting HealthScribe job:', error);
            updateProgressBar({
                id: `New HealthScribe Job: ${jobName}`,
                type: 'error',
                value: 0,
                description: 'Failed to submit transcription job',
                additionalInfo: `Error: ${error}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    function handleViewEncounters() {
        navigate('/conversations');
    }

    // Handle patient selection from autosuggest
    const handlePatientChange = (name: string, patientId?: string) => {
        setPatientName(name);
        setSelectedPatientId(patientId);
    };

    const handlePatientSelect = (patient: PatientSearchResult) => {
        setSelectedPatient(patient);
        setSelectedPatientId(patient.patientId);
    };

    // Format recording duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {authVisible && (
                <Suspense fallback={<ModalLoader />}>
                    <Auth setVisible={setAuthVisible} />
                </Suspense>
            )}
            <Box padding={{ top: 'xs', bottom: 'l' }}>
                {isUserAuthenticated ? (
                    // Authenticated user - Quick Start Interface (matching WelcomeTopSection.png)
                    <Container>
                        <SpaceBetween size="l">
                            {/* Top Row - Patient Name and Note Type */}
                            <Grid gridDefinition={[
                                { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } },
                                { colspan: { default: 12, xs: 6, s: 6, m: 6, l: 6 } }
                            ]}>
                                <PatientAutosuggest
                                    value={patientName}
                                    onChange={handlePatientChange}
                                    onPatientSelect={handlePatientSelect}
                                    placeholder="Enter patient name"
                                    disabled={isSubmitting}
                                />

                                <FormField label="Note Type">
                                    <Select
                                        selectedOption={noteType}
                                        onChange={({ detail }) => setNoteType(detail.selectedOption as { label: string; value: string })}
                                        options={noteTypeOptions}
                                        placeholder="Select note type"
                                    />
                                </FormField>
                            </Grid>

                            {/* Button Row - All buttons on same line: Recording left, Transcription/View/Upload right */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                width: '100%',
                                gap: '16px'
                            }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button 
                                        variant="primary" 
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                        disabled={!patientName.trim()}
                                    >
                                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                                    </Button>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button 
                                        variant="primary" 
                                        onClick={handleStartTranscription}
                                        disabled={!recordedBlob || !patientName.trim() || isSubmitting}
                                        loading={isSubmitting}
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Start Transcription'}
                                    </Button>
                                    <Button 
                                        variant="link" 
                                        onClick={handleViewEncounters}
                                        disabled={isSubmitting}
                                    >
                                        View Existing Encounters
                                    </Button>
                                    <Button 
                                        variant="normal" 
                                        onClick={handleUploadFile}
                                    >
                                        Upload File
                                    </Button>
                                </div>
                            </div>

                            {/* Waveform Section */}
                            <Box>
                                <div 
                                    ref={waveformContainerRef}
                                    style={{
                                        width: '100%',
                                        height: '80px',
                                        border: '1px solid #d5dbdb',
                                        borderRadius: '8px',
                                        backgroundColor: '#fafbfc',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                />
                                
                                {/* Audio Controls - Only show when audio is recorded */}
                                {recordedBlob && (
                                    <Box padding={{ top: 'xs' }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '12px',
                                            }}
                                        >
                                            <Button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    wavesurferRef.current?.skip(-5);
                                                }}
                                                disabled={!recordedBlob}
                                            >
                                                <Icon name="undo" />
                                            </Button>
                                            
                                            {playingAudio ? (
                                                <Button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        wavesurferRef.current?.pause();
                                                    }}
                                                    disabled={!recordedBlob}
                                                >
                                                    <Icon name="view-full" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        wavesurferRef.current?.play();
                                                    }}
                                                    disabled={!recordedBlob}
                                                >
                                                    <Icon name="caret-right-filled" />
                                                </Button>
                                            )}
                                            
                                            <Button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    const newSpeed = playBackSpeed === PLAYBACK_SPEEDS.length - 1 ? 0 : playBackSpeed + 1;
                                                    wavesurferRef.current?.setPlaybackRate(PLAYBACK_SPEEDS[newSpeed]);
                                                    setPlayBackSpeed(newSpeed);
                                                }}
                                                disabled={!recordedBlob}
                                            >
                                                {PLAYBACK_SPEEDS[playBackSpeed]}x
                                            </Button>

                                            <Button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    wavesurferRef.current?.skip(5);
                                                }}
                                                disabled={!recordedBlob}
                                            >
                                                <Icon name="redo" />
                                            </Button>

                                            {recordedBlob && (
                                                <a
                                                    href={URL.createObjectURL(recordedBlob)}
                                                    download={`${patientName || 'recording'}.wav`}
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <Button>
                                                        <Icon name="download" />
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    </Box>
                                )}
                                
                                {/* Status display */}
                                <Box 
                                    padding={{ top: 'xs' }} 
                                    textAlign="center"
                                >
                                    {!isRecording && !recordedBlob && (
                                        <Box color="text-body-secondary" fontSize="body-s">
                                            Click "Start Recording" to begin audio capture
                                        </Box>
                                    )}
                                    {isRecording && (
                                        <Box color="text-status-error" fontSize="body-s" fontWeight="bold">
                                            🔴 Recording... {formatDuration(recordingDuration)}
                                        </Box>
                                    )}
                                    {!isRecording && recordedBlob && (
                                        <Box color="text-status-success" fontSize="body-s" fontWeight="bold">
                                            ✅ Recording completed ({formatDuration(recordingDuration)})
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </SpaceBetween>
                    </Container>
                ) : (
                    // Unauthenticated user - Welcome Message
                    <Grid
                        gridDefinition={[{ colspan: { default: 12, xs: 7, s: 8 } }, { colspan: { default: 12, xs: 5, s: 4 } }]}
                    >
                        <SpaceBetween size="xl">
                            <Box fontSize="display-l" fontWeight="bold">
                                Demo Application Experience
                            </Box>
                            <Box fontSize="display-l">Powered by Naina HealthScribe</Box>
                        </SpaceBetween>

                        <div>
                            <Container>
                                <SpaceBetween size="l">
                                    <Box variant="h1" fontWeight="heavy" padding="n" fontSize="heading-m">
                                        Welcome to Naina HealthScribe
                                    </Box>
                                    <Box variant="p">
                                        Sign in to access the full functionality of the demo application, including recording audio, uploading audio files, viewing existing encounters, and generating synthetic audio.
                                    </Box>
                                    <Button variant="primary" onClick={() => setAuthVisible(true)}>
                                        Sign In
                                    </Button>
                                </SpaceBetween>
                            </Container>
                        </div>
                    </Grid>
                )}
            </Box>
        </>
    );
}
