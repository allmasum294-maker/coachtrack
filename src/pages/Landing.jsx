import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    Sparkles,
    ShieldCheck,
    Award
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
        icon: ShieldCheck,
        title: 'Secure & Private',
        description: 'Your and your students\' data is safe with us. Private access for teachers and admins only.',
        color: '#ef4444',
        delay: '0.5s'
    },
];

const stats = [
    { label: 'Classes Managed', value: '10k+' },
    { label: 'Active Teachers', value: '500+' },
    { label: 'Students Tracked', value: '50k+' },
    { label: 'Uptime', value: '99.9%' },
];

export default function Landing() {
    const { currentUser } = useAuth();

    return (
        <div className="landing-page" style={{ overflow: 'hidden' }}>
            {/* Hero Section */}
            <section style={{ 
                padding: '180px 24px 100px', 
                textAlign: 'center', 
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1
            }}>
                {/* Background Decorations */}
                <div style={{ position: 'absolute', top: '10%', left: '5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)', zIndex: -1 }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)', zIndex: -1 }} />

                <div className="animate-fade-in-up">
                    <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '8px', 
                        padding: '10px 20px', background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--color-primary)', borderRadius: '100px', 
                        fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', 
                        letterSpacing: '0.1em', marginBottom: '40px',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                        <Sparkles size={16} /> Empowering 5,000+ Tutors Worldwide
                    </div>
                    
                    <h1 style={{ 
                        fontSize: 'clamp(48px, 10vw, 96px)', 
                        fontWeight: 900, 
                        lineHeight: 0.9, 
                        letterSpacing: '-0.04em', 
                        marginBottom: '32px' 
                    }}>
                        The Future of <br />
                        <span style={{ 
                            background: 'linear-gradient(135deg, var(--color-primary), #10b981)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>Coaching Management.</span>
                    </h1>
                    
                    <p style={{ 
                        fontSize: 'clamp(18px, 2.5vw, 24px)', 
                        color: 'var(--color-text-secondary)', 
                        lineHeight: 1.5, 
                        maxWidth: '750px', 
                        margin: '0 auto 56px', 
                        fontWeight: 500 
                    }}>
                        Organize your students, track every class, and analyze performance with an interface that feels like the future of education.
                    </p>

                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {currentUser ? (
                            <Link to="/dashboard" className="btn btn-primary" style={{ padding: '0 48px', height: '72px', borderRadius: '20px', fontSize: '20px', fontWeight: 900, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.5)', gap: '12px' }}>
                                <Zap size={24} /> GO TO DASHBOARD
                            </Link>
                        ) : (
                            <>
                                <Link to="/register" className="btn btn-primary" style={{ padding: '0 48px', height: '72px', borderRadius: '20px', fontSize: '20px', fontWeight: 900, boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.5)', gap: '12px' }}>
                                    <Zap size={24} /> GET STARTED FREE
                                </Link>
                                <Link to="/login" className="btn btn-ghost" style={{ padding: '0 48px', height: '72px', borderRadius: '20px', fontSize: '20px', fontWeight: 800, border: '1px solid var(--color-border)', background: 'var(--color-bg-glass)' }}>
                                    TEACHER LOGIN
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Dashboard Preview Mockup */}
                <div style={{ 
                    marginTop: '100px', 
                    width: '100%', 
                    maxWidth: '1100px', 
                    padding: '12px', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '32px', 
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)',
                    transform: 'perspective(1000px) rotateX(2deg)'
                }}>
                    <div style={{ 
                        width: '100%', 
                        aspectRatio: '16/9', 
                        background: 'var(--color-bg-primary)', 
                        borderRadius: '20px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-text-muted)',
                        fontSize: '18px',
                        fontWeight: 800
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <Layout size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <p>Premium Dashboard Interface</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section style={{ padding: '80px 24px', background: 'var(--color-bg-secondary)', borderY: '1px solid var(--color-border)' }}>
                <div style={{ 
                    maxWidth: '1200px', 
                    margin: '0 auto', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '40px',
                    textAlign: 'center'
                }}>
                    {stats.map((s, i) => (
                        <div key={i}>
                            <div style={{ fontSize: '48px', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{s.value}</div>
                            <div style={{ textTransform: 'uppercase', fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.1em' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Matrix */}
            <section id="features" style={{ padding: '120px 24px', position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Built for Teachers</h2>
                    <h3 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, letterSpacing: '-0.02em' }}>Everything You Need to Succeed</h3>
                </div>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                    gap: '32px',
                    maxWidth: '1200px',
                    margin: '0 auto'
                }}>
                    {features.map((f, i) => (
                        <div key={i} className="glass-card hover-lift" style={{ padding: '48px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ 
                                position: 'absolute', top: '-24px', right: '-24px', 
                                width: '120px', height: '120px', 
                                background: `${f.color}10`, borderRadius: '50%', zIndex: 0 
                            }} />
                            <div style={{ 
                                width: '64px', height: '64px', borderRadius: '20px', 
                                background: `${f.color}20`, color: f.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '32px', position: 'relative', zIndex: 1
                            }}>
                                <f.icon size={32} />
                            </div>
                            <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', position: 'relative', zIndex: 1 }}>{f.title}</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px', lineHeight: 1.7, fontWeight: 500, position: 'relative', zIndex: 1 }}>{f.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section style={{ padding: '120px 24px', background: 'rgba(59, 130, 246, 0.02)' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '80px', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, marginBottom: '32px', lineHeight: 1.1 }}>How <span style={{ color: 'var(--color-primary)' }}>CoachTrack</span> Works</h2>
                            <div style={{ display: 'grid', gap: '40px' }}>
                                {[
                                    { title: 'Setup Your Batches', text: 'Create batches for different classes and subjects in seconds.' },
                                    { title: 'Add Your Students', text: 'Import or manually add students to their respective batches.' },
                                    { title: 'Start Tracking', text: 'Take attendance, log homework, and record exam marks daily.' }
                                ].map((step, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '24px' }}>
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '50%', 
                                            background: 'var(--color-primary)', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 900, flexShrink: 0
                                        }}>{i + 1}</div>
                                        <div>
                                            <h4 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>{step.title}</h4>
                                            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{step.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
                            <Award size={80} style={{ color: 'var(--color-gold)', marginBottom: '32px' }} />
                            <h3 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '24px' }}>Free for Life</h3>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: '40px', fontSize: '18px', fontWeight: 500 }}>
                                CoachTrack is committed to supporting small education centers. Our core features will always be free.
                            </p>
                            <Link to="/register" className="btn btn-primary" style={{ width: '100%', height: '64px', borderRadius: '16px', fontWeight: 900, fontSize: '18px' }}>CREATE FREE ACCOUNT</Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
