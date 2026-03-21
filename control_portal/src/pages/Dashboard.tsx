import { useState, useEffect, useRef } from 'react';
import { useRecordingState } from '../hooks/useRecordingState';
import { api, type Action } from '../services/api';
import { Play, Square, Loader, AlertCircle } from 'lucide-react';
import RecordingVisualizer from '../components/RecordingVisualizer';

const Dashboard = () => {
    const {
        connectionStatus,
        activeRecordingId,
        activeRecording,
        startRecording,
        stopRecording
    } = useRecordingState();

    const [actions, setActions] = useState<Action[]>([]);
    const [selectedAction, setSelectedAction] = useState<string>('');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordingElapsed, setRecordingElapsed] = useState(0);
    const [isStopping, setIsStopping] = useState(false);
    const [recordingError, setRecordingError] = useState<string | null>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isConnected = connectionStatus?.isConnected ?? false;
    const isRecording = activeRecording?.status === 'recording';
    const showVisualizer = activeRecording && (activeRecording.status === 'completed' || activeRecording.status === 'trimmed');

    useEffect(() => {
        api.getActions().then(res => {
            setActions(res.actions);
            if (res.actions.length > 0 && !selectedAction) {
                setSelectedAction(res.actions[0].actionName);
            }
        }).catch(console.error);
    }, []);

    // Elapsed timer during recording
    useEffect(() => {
        if (isRecording && !isStopping) {
            elapsedRef.current = setInterval(() => {
                setRecordingElapsed(prev => prev + 1);
            }, 1000);
        } else {
            if (elapsedRef.current) {
                clearInterval(elapsedRef.current);
                elapsedRef.current = null;
            }
            if (!isRecording) setRecordingElapsed(0);
        }
        return () => {
            if (elapsedRef.current) clearInterval(elapsedRef.current);
        };
    }, [isRecording, isStopping]);

    // Reset isStopping only when recording status actually changes away from 'recording'
    useEffect(() => {
        if (!isRecording && isStopping) {
            setIsStopping(false);
        }
    }, [isRecording, isStopping]);

    const handleStart = async () => {
        if (!selectedAction) return;
        setRecordingError(null);

        // Send startRecording immediately (device also counts down)
        try {
            await startRecording(selectedAction);
        } catch (err: any) {
            setRecordingError(err?.message || '無法啟動錄影，請確認裝置連線狀態');
            return;
        }

        // Parallel frontend countdown (3-2-1) — purely visual, device is also counting down
        for (let i = 3; i > 0; i--) {
            setCountdown(i);
            await new Promise(r => setTimeout(r, 1000));
        }
        setCountdown(null);
    };

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await stopRecording();
        } catch (err: any) {
            setRecordingError(err?.message || '停止錄影失敗');
            setIsStopping(false);
        }
    };

    const dismissError = () => setRecordingError(null);

    const formatElapsed = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // The visualizer is now rendered below the recording controls

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '40px auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>錄影控制面板</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>控制 Apple Vision Pro 錄製節點數據</p>
            </div>

            {/* Error Banner */}
            {recordingError && (
                <div className="animate-fade-in" style={{
                    backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <AlertCircle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#991b1b', fontWeight: 500 }}>{recordingError}</span>
                    <button onClick={dismissError} style={{
                        background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer',
                        fontSize: '1.2rem', lineHeight: 1, padding: '4px'
                    }}>✕</button>
                </div>
            )}

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>選擇錄製動作</label>
                    <select
                        value={selectedAction}
                        onChange={e => setSelectedAction(e.target.value)}
                        disabled={isRecording || countdown !== null}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)', fontSize: '1rem',
                            backgroundColor: '#fff'
                        }}
                    >
                        <option value="" disabled>請選擇動作...</option>
                        {actions.map(a => (
                            <option key={a.actionName} value={a.actionName}>
                                {a.displayName} (已錄製: {a.recordingCount})
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    {countdown !== null ? (
                        /* Countdown Circle */
                        <div key={countdown} className="animate-countdown" style={{
                            width: '120px', height: '120px', borderRadius: '50%',
                            backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '3rem', fontWeight: 700, boxShadow: 'var(--shadow-md)'
                        }}>
                            {countdown}
                        </div>
                    ) : isStopping ? (
                        /* Stopping State */
                        <div className="animate-fade-in" style={{
                            width: '120px', height: '120px', borderRadius: '50%',
                            backgroundColor: '#fee2e2', color: 'var(--color-danger)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '6px', fontSize: '0.9rem', fontWeight: 600
                        }}>
                            <Loader className="animate-spin" size={28} />
                            正在停止...
                        </div>
                    ) : isRecording ? (
                        /* Recording — pulsing stop button */
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* Ripple rings */}
                            <div style={{
                                position: 'absolute', width: '120px', height: '120px', borderRadius: '50%',
                                border: '2px solid rgba(239, 68, 68, 0.3)',
                                animation: 'ripple 2s ease-out infinite'
                            }} />
                            <div style={{
                                position: 'absolute', width: '120px', height: '120px', borderRadius: '50%',
                                border: '2px solid rgba(239, 68, 68, 0.3)',
                                animation: 'ripple 2s ease-out infinite 0.6s'
                            }} />
                            <button
                                onClick={handleStop}
                                className="animate-pulse-glow"
                                style={{
                                    position: 'relative', zIndex: 2,
                                    width: '120px', height: '120px', borderRadius: '50%',
                                    backgroundColor: 'var(--color-danger)', color: 'white',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', fontSize: '1.1rem', fontWeight: 600,
                                    cursor: 'pointer', border: 'none'
                                }}
                            >
                                <Square size={32} fill="currentColor" />
                                停止錄影
                            </button>
                        </div>
                    ) : (
                        /* Idle — Start button */
                        <button
                            onClick={handleStart}
                            disabled={!isConnected || !selectedAction}
                            style={{
                                width: '120px', height: '120px', borderRadius: '50%',
                                backgroundColor: (!isConnected || !selectedAction) ? '#ccc' : 'var(--color-primary)',
                                color: 'white',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: '8px', fontSize: '1.1rem', fontWeight: 600,
                                boxShadow: (!isConnected || !selectedAction) ? 'none' : '0 8px 16px rgba(255, 140, 66, 0.3)',
                                cursor: (!isConnected || !selectedAction) ? 'not-allowed' : 'pointer', border: 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Play size={32} fill="currentColor" />
                            開始錄影
                        </button>
                    )}
                </div>

                {/* Recording Status Bar */}
                {isRecording && !isStopping && (
                    <div className="animate-fade-in" style={{
                        textAlign: 'center', marginTop: '16px', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                            <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                backgroundColor: 'var(--color-danger)',
                                animation: 'pulse-glow 1.2s ease-in-out infinite'
                            }} />
                            <span style={{ fontWeight: 600 }}>REC</span>
                            <span style={{
                                fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700,
                                color: 'var(--color-text-main)', marginLeft: '8px'
                            }}>
                                {formatElapsed(recordingElapsed)}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            錄製進行中，點擊上方按鈕停止
                        </span>
                    </div>
                )}
            </div>

            {/* Visualizer Component */}
            {showVisualizer && activeRecordingId && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '32px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', textAlign: 'center' }}>回放與編輯錄影數據</h2>
                    <RecordingVisualizer recordingId={activeRecordingId!} />
                </div>
            )}

        </div>
    );
};

export default Dashboard;
