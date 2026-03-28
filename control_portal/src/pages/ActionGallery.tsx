import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type Recording, type Action } from '../services/api';
import { ArrowLeft, Edit2, CheckCircle2, XCircle, HardDrive } from 'lucide-react';
import RecordingVisualizer from '../components/RecordingVisualizer';

const ActionGallery = () => {
    const { actionName } = useParams<{ actionName: string }>();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [editingRecordingId, setEditingRecordingId] = useState<string | null>(null);
    const [actionMeta, setActionMeta] = useState<Action | null>(null);

    useEffect(() => {
        if (actionName) {
            api.getActionRecordings(actionName, true).then(res => {
                setRecordings(res.recordings);
            }).catch(console.error);

            api.getActions().then(res => {
                const found = res.actions.find(a => a.actionName === actionName) || null;
                setActionMeta(found);
            }).catch(console.error);
        }
    }, [actionName, editingRecordingId]); // refetch when exiting edit mode

    const getStatusBadge = (rec: Recording) => {
        if (!rec.isActive) {
            return {
                label: '已刪除',
                icon: <XCircle size={16} />,
                color: '#ef4444',
                bg: '#fee2e2',
            };
        }

        if (rec.status === 'trimmed') {
            return {
                label: '已剪輯',
                icon: <CheckCircle2 size={16} />,
                color: '#16a34a',
                bg: '#dcfce7',
            };
        }

        return {
            label: '暫存',
            icon: <HardDrive size={16} />,
            color: '#2563eb',
            bg: '#dbeafe',
        };
    };

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
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>動作: {actionName} 的所有錄影</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                        描述: {actionMeta?.description?.trim() || '無描述'}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {recordings.map(rec => {
                    const badge = getStatusBadge(rec);
                    return (
                    <div key={rec.recordingId} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', gap: '16px' }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>ID: {rec.recordingId.slice(0, 8)}...</p>
                            <p style={{ marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                動作描述: {(rec.description || actionMeta?.description || '').trim() || '無描述'}
                            </p>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                <span>建立時間: {new Date(rec.createdAt).toLocaleString()}</span>
                                <span>幀數: {rec.totalFrames}</span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: badge.color,
                                    backgroundColor: badge.bg,
                                    borderRadius: '999px',
                                    padding: '3px 10px',
                                    fontWeight: 600,
                                }}>
                                    {badge.icon}
                                    {badge.label}
                                </span>
                            </div>
                        </div>
                        <button className="btn-primary" onClick={() => setEditingRecordingId(rec.recordingId)}>
                            <Edit2 size={16} /> 查看/編輯
                        </button>
                    </div>
                )})}
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
