import { Menu, Bell, Search, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from 'react-router-dom';

export default function TopHeader({ onMenuClick }) {
    const { userProfile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    // Map path to readable title
    const getTitle = (path) => {
        const parts = path.split('/').filter(p => p);
        if (parts.length === 0) return 'Dashboard';
        const lastPart = parts[parts.length - 1];
        return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace('-', ' ');
    };

    return (
        <header className="app-header" style={{ 
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 0,
            background: 'rgba(15, 23, 42, 0.3)',
            backdropFilter: 'blur(30px)',
            position: 'sticky', top: 0, zIndex: 90
        }}>
            <div className="header-left">
                <button 
                    className="sidebar-toggle btn btn-ghost btn-icon" 
                    onClick={onMenuClick}
                    style={{ marginRight: '12px' }}
                >
                    <Menu size={22} />
                </button>
                <div className="header-breadcrumb">
                    <span>App</span>
                    <span style={{ opacity: 0.5 }}>/</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{getTitle(location.pathname)}</span>
                </div>
            </div>

            <div className="header-right">
                <div className="desktop-only" style={{ position: 'relative', marginRight: '16px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        style={{ 
                            padding: '8px 12px 8px 36px', 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            fontSize: '13px',
                            width: '200px'
                        }} 
                    />
                </div>

                <button className="btn btn-ghost btn-icon" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                
                <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }}>
                    <Bell size={18} />
                    <span style={{ 
                        position: 'absolute', top: '8px', right: '8px', 
                        width: '8px', height: '8px', background: 'var(--color-danger)', 
                        borderRadius: '50%', border: '2px solid var(--color-bg-secondary)' 
                    }} />
                </button>

                <div className="mobile-only" style={{ marginLeft: '8px' }}>
                    <div className="sidebar-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                        {userProfile?.display_name?.charAt(0) || 'U'}
                    </div>
                </div>
            </div>
        </header>
    );
}
