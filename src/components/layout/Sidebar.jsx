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
    FileDown
} from 'lucide-react';

const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/batches', icon: GraduationCap, label: 'Batches' },
    { path: '/schedule', icon: Calendar, label: 'Schedule' },
];

const managementNavItems = [
    { path: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
    { path: '/lessons', icon: BookOpen, label: 'Lessons' },
    { path: '/homework', icon: BookCheck, label: 'Homework' },
    { path: '/exams', icon: FileText, label: 'Exams' },
];

const insightNavItems = [
    { path: '/analytics', icon: BarChart3, label: 'Class Progress' },
    { path: '/leaderboard', icon: Award, label: 'Top Students' },
];

const systemNavItems = [
    { path: '/notifications', icon: Bell, label: 'Notifications' },
    { path: '/export', icon: Download, label: 'Export Data' },
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
                className="sidebar-toggle glass-panel"
                onClick={() => setMobileOpen(true)}
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 1000,
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(12px)',
                    color: 'var(--color-text-primary)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
            >
                <Menu size={22} />
            </button>

            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
            />

            <aside
                className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''} glass-panel`}
                style={{
                    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '10px 0 30px rgba(0, 0, 0, 0.2)'
                }}
            >
                {/* Brand */}
                <div className="sidebar-brand" style={{ padding: 'var(--space-6) var(--space-4)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div className="sidebar-brand-logo" style={{ 
                        background: 'linear-gradient(135deg, var(--color-accent), #0d9488)',
                        boxShadow: '0 0 15px var(--color-accent-glow)'
                    }}>CT</div>
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
                <nav className="sidebar-nav" style={{ padding: 'var(--space-4) 0' }}>
                    {renderNavSection('Coaching', mainNavItems)}
                    <div style={{ margin: 'var(--space-4) 12px', height: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />
                    {renderNavSection('Teaching', managementNavItems)}
                    <div style={{ margin: 'var(--space-4) 12px', height: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />
                    {renderNavSection('Results', insightNavItems)}
                    <div style={{ margin: 'var(--space-4) 12px', height: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />
                    {renderNavSection('System', systemNavItems)}
                    {isAdmin && (
                        <>
                            <div style={{ margin: 'var(--space-4) 12px', height: '1px', background: 'rgba(255, 255, 255, 0.03)' }} />
                            {renderNavSection('Admin', [
                                { path: '/admin', icon: ShieldCheck, label: 'Admin Panel' },
                            ])}
                        </>
                    )}
                </nav>

                {/* Collapse toggle (desktop) */}
                <div style={{ padding: '0 12px 8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', background: 'rgba(255,255,255,0.02)' }}
                    >
                        <ChevronLeft
                            size={18}
                            style={{
                                transform: collapsed ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                            }}
                        />
                        {!collapsed && <span>Collapse Menu</span>}
                    </button>
                </div>

                {/* User */}
                <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.1)' }}>
                    <div className="sidebar-user">
                        <div className="sidebar-avatar" style={{ 
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'var(--color-accent)'
                        }}>
                            {getInitials(userProfile?.displayName || currentUser?.displayName)}
                        </div>
                        {!collapsed && (
                            <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
                                <div className="sidebar-user-name" style={{ fontWeight: 700 }}>
                                    {userProfile?.displayName || currentUser?.displayName || 'User'}
                                </div>
                                <div className="sidebar-user-role" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', fontWeight: 800 }}>
                                    {userProfile?.role === 'admin' ? 'Administrator' : 'Teacher'}
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', padding: '0 12px 12px' }}>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ flex: 1, background: 'rgba(255,255,255,0.03)' }}
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ flex: 1, background: 'rgba(255,255,255,0.03)', color: 'var(--color-danger)' }}
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
