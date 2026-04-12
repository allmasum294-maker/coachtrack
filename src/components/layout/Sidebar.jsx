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
    FileSignature,
    BookCheck,
    Award,
    BrainCircuit,
    History,
    Activity,
    Layers,
    TrendingUp,
    Trophy,
    FileDown,
    UserCheck
} from 'lucide-react';

const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/batches', icon: GraduationCap, label: 'Batches' },
    { path: '/schedule', icon: Calendar, label: 'Schedule' },
];

const managementNavItems = [
    { id: 'attendance', path: '/attendance', icon: UserCheck, label: 'Attendance' },
    { id: 'session-logs', path: '/session-logs', icon: BookOpen, label: 'Session Logs' },
    { id: 'homework', path: '/homework', icon: BookCheck, label: 'Homework' },
    { id: 'exams', path: '/exams', icon: GraduationCap, label: 'Exams' }
];

const insightNavItems = [
    { id: 'analytics', path: '/analytics', icon: LineChart, label: 'Class Analytics' },
    { id: 'student-analytics', path: '/student-analytics', icon: BarChart3, label: 'Student Analytics' },
    { id: 'leaderboard', path: '/leaderboard', icon: Trophy, label: 'Leaderboard' }
];

const systemNavItems = [
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/export', icon: Download, label: 'Export Data' },
];

export default function Sidebar({ mobileOpen, setMobileOpen }) {
    const { currentUser, userProfile, logout, isAdmin } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
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
            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
            />

            <aside
                className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
            >
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="sidebar-brand-logo">CT</div>
                    {!collapsed && (
                        <div className="sidebar-brand-text">
                            Coach<span>Track</span>
                        </div>
                    )}
                    {/* Mobile close button */}
                    <button
                        className="sidebar-close-btn"
                        onClick={() => setMobileOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {renderNavSection('Coaching', mainNavItems)}
                    <div className="sidebar-divider" />
                    {renderNavSection('Teaching', managementNavItems)}
                    <div className="sidebar-divider" />
                    {renderNavSection('Results', insightNavItems)}
                    <div className="sidebar-divider" />
                    {renderNavSection('System', systemNavItems)}
                    {isAdmin && (
                        <>
                            <div className="sidebar-divider" />
                            {renderNavSection('Admin', [
                                { path: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
                            ])}
                        </>
                    )}
                </nav>

                {/* User Info (Bottom) */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {getInitials(userProfile?.displayName || currentUser?.displayName)}
                        </div>
                        {!collapsed && (
                            <div className="sidebar-user-info">
                                <div className="sidebar-user-name">
                                    {userProfile?.displayName || currentUser?.displayName || 'User'}
                                </div>
                                <div className="sidebar-user-role">
                                    {userProfile?.role === 'admin' ? 'Administrator' : 'Teacher'}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="sidebar-actions">
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-danger)' }}
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
