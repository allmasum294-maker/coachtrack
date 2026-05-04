import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const { currentUser } = useAuth();

    return (
        <nav className="glass-panel" style={{ 
            position: 'fixed', 
            top: 0, left: 0, right: 0, 
            zIndex: 1000, 
            height: '72px', 
            borderRadius: 0,
            borderLeft: 'none', borderRight: 'none', borderTop: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 clamp(1rem, 5vw, 4rem)',
            background: 'rgba(10, 15, 30, 0.7)',
            backdropFilter: 'blur(12px)'
        }}>
            {/* Logo */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ 
                    width: 40, height: 40, 
                    background: 'linear-gradient(135deg, var(--color-primary), #10b981)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 900, boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
                }}>
                    CT
                </div>
                <span style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.02em' }}>
                    Coach<span style={{ color: 'var(--color-primary)' }}>Track</span>
                </span>
            </Link>

            {/* Desktop Menu */}
            <div className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                <Link to="/#features" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '14px' }}>Features</Link>
                <Link to="/about" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '14px' }}>About</Link>
                <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />
                {currentUser ? (
                    <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0 24px', height: '42px', borderRadius: '10px', fontWeight: 900, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }}>DASHBOARD</Link>
                ) : (
                    <>
                        <Link to="/login" style={{ textDecoration: 'none', color: 'var(--color-text-primary)', fontWeight: 800, fontSize: '14px' }}>Login</Link>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0 24px', height: '42px', borderRadius: '10px', fontWeight: 900, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }}>GET STARTED</Link>
                    </>
                )}
            </div>

            {/* Mobile Toggle */}
            <button 
                className="mobile-only btn btn-ghost btn-icon" 
                onClick={() => setIsOpen(!isOpen)}
                style={{ color: 'var(--color-text-primary)' }}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Menu Overlay */}
            {isOpen && (
                <div style={{ 
                    position: 'fixed', top: '72px', left: 0, right: 0, bottom: 0,
                    background: 'var(--color-bg-primary)',
                    zIndex: 999, padding: '40px 24px',
                    display: 'flex', flexDirection: 'column', gap: '24px'
                }}>
                    <Link to="/#features" onClick={() => setIsOpen(false)} style={{ fontSize: '24px', fontWeight: 800, textDecoration: 'none', color: 'var(--color-text-primary)' }}>Features</Link>
                    <Link to="/about" onClick={() => setIsOpen(false)} style={{ fontSize: '24px', fontWeight: 800, textDecoration: 'none', color: 'var(--color-text-primary)' }}>About</Link>
                    {currentUser ? (
                        <Link to="/dashboard" onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ height: '56px', borderRadius: '14px', fontWeight: 900, fontSize: '18px' }}>DASHBOARD</Link>
                    ) : (
                        <>
                            <Link to="/login" onClick={() => setIsOpen(false)} style={{ fontSize: '24px', fontWeight: 800, textDecoration: 'none', color: 'var(--color-text-primary)' }}>Login</Link>
                            <Link to="/register" onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ height: '56px', borderRadius: '14px', fontWeight: 900, fontSize: '18px' }}>GET STARTED</Link>
                        </>
                    )}
                </div>
            )}
        </nav>
    );
}
