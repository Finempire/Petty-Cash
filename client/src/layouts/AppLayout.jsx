import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const roleNav = {
    STORE_MANAGER: [
        { label: 'Dashboard', to: '/' },
        { label: 'New Request', to: '/requests/new' },
        { label: 'My Requests', to: '/requests' },
    ],
    RUNNER_BOY: [
        { label: 'Pending Requests', to: '/pending-requests' },
        { label: 'My Purchases', to: '/my-purchases' },
    ],
    ACCOUNTANT: [
        { label: 'Dashboard', to: '/' },
        { label: 'Purchases Review', to: '/purchases' },
        { label: 'Payments', to: '/payments' },
        { label: 'Reports', to: '/reports' },
        { label: 'Master Data', to: '/master' },
        { label: 'All Requests', to: '/requests' },
        { label: 'New Request', to: '/requests/new' },
        { label: 'Pending Purchases', to: '/pending-requests' },
        { label: 'Users', to: '/users' },
    ],
    CEO: [
        { label: 'Dashboard', to: '/' },
        { label: 'Reports', to: '/reports' },
        { label: 'All Requests', to: '/requests' },
        { label: 'Purchases', to: '/purchases' },
    ],
};

const roleLabels = { STORE_MANAGER: 'Store Manager', RUNNER_BOY: 'Runner', ACCOUNTANT: 'Accountant', CEO: 'CEO' };

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function AppLayout({ children, pageTitle }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb_collapsed') === '1');
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifs, setNotifs] = useState([]);
    const [unread, setUnread] = useState(0);
    const notifRef = useRef(null);

    const navItems = roleNav[user?.role] || [];

    useEffect(() => {
        const handler = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadNotifs = async () => {
        try {
            const res = await api.get('/notifications');
            setNotifs(res.data.notifications);
            setUnread(res.data.unreadCount);
        } catch { }
    };

    useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, []);

    const handleNotifClick = async (n) => {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifOpen(false);
        if (n.link) navigate(n.link);
        loadNotifs();
    };

    const handleLogout = () => { logout(); navigate('/login'); };
    const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    return (
        <div className="app-layout">
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            <div className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-mark">
                        <div className="logo-icon">PC</div>
                        {!collapsed && <div className="logo-text">
                            <span className="logo-name">PettyCash</span>
                            <span className="logo-sub">Textile Management</span>
                        </div>}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        {!collapsed && <div className="nav-section-label">{roleLabels[user?.role]}</div>}
                        {navItems.map(item => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`nav-item ${location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to)) ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                                title={collapsed ? item.label : undefined}
                            >
                                {collapsed ? item.label.charAt(0) : item.label}
                            </Link>
                        ))}
                    </div>
                </nav>

                <button className="sidebar-collapse-btn" onClick={() => { const v = !collapsed; setCollapsed(v); localStorage.setItem('sb_collapsed', v ? '1' : '0'); }}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    {collapsed ? '\u25B6' : '\u25C0'}
                </button>

                {!collapsed && <div className="sidebar-user">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <div className="user-name">{user?.name}</div>
                        <div className="user-role">{roleLabels[user?.role]}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign out" style={{ fontSize: 10 }}>Sign out</button>
                </div>}
                {collapsed && <div className="sidebar-user" style={{ justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign out" style={{ fontSize: 10 }}>{initials}</button>
                </div>}
            </div>

            <div className="main-content" style={collapsed ? { marginLeft: 'var(--sidebar-collapsed-width)' } : undefined}>
                <div className="topbar" style={collapsed ? { left: 'var(--sidebar-collapsed-width)' } : undefined}>
                    <button className="topbar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>&#9776;</button>
                    <div className="topbar-title">{pageTitle}</div>
                    <div className="topbar-actions">
                        <div className="notif-bell" ref={notifRef}>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) loadNotifs(); }}
                                style={{ position: 'relative', fontSize: 15 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                {unread > 0 && <span className="notif-badge">{unread}</span>}
                            </button>
                            {notifOpen && (
                                <div className="notif-panel">
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: 13 }}>Notifications</strong>
                                        <button className="btn btn-ghost btn-sm" onClick={async () => { await api.patch('/notifications/read-all'); loadNotifs(); }}>Mark all read</button>
                                    </div>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No notifications</div>
                                    ) : (
                                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            {notifs.map(n => (
                                                <div key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => handleNotifClick(n)}>
                                                    <div className="notif-title">{n.title}</div>
                                                    <div className="notif-msg">{n.message}</div>
                                                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="page-content">{children}</div>
            </div>
        </div>
    );
}
