// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { RefObject, useEffect, useMemo, useState } from 'react';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import Container from '@cloudscape-design/components/container';
import Icon from '@cloudscape-design/components/icon';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import { MedicalScribeJob } from '@aws-sdk/client-transcribe';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

import { useNotificationsContext } from '@/store/notifications';
import { IHealthScribeTranscript } from '@/types/HealthScribeTranscript';
import { getPresignedUrl, getS3Object } from '@/utils/S3Api';

import AudioControls from '../../Common/AudioControls';
import { SmallTalkList } from '../types';
import styles from './TopPanel.module.css';
import { extractRegions } from './extractRegions';

type TopPanelProps = {
    jobLoading: boolean;
    jobDetails: MedicalScribeJob | null;
    transcript: IHealthScribeTranscript | undefined;
    wavesurfer: RefObject<WaveSurfer | undefined>;
    smallTalkCheck: boolean;
    setSmallTalkCheck: React.Dispatch<React.SetStateAction<boolean>>;
    setAudioTime: React.Dispatch<React.SetStateAction<number>>;
    setAudioReady: React.Dispatch<React.SetStateAction<boolean>>;
};
export default function TopPanel({
    jobLoading,
    jobDetails,
    transcript,
    wavesurfer,
    smallTalkCheck,
    setSmallTalkCheck,
    setAudioTime,
    setAudioReady,
}: TopPanelProps) {
    const { addFlashMessage } = useNotificationsContext();
    const [wavesurferRegions, setWavesurferRegions] = useState<RegionsPlugin>();
    const [audioLoading, setAudioLoading] = useState<boolean>(true); // is audio file loading
    const [showControls, setShowControls] = useState<boolean>(false); // show/hide audio controls
    const [playingAudio, setPlayingAudio] = useState<boolean>(false); // is audio playing
    const [playBackSpeed, setPlayBackSpeed] = useState<number>(1); // playback speed
    const [silenceChecked, setSilenceChecked] = useState<boolean>(false); // show/hide silence
    const [silencePeaks, setSilencePeaks] = useState<number[]>([]); // silence peaks
    const [silencePercent, setSilencePercent] = useState<number>(0); // silence percentage
    const [smallTalkPercent, setSmallTalkPercent] = useState<number>(0); // small talk percentage

    const waveformElement = document.getElementById('waveform'); // wavesurfer.js wrapper element

    // Get small talk from HealthScribe transcript
    const smallTalkList: SmallTalkList = useMemo(() => {
        if (!transcript) return [];
        const transcriptSegments = transcript!.Conversation.TranscriptSegments;
        if (transcriptSegments.length > 0) {
            const stList = [];
            for (const { SectionDetails, BeginAudioTime, EndAudioTime } of transcriptSegments) {
                if (['OTHER', 'SMALL_TALK'].includes(SectionDetails.SectionName)) {
                    stList.push({ BeginAudioTime, EndAudioTime });
                }
            }
            return stList;
        } else {
            return [];
        }
    }, [transcript]);

    function checkAudioUrl() {
        if (!jobDetails?.Media?.MediaFileUri) {
            throw Error('Unable to find HealthScribe audio URL');
        }
    }

    // Download audio from S3 and initialize waveform
    useEffect(() => {
        async function getAudio() {
            try {
                checkAudioUrl();
                const s3Object = getS3Object(jobDetails?.Media?.MediaFileUri as string);
                const s3PresignedUrl = await getPresignedUrl(s3Object);

                // Initialize Wavesurfer with presigned S3 URL
                if (!wavesurfer.current) {
                    wavesurfer.current = WaveSurfer.create({
                        backend: 'MediaElement',
                        container: waveformElement || '#waveform',
                        height: 40,
                        normalize: false,
                        waveColor: 'rgba(35, 47, 62, 0.8)',
                        progressColor: '#2074d5',
                        url: s3PresignedUrl,
                    });

                    setWavesurferRegions(wavesurfer.current.registerPlugin(RegionsPlugin.create()));
                }
                // Disable spinner when Wavesurfer is ready
                wavesurfer.current.on('ready', () => {
                    const audioDuration = wavesurfer.current!.getDuration();
                    // Manage silences
                    const sPeaks = wavesurfer.current!.exportPeaks();
                    const silenceTotal = extractRegions(sPeaks[0], audioDuration).reduce(
                        (sum, { start, end }) => sum + end - start,
                        0
                    );
                    setSilencePeaks(sPeaks[0]);
                    setSilencePercent(silenceTotal / audioDuration);

                    // Manage smalltalk
                    const timeSmallTalk = smallTalkList.reduce(
                        (sum, { EndAudioTime, BeginAudioTime }) => sum + (EndAudioTime - BeginAudioTime),
                        0
                    );
                    setSmallTalkPercent(timeSmallTalk / audioDuration);

                    setShowControls(true);
                    setAudioLoading(false);
                    setAudioReady(true);
                });

                // Add event listeners to sync playingAudio state
                wavesurfer.current?.on('play', () => {
                    console.log('Wavesurfer PLAY event fired');
                    setPlayingAudio(true);
                });

                wavesurfer.current?.on('pause', () => {
                    console.log('Wavesurfer PAUSE event fired');
                    setPlayingAudio(false);
                });

                // Do not loop around
                wavesurfer.current?.on('finish', () => {
                    console.log('Wavesurfer FINISH event fired');
                    setPlayingAudio(false);
                });

                const updateTimer = () => {
                    setAudioTime(wavesurfer.current?.getCurrentTime() ?? 0);
                };

                wavesurfer.current?.on('audioprocess', updateTimer);
                // Need to watch for seek in addition to audioprocess as audioprocess doesn't fire if the audio is paused.
                wavesurfer.current?.on('seeking', updateTimer);
            } catch (e) {
                setAudioLoading(false);
                addFlashMessage({
                    id: e?.toString() || 'GetHealthScribeJob error',
                    header: 'Conversation Error',
                    content: e?.toString() || 'GetHealthScribeJob error',
                    type: 'error',
                });
            }
        }
        if (!jobLoading && waveformElement) getAudio().catch(console.error);
    }, [jobLoading, waveformElement]);

    // Draw regions on the audio player for small talk and silences
    useEffect(() => {
        if (!wavesurfer.current || !wavesurferRegions) return;
        wavesurferRegions.clearRegions();
        if (smallTalkCheck) {
            for (const { BeginAudioTime, EndAudioTime } of smallTalkList) {
                wavesurferRegions.addRegion({
                    id: `${BeginAudioTime}-${EndAudioTime}-smalltalk`,
                    start: BeginAudioTime,
                    end: EndAudioTime,
                    drag: false,
                    resize: false,
                    color: 'rgba(255, 153, 0, 0.5)',
                });
            }
        }
        if (silenceChecked) {
            for (const { start, end } of extractRegions(silencePeaks, wavesurfer.current.getDuration())) {
                wavesurferRegions.addRegion({
                    id: `${start}-${end}-silence`,
                    start: start,
                    end: end,
                    drag: false,
                    resize: false,
                    color: 'rgba(255, 153, 0, 0.5)',
                });
            }
        }

        // Skip to the end of the region when playing. I.e. skip small talk and silences
        wavesurferRegions!.on('region-in', ({ end }) => {
            if (wavesurfer.current!.getCurrentTime() < end) {
                wavesurfer.current?.seekTo(end / wavesurfer.current?.getDuration());
            }
        });
    }, [wavesurfer, smallTalkCheck, smallTalkList, silenceChecked, silencePeaks]);

    function Loading() {
        return (
            <div
                style={{
                    flex: 'display',
                    textAlign: 'center',
                    paddingTop: '30px',
                    paddingBottom: '30px',
                    color: 'var(--color-text-status-inactive-5ei55p, #5f6b7a)',
                }}
            >
                <Box>
                    <Spinner /> Loading Audio
                </Box>
            </div>
        );
    }

    function SegmentControls() {
        if (!jobLoading && !audioLoading) {
            return (
                <div className={styles.segmentControls}>
                    <SpaceBetween size={'s'} direction="horizontal">
                        <Box variant="awsui-key-label">Remove</Box>
                        <Checkbox checked={smallTalkCheck} onChange={() => setSmallTalkCheck(!smallTalkCheck)}>
                            Small Talk (<i>{Math.ceil(smallTalkPercent * 100)}%</i>)
                        </Checkbox>
                        <Checkbox checked={silenceChecked} onChange={() => setSilenceChecked(!silenceChecked)}>
                            Silences (<i>{Math.ceil(silencePercent * 100)}%</i>)
                        </Checkbox>
                    </SpaceBetween>
                </div>
            );
        }
    }

    return (
        <Container>
            {(jobLoading || audioLoading) && <Loading />}
            
            {/* Audio Controls - At the same level, not nested */}
            {!jobLoading && !audioLoading && (
                <div style={{ marginBottom: '16px' }}>
                    <Box variant="awsui-key-label" margin={{ bottom: 's' }}>Audio Controls</Box>
                    <AudioControls
                        wavesurfer={wavesurfer}
                        audioLoading={audioLoading}
                        showControls={true}
                        setShowControls={setShowControls}
                        playingAudio={playingAudio}
                        setPlayingAudio={setPlayingAudio}
                        playBackSpeed={playBackSpeed}
                        setPlayBackSpeed={setPlayBackSpeed}
                        isEmbeded={true}
                    />
                </div>
            )}
            
            <SegmentControls />
            <div style={{ height: audioLoading ? 0 : '' }}>
                <div
                    id="waveform"
                    style={{
                        marginTop: '5px',
                        height: audioLoading ? 0 : '',
                    }}
                />
            </div>
        </Container>
    );
}
