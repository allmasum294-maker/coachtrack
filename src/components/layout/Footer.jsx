import { Link } from 'react-router-dom';
import { Github, Twitter, Mail, ExternalLink } from 'lucide-react';

export default function Footer() {
    return (
        <footer style={{ 
            padding: '80px clamp(1rem, 5vw, 4rem) 40px', 
            background: 'var(--color-bg-secondary)',
            borderTop: '1px solid var(--color-border)',
            position: 'relative',
            zIndex: 1
        }}>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '60px',
                marginBottom: '60px'
            }}>
                <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ 
                            width: 32, height: 32, 
                            background: 'linear-gradient(135deg, var(--color-primary), #10b981)',
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 900
                        }}>
                            CT
                        </div>
                        <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '-0.02em' }}>
                            Coach<span style={{ color: 'var(--color-primary)' }}>Track</span>
                        </span>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '300px', fontSize: '14px', fontWeight: 500 }}>
                        The most simple and powerful student management system for private tutors and educational centers.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                        <a href="#" className="btn btn-ghost btn-icon" style={{ borderRadius: '50%' }}><Twitter size={18} /></a>
                        <a href="https://github.com/allmasum294-maker/coachtrack" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon" style={{ borderRadius: '50%' }}><Github size={18} /></a>
                        <a href="mailto:contact@coachtrack.io" className="btn btn-ghost btn-icon" style={{ borderRadius: '50%' }}><Mail size={18} /></a>
                    </div>
                </div>

                <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px', color: 'var(--color-text-primary)' }}>Product</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
                        <li><Link to="/#features" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Features</Link></li>
                        <li><Link to="/about" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>About Us</Link></li>
                        <li><Link to="/register" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Registration</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px', color: 'var(--color-text-primary)' }}>Legal</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
                        <li><Link to="/privacy" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Privacy Policy</Link></li>
                        <li><Link to="/terms" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Terms of Service</Link></li>
                    </ul>
                </div>
            </div>

            <div style={{ 
                borderTop: '1px solid var(--color-border)', 
                paddingTop: '40px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '24px',
                color: 'var(--color-text-muted)',
                fontSize: '13px',
                fontWeight: 600
            }}>
                <p>© {new Date().getFullYear()} CoachTrack. All rights reserved.</p>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ExternalLink size={14} /> Open Source Project</span>
                </div>
            </div>
        </footer>
    );
}
