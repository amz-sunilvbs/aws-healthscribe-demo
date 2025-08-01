// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import { MedicalScribeJob } from '@aws-sdk/client-transcribe';

import { useNotificationsContext } from '@/store/notifications';
import { deleteHealthScribeJob } from '@/utils/HealthScribeApi';

type DeleteEncounterModalProps = {
    jobDetails: MedicalScribeJob | null;
    deleteModalActive: boolean;
    setDeleteModalActive: React.Dispatch<React.SetStateAction<boolean>>;
};

export function DeleteEncounterModal({
    jobDetails,
    deleteModalActive,
    setDeleteModalActive,
}: DeleteEncounterModalProps) {
    const { addFlashMessage } = useNotificationsContext();
    const navigate = useNavigate();
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    async function doDelete(medicalScribeJobName: string) {
        if (!medicalScribeJobName) return;
        setIsDeleting(true);
        try {
            await deleteHealthScribeJob({ MedicalScribeJobName: medicalScribeJobName });
            addFlashMessage({
                id: `Deleted encounter: ${medicalScribeJobName}`,
                header: 'Encounter Deleted',
                content: `Successfully deleted encounter "${medicalScribeJobName}"`,
                type: 'success',
            });
            // Navigate back to encounters list after successful deletion
            navigate('/conversations');
        } catch (err) {
            addFlashMessage({
                id: err?.toString() || 'Error deleting HealthScribe job',
                header: 'Error deleting HealthScribe job',
                content: err?.toString() || 'Error deleting HealthScribe job',
                type: 'error',
            });
        }
        setDeleteModalActive(false);
        setIsDeleting(false);
    }

    return (
        <Modal
            onDismiss={() => setDeleteModalActive(false)}
            visible={deleteModalActive}
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" disabled={isDeleting} onClick={() => setDeleteModalActive(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={isDeleting}
                            variant="primary"
                            onClick={() => doDelete(jobDetails?.MedicalScribeJobName || '')}
                        >
                            {isDeleting ? <Spinner /> : 'Delete'}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header="Delete Naina HealthScribe Encounter"
        >
            <p>
                Permanently delete <strong>{jobDetails?.MedicalScribeJobName || ''}</strong>. You
                cannot undo this action.
            </p>
            <Alert statusIconAriaLabel="Info">
                Proceeding with this action will delete the encounter but not the associated data (audio file,
                results JSON) from S3.
            </Alert>
        </Modal>
    );
}
