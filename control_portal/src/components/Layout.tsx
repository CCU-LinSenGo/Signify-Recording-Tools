import { Outlet, NavLink } from 'react-router-dom';
import { Home, ListVideo } from 'lucide-react';
import { useRecordingState } from '../hooks/useRecordingState';

const Layout = () => {
    const { connectionStatus } = useRecordingState();
    const isConnected = connectionStatus?.isConnected ?? false;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar Navigation */}
            <nav style={{
                width: '240px',
                backgroundColor: 'var(--color-bg-card)',
                borderRight: '1px solid var(--color-border)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ marginBottom: '48px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', backgroundColor: 'var(--color-primary)', borderRadius: '8px' }}></div>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>Signfy Portal</h1>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <NavLink to="/" style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                        borderRadius: 'var(--radius-md)', textDecoration: 'none',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                        backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'all 0.2s'
                    })}>
                        <Home size={20} />
                        錄製影片
                    </NavLink>

                    <NavLink to="/actions" style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                        borderRadius: 'var(--radius-md)', textDecoration: 'none',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)',
                        backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'all 0.2s'
                    })}>
                        <ListVideo size={20} />
                        動作總覽
                    </NavLink>
                </div>

                {/* Connection Status Indicator */}
                <div style={{ marginTop: 'auto', padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#f9f9f9', border: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600 }}>設備狀態</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)',
                            boxShadow: isConnected ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                        }}></div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {isConnected ? 'Vision Pro 已連線' : '等待連線...'}
                        </span>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main style={{ flex: 1, backgroundColor: 'var(--color-bg-main)', overflowY: 'auto' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
