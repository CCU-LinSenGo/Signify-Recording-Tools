import { useState, useEffect, useCallback } from 'react';
import { api, type ConnectionStatusResponse, type Recording } from '../services/api';

export function useRecordingState() {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusResponse | null>(null);
    const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
    const [activeRecording, setActiveRecording] = useState<Recording | null>(null);
    const [isPolling, setIsPolling] = useState(true);

    // Poll connection status
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const fetchStatus = async () => {
            try {
                const status = await api.getConnectionStatus();
                setConnectionStatus(status);
            } catch (error) {
                console.error("Failed to fetch connection status:", error);
            }
        };

        if (isPolling) {
            fetchStatus();
            intervalId = setInterval(fetchStatus, 10000); // Poll every 10 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isPolling]);

    // Poll active recording status if there is one
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const fetchActiveRecording = async () => {
            if (!activeRecordingId) return;
            try {
                const { recording } = await api.getRecording(activeRecordingId);
                setActiveRecording(recording);

                // Stop polling if recording is completed or trimmed
                if (recording.status === 'completed' || recording.status === 'trimmed') {
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch recording:", error);
            }
        };

        if (activeRecordingId) {
            fetchActiveRecording();
            intervalId = setInterval(fetchActiveRecording, 500); // Poll every 0.5 seconds
        } else {
            setActiveRecording(null);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [activeRecordingId]);

    const startRecording = useCallback(async (actionName: string, description?: string) => {
        try {
            const { recordingId } = await api.startRecording({
                actionName,
                description: description?.trim() ? description.trim() : null,
            });
            setActiveRecordingId(recordingId);
            return recordingId;
        } catch (error) {
            console.error("Start recording failed:", error);
            throw error;
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (!activeRecordingId) return;
        try {
            await api.stopRecording(activeRecordingId);
        } catch (error) {
            console.error("Stop recording failed:", error);
            throw error;
        }
    }, [activeRecordingId]);

    return {
        connectionStatus,
        activeRecordingId,
        activeRecording,
        startRecording,
        stopRecording,
        setIsPolling,
    };
}
