import { useState, useEffect } from 'react';
import { api, type Action } from '../services/api';
import { Link } from 'react-router-dom';

const ActionsHub = () => {
    const [actions, setActions] = useState<Action[]>([]);
    const [newActionName, setNewActionName] = useState('');
    const [newActionDisplayName, setNewActionDisplayName] = useState('');

    const fetchActions = async () => {
        try {
            const res = await api.getActions();
            setActions(res.actions);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchActions();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActionName || !newActionDisplayName) return;
        try {
            await api.createAction({
                actionName: newActionName,
                displayName: newActionDisplayName,
                description: ''
            });
            setNewActionName('');
            setNewActionDisplayName('');
            fetchActions();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>動作總覽</h2>
            </div>

            <div className="card" style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>新增動作</h3>
                <form onSubmit={handleCreate} style={{ display: 'flex', gap: '16px' }}>
                    <input
                        placeholder="動作ID (英文, ex: eat)"
                        value={newActionName}
                        onChange={e => setNewActionName(e.target.value)}
                        style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                        required
                    />
                    <input
                        placeholder="顯示名稱 (ex: 吃飯)"
                        value={newActionDisplayName}
                        onChange={e => setNewActionDisplayName(e.target.value)}
                        style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                        required
                    />
                    <button type="submit" className="btn-primary">新增</button>
                </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {actions.map(action => (
                    <Link key={action.actionName} to={`/actions/${action.actionName}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } } as any}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{action.displayName}</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>ID: {action.actionName}</p>
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="badge badge-active">已錄製: {action.recordingCount}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ActionsHub;
