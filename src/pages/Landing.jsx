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
        title: 'Beautiful Design',
        description: 'Experience a stunning interface designed to keep you focused on what matters most: your students.',
        color: '#3b82f6',
        delay: '0s'
    },
    {
        icon: ClipboardCheck,
        title: 'Real-time Tracking',
        description: 'Track attendance and classes easily. Our smart filters handle the lists based on who is enrolled.',
        color: '#10b981',
        delay: '0.1s'
    },
    {
        icon: BarChart3,
        title: 'Progress Reports',
        description: 'Clear charts showing how your students are doing in classes and exams over time.',
        color: '#f59e0b',
        delay: '0.2s'
    },
    {
        icon: BookOpen,
        title: 'Lesson Planning',
        description: 'Keep track of which topics you have covered and what is coming next for each batch.',
        color: '#8b5cf6',
        delay: '0.3s'
    },
    {
        icon: Calendar,
        title: 'Class Schedule',
        description: 'A visual calendar to help you manage your weekly sessions without any overlapping.',
        color: '#ec4899',
        delay: '0.4s'
    },
    {
        icon: Shield,
        title: 'Secure & Private',
        description: 'Your and your students\' data is safe with us. Private access for teachers and admins only.',
        color: '#ef4444',
        delay: '0.5s'
    },
];

const benefits = [
    'Private coaching centers managing multiple batches',
    'Independent tutors teaching classes 9–12',
    'Growing educational centers looking for easy management',
    'Teachers wanting to improve student marks and attendance',
    'Professionals needing printable report cards for parents',
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
                        <Sparkles size={14} /> Built for Passionate Teachers
                    </div>
                    <h2 style={{ fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '24px' }}>
                        Simple Student Management
                    </h2>
                    <h1 style={{ fontSize: 'clamp(40px, 8vw, 84px)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em', marginBottom: '32px' }}>
                        Teach Smarter, <br />
                        <span className="text-gradient">Not Harder.</span>
                    </h1>
                    <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 48px', fontWeight: 500 }}>
                        Track attendance, manage lessons, and keep an eye on student progress with our all-in-one simple dashboard. Built specifically for modern tutors.
                    </p>

                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/register" className="btn btn-primary" style={{ padding: '0 40px', height: '64px', borderRadius: '18px', fontSize: '18px', fontWeight: 900, boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.5)', gap: '12px' }}>
                            <Zap size={24} /> START TEACHING
                        </Link>
                        <button className="btn btn-ghost" style={{ padding: '0 40px', height: '64px', borderRadius: '18px', fontSize: '18px', fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)' }}>
                            HOW IT WORKS
                        </button>
                    </div>
                </div>
            </section>

            {/* Feature Matrix */}
            <section id="features" style={{ padding: '100px clamp(1rem, 5vw, 4rem)', position: 'relative', zIndex: 1 }}>
                <div className="section-header" style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Built for Teachers</h2>
                    <h3 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900 }}>Everything You Need</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
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
                        }}>Who is this for?</div>
                        <h2 style={{ fontSize: '40px', fontWeight: 900, marginBottom: '32px', lineHeight: 1.2 }}>Who is <span className="text-gradient">CoachTrack</span> built for?</h2>
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

                    <div className="glass-card" style={{ padding: '80px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, marginBottom: '24px' }}>Ready to simplify your teaching?</h2>
                            <p style={{ fontSize: '20px', color: 'var(--color-text-muted)', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px', fontWeight: 500 }}>
                                Join other teachers who are already saving time and focusing more on their students.
                            </p>
                            <Link to="/register" className="btn btn-primary" style={{ padding: '0 48px', height: '64px', borderRadius: '18px', fontSize: '18px', fontWeight: 900, boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)' }}>
                                REGISTER NOW
                            </Link>
                        </div>
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
                    <span>SIMPLE TO USE</span>
                    <span>SECURE DATA</span>
                </div>
                <p>© {new Date().getFullYear()} CoachTrack — Built for the Next Generation of Teachers.</p>
            </footer>
        </div>
    );
}
