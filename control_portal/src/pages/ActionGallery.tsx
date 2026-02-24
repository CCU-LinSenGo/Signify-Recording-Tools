import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type Recording } from '../services/api';
import { ArrowLeft, Edit2 } from 'lucide-react';
import RecordingVisualizer from '../components/RecordingVisualizer';

const ActionGallery = () => {
    const { actionName } = useParams<{ actionName: string }>();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [editingRecordingId, setEditingRecordingId] = useState<string | null>(null);

    useEffect(() => {
        if (actionName) {
            api.getActionRecordings(actionName).then(res => {
                setRecordings(res.recordings);
            }).catch(console.error);
        }
    }, [actionName, editingRecordingId]); // refetch when exiting edit mode

    if (editingRecordingId) {
        return (
            <div className="container">
                <button
                    className="btn-secondary"
                    onClick={() => setEditingRecordingId(null)}
                    style={{ marginBottom: '24px' }}
                >
                    <ArrowLeft size={16} /> 返回列表
                </button>
                <RecordingVisualizer recordingId={editingRecordingId} />
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <Link to="/actions" className="btn-secondary" style={{ padding: '8px 12px' }}>
                    <ArrowLeft size={16} />
                </Link>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>動作: {actionName} 的所有錄影</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {recordings.map(rec => (
                    <div key={rec.recordingId} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>ID: {rec.recordingId.slice(0, 8)}...</p>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                <span>建立時間: {new Date(rec.createdAt).toLocaleString()}</span>
                                <span>幀數: {rec.totalFrames}</span>
                                <span>保留狀態: {rec.isActive ? '✅' : '❌'}</span>
                            </div>
                        </div>
                        <button className="btn-primary" onClick={() => setEditingRecordingId(rec.recordingId)}>
                            <Edit2 size={16} /> 查看/編輯
                        </button>
                    </div>
                ))}
                {recordings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                        暫無錄製數據
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActionGallery;
