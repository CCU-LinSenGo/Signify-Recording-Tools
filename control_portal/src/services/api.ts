// API Service for Signfy Recording Control Portal

const API_BASE_URL = 'https://b8rlmn2vrk.execute-api.ap-northeast-3.amazonaws.com/production';

// Types
export interface DeviceInfo {
    connectionId: string;
    deviceName: string;
}

export interface ConnectionStatusResponse {
    isConnected: boolean;
    devices: DeviceInfo[];
}

export interface Action {
    actionName: string;
    displayName: string;
    description: string;
    recordingCount?: number;
}

export interface Recording {
    recordingId: string;
    actionName: string;
    description?: string | null;
    createdAt: string;
    s3RawKey?: string;
    s3AnimKey?: string | null;
    enableAnimationRecording?: boolean;
    totalFrames: number;
    frameRate: number;
    durationSec: number;
    status: 'recording' | 'completed' | 'trimmed';
    isActive: boolean;
    trimStartFrame?: number;
    trimEndFrame?: number;
    selectedFrameLength?: number;
}

// REST Interface
export const api = {
    // Connection API
    async getConnectionStatus(): Promise<ConnectionStatusResponse> {
        const res = await fetch(`${API_BASE_URL}/connection/status`);
        if (!res.ok) throw new Error('Failed to fetch connection status');
        return res.json();
    },

    // Recording API
    async startRecording(params: {
        actionName: string;
        description?: string | null;
        enableAnimationRecording?: boolean;
    }): Promise<{ recordingId: string }> {
        const res = await fetch(`${API_BASE_URL}/recording/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actionName: params.actionName,
                description: params.description ?? null,
                enableAnimationRecording: params.enableAnimationRecording ?? false,
            }),
        });
        if (!res.ok) throw new Error('Failed to start recording');
        return res.json();
    },

    async stopRecording(recordingId: string): Promise<{ message: string }> {
        const res = await fetch(`${API_BASE_URL}/recording/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordingId }),
        });
        if (!res.ok) throw new Error('Failed to stop recording');
        return res.json();
    },

    async editingCompleted(recordingId?: string): Promise<{ message: string }> {
        const res = await fetch(`${API_BASE_URL}/editing/completed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordingId: recordingId ?? null }),
        });
        if (!res.ok) throw new Error('Failed to notify editing completed');
        return res.json();
    },

    async getRecording(recordingId: string): Promise<{ recording: Recording }> {
        const res = await fetch(`${API_BASE_URL}/recordings/${recordingId}`);
        if (!res.ok) throw new Error('Failed to fetch recording');
        return res.json();
    },

    async getRecordingData(recordingId: string, returnType: 'url' | 'data' = 'url'): Promise<any> {
        const url = new URL(`${API_BASE_URL}/recordings/${recordingId}/data`);
        if (returnType === 'data') {
            url.searchParams.append('returnType', 'data');
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to fetch recording data');
        return res.json();
    },

    async trimRecording(recordingId: string, trimData: { trimStartFrame: number; trimEndFrame: number; selectedFrameLength: number }): Promise<any> {
        const res = await fetch(`${API_BASE_URL}/recordings/${recordingId}/trim`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trimData),
        });
        if (!res.ok) throw new Error('Failed to trim recording');
        return res.json();
    },

    async deleteRecording(recordingId: string): Promise<any> {
        const res = await fetch(`${API_BASE_URL}/recordings/${recordingId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete recording');
        return res.json();
    },

    // Actions API
    async getActions(): Promise<{ actions: Action[] }> {
        const res = await fetch(`${API_BASE_URL}/actions`);
        if (!res.ok) throw new Error('Failed to fetch actions');
        return res.json();
    },

    async createAction(action: { actionName: string; displayName: string; description: string }): Promise<{ action: Action }> {
        const res = await fetch(`${API_BASE_URL}/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action),
        });
        if (!res.ok) throw new Error('Failed to create action');
        return res.json();
    },

    async getActionRecordings(actionName: string, includeInactive = false): Promise<{ recordings: Recording[]; count: number }> {
        const url = new URL(`${API_BASE_URL}/actions/${encodeURIComponent(actionName)}/recordings`);
        if (includeInactive) {
            url.searchParams.append('includeInactive', 'true');
        }
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to fetch action recordings');
        return res.json();
    }
};
