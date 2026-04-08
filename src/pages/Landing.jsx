import { Link } from 'react-router-dom';
import {
    GraduationCap,
    Users,
    Calendar,
    ClipboardCheck,
    BarChart3,
    BookOpen,
    CheckCircle,
    ArrowRight,
    Shield,
    Zap,
    TrendingUp,
    Layout,
    Sparkles
} from 'lucide-react';

const features = [
    {
        icon: Layout,
        title: 'Glassmorphism UI',
        description: 'Experience a stunning, futuristic interface designed for maximum pedagogical focus and aesthetic excellence.',
        color: '#3b82f6',
        delay: '0s'
    },
    {
        icon: ClipboardCheck,
        title: 'Mission-Control Sync',
        description: 'Real-time attendance and session tracking with enrollment-aware filtering. Never miss a single pedagogical beat.',
        color: '#10b981',
        delay: '0.1s'
    },
    {
        icon: BarChart3,
        title: 'Deep Analytics',
        description: 'Quantum-level insights into student performance, attendance trends, and predictive risk assessment.',
        color: '#f59e0b',
        delay: '0.2s'
    },
    {
        icon: BookOpen,
        title: 'Curriculum Ledger',
        description: 'Comprehensive syllabus tracking and lesson planning. Map the entire academic journey with precision.',
        color: '#8b5cf6',
        delay: '0.3s'
    },
    {
        icon: Calendar,
        title: 'Temporal Manager',
        description: 'Advanced scheduling matrix with visual calendar integration. Orchestrate your sessions with zero friction.',
        color: '#ec4899',
        delay: '0.4s'
    },
    {
        icon: Shield,
        title: 'Fortified Security',
        description: 'Level-0 administrative clearance and teacher-only data silos. Your intellectual property is safe.',
        color: '#ef4444',
        delay: '0.5s'
    },
];

const benefits = [
    'Private tutoring centers managing multi-grade clusters',
    'Elite academic freelancers (Class 9–12 Specialists)',
    'Growth-stage coaching centers seeking scientific management',
    'Educators focused on statistical performance optimization',
    'Professional mentors requiring exportable clinical reports',
];

export default function Landing() {
    return (
        <div className="landing-page" style={{ 
            background: 'var(--color-bg-primary)',
            minHeight: '100vh',
            color: 'var(--color-text-primary)',
            overflowX: 'hidden'
        }}>
            {/* Mesh Gradient Backgrounds */}
            <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-10%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            {/* Navbar */}
            <nav className="glass-panel" style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                borderRadius: 0,
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 clamp(1rem, 5vw, 4rem)',
                background: 'rgba(10, 15, 30, 0.7)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                        width: 40, height: 40, 
                        background: 'linear-gradient(135deg, var(--color-primary), #10b981)',
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 900, boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
                    }}>
                        GT
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.02em' }}>
                        Coach<span className="text-gradient">Track</span>
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Link to="/login" className="btn btn-ghost" style={{ fontWeight: 800 }}>Login</Link>
                    <Link to="/register" className="btn btn-primary" style={{ padding: '0 24px', height: '42px', borderRadius: '10px', fontWeight: 900, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }}>GET STARTED</Link>
                </div>
            </nav>

            {/* Hero */}
            <section style={{ 
                padding: '160px 20px 100px', 
                textAlign: 'center', 
                position: 'relative',
                zIndex: 1
            }}>
                <div className="animate-fade-in-up">
                    <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '8px', 
                        padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--color-primary)', borderRadius: '100px', 
                        fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', 
                        letterSpacing: '0.1em', marginBottom: '32px'
                    }}>
                        <Sparkles size={14} /> The Elite Standard for Educators
                    </div>
                    <h1 style={{ 
                        fontSize: 'clamp(40px, 8vw, 84px)', 
                        fontWeight: 900, 
                        lineHeight: 1.05, 
                        marginBottom: '24px',
                        letterSpacing: '-0.04em'
                    }}>
                        The <span className="text-gradient">Scientific Way</span><br />
                        to Orchestrate <span style={{ color: 'var(--color-text-primary)', opacity: 0.9 }}>Coaching</span>
                    </h1>
                    <p style={{ 
                        fontSize: 'clamp(16px, 1.5vw, 20px)', 
                        color: 'var(--color-text-muted)', 
                        maxWidth: '700px', 
                        margin: '0 auto 48px',
                        lineHeight: 1.6,
                        fontWeight: 500
                    }}>
                        Engineered for elite pedagogical centers. Manage batches, students, and cognitive performance via a stunning mission-control interface.
                    </p>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0 40px', height: '60px', borderRadius: '16px', fontSize: '16px', fontWeight: 900, boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)' }}>
                            ESTABLISH CLEARANCE <ArrowRight size={20} style={{ marginLeft: '10px' }} />
                        </Link>
                        <a href="#features" className="btn btn-ghost" style={{ padding: '0 32px', height: '60px', borderRadius: '16px', fontSize: '16px', fontWeight: 900, background: 'rgba(255,255,255,0.03)' }}>
                            VIEW TELEMETRY
                        </a>
                    </div>
                </div>
            </section>

            {/* Feature Matrix */}
            <section id="features" style={{ padding: '100px clamp(1rem, 5vw, 4rem)', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, marginBottom: '16px', letterSpacing: '-0.02em' }}>Omniscient Feature Matrix</h2>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '18px', fontWeight: 500 }}>A unified ecosystem engineered for data-driven academic directors.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {features.map((f, i) => (
                        <div key={i} className="glass-card hover-lift animate-fade-in-up" style={{ padding: '40px', animationDelay: f.delay }}>
                            <div style={{ 
                                width: '56px', height: '56px', borderRadius: '16px', 
                                background: `${f.color}15`, color: f.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '24px'
                            }}>
                                <f.icon size={28} />
                            </div>
                            <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}>{f.title}</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: 1.6, fontWeight: 500 }}>{f.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Target Core Section */}
            <section style={{ padding: '100px clamp(1rem, 5vw, 4rem)', background: 'rgba(59, 130, 246, 0.02)', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '60px', alignItems: 'center' }}>
                    <div>
                        <div style={{ 
                            padding: '6px 14px', background: 'rgba(245, 158, 11, 0.1)', 
                            color: 'var(--color-gold)', borderRadius: '8px', 
                            fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', 
                            letterSpacing: '0.1em', marginBottom: '24px', display: 'inline-block'
                        }}>Target Demographics</div>
                        <h2 style={{ fontSize: '40px', fontWeight: 900, marginBottom: '32px', lineHeight: 1.2 }}>Who is <span className="text-gradient">CoachTrack</span> Engineered For?</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {benefits.map((b, i) => (
                                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CheckCircle size={16} />
                                    </div>
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{b}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card" style={{ padding: '60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--color-primary)', filter: 'blur(100px)', opacity: 0.1 }} />
                        
                        <div style={{ 
                            width: '100px', height: '100px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-gold))',
                            borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 32px', boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)'
                        }}>
                            <GraduationCap size={50} color="white" />
                        </div>
                        <h3 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '16px' }}>Evolve Your Practice</h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', marginBottom: '40px', fontWeight: 500 }}>Join the elite tier of educators leveraging scientific management for superior outcomes.</p>
                        <Link to="/register" className="btn btn-primary" style={{ width: '100%', height: '56px', borderRadius: '14px', fontSize: '15px', fontWeight: 900 }}>INITIALIZE FREE ACCOUNT</Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ 
                padding: '60px clamp(1rem, 5vw, 4rem)', 
                borderTop: '1px solid var(--color-border)',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: '14px',
                fontWeight: 600
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 900 }}>COACHTRACK v2.0</span>
                    <span>SYSTEM READY</span>
                    <span>ENCRYPTION ACTIVE</span>
                </div>
                <p>© {new Date().getFullYear()} CoachTrack — Built for the Next Generation of Elite Educators.</p>
            </footer>
        </div>
    );
}
