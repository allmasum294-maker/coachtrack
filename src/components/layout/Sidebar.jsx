import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    Calendar,
    ClipboardCheck,
    BookOpen,
    FileText,
    BarChart3,
    Download,
    Bell,
    ShieldCheck,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    Sun,
    Moon,
    FileEdit,
    LineChart,
    History,
    FileSignature,
    BookCheck,
} from 'lucide-react';

const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/batches', icon: GraduationCap, label: 'Batches' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/schedule', icon: Calendar, label: 'Schedule' },
];

const managementNavItems = [
    { path: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
    { path: '/homework', icon: BookCheck, label: 'Homework' },
    { path: '/lessons', icon: BookOpen, label: 'Lessons' },
    { path: '/exams', icon: FileText, label: 'Exams' },
    { path: '/sessions', icon: FileEdit, label: 'Session Logs' },
];

const insightNavItems = [
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/student-analytics', icon: LineChart, label: 'Student Analytics' },
    { path: '/timeline', icon: History, label: 'Timeline' },
    { path: '/report-card', icon: FileSignature, label: 'Report Cards' },
    { path: '/export', icon: Download, label: 'Export' },
    { path: '/notifications', icon: Bell, label: 'Notifications' },
];

export default function Sidebar() {
    const { currentUser, userProfile, logout, isAdmin } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    async function handleLogout() {
        try {
            await logout();
            navigate('/');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }

    function getInitials(name) {
        if (!name) return '?';
        return name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    const renderNavSection = (title, items) => (
        <>
            {!collapsed && <div className="sidebar-section-title">{title}</div>}
            {items.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : ''}
                >
                    <item.icon className="sidebar-link-icon" />
                    {!collapsed && <span className="sidebar-link-text">{item.label}</span>}
                </NavLink>
            ))}
        </>
    );

    return (
        <>
            {/* Mobile toggle */}
            <button
                className="sidebar-toggle"
                onClick={() => setMobileOpen(true)}
                style={{
                    position: 'fixed',
                    top: '16px',
                    left: '16px',
                    zIndex: 101,
                }}
            >
                <Menu size={24} />
            </button>

            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
            />

            <aside
                className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''
                    }`}
            >
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="sidebar-brand-logo">CT</div>
                    {!collapsed && (
                        <div className="sidebar-brand-text">
                            Coach<span>Track</span>
                        </div>
                    )}
                    {/* Mobile close */}
                    <button
                        className="sidebar-toggle"
                        onClick={() => setMobileOpen(false)}
                        style={{ marginLeft: 'auto', display: mobileOpen ? 'flex' : 'none' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {renderNavSection('Overview', mainNavItems)}
                    {renderNavSection('Management', managementNavItems)}
                    {renderNavSection('Insights', insightNavItems)}
                    {isAdmin && renderNavSection('Admin', [
                        { path: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
                    ])}
                </nav>

                {/* Collapse toggle (desktop) */}
                <div style={{ padding: '0 12px 8px' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}
                    >
                        <ChevronLeft
                            size={18}
                            style={{
                                transform: collapsed ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                            }}
                        />
                        {!collapsed && <span>Collapse</span>}
                    </button>
                </div>

                {/* User */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {getInitials(userProfile?.displayName || currentUser?.displayName)}
                        </div>
                        {!collapsed && (
                            <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
                                <div className="sidebar-user-name">
                                    {userProfile?.displayName || currentUser?.displayName || 'User'}
                                </div>
                                <div className="sidebar-user-role">
                                    {userProfile?.role === 'admin' ? 'Admin' : 'Teacher'}
                                </div>
                            </div>
                        )}
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
