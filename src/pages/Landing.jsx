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
} from 'lucide-react';

const features = [
    {
        icon: GraduationCap,
        title: 'Batch Management',
        description: 'Organize classes by grade — Class 9 through 12. Track each batch\'s progress, students, and schedules independently.',
        color: 'var(--color-accent)',
        bg: 'var(--color-accent-soft)',
    },
    {
        icon: ClipboardCheck,
        title: 'Smart Attendance',
        description: 'Quick checklist-based attendance marking per batch. Track presence, absence, and late arrivals with full history.',
        color: 'var(--color-success)',
        bg: 'var(--color-success-soft)',
    },
    {
        icon: BarChart3,
        title: 'Deep Analytics',
        description: 'Visualize attendance trends, exam performance, syllabus coverage, and teaching productivity with professional charts.',
        color: 'var(--color-info)',
        bg: 'var(--color-info-soft)',
    },
    {
        icon: BookOpen,
        title: 'Curriculum Tracking',
        description: 'Create lesson plans, mark topics covered, and monitor syllabus completion rates per batch in real time.',
        color: 'var(--color-gold)',
        bg: 'var(--color-gold-soft)',
    },
    {
        icon: Calendar,
        title: 'Schedule & Calendar',
        description: 'Manage your class schedules with a visual calendar. Integrates with Google Calendar for external schedules.',
        color: '#a78bfa',
        bg: 'rgba(167, 139, 250, 0.15)',
    },
    {
        icon: Shield,
        title: 'Secure & Private',
        description: 'Teacher-only access with admin verification. Your data stays private — no student access, ever.',
        color: 'var(--color-danger)',
        bg: 'var(--color-danger-soft)',
    },
];

const benefits = [
    'Private tutoring centers managing multiple batches across grades',
    'Freelance tutors teaching academic English (Classes 9–12)',
    'Coaching centers that need rigorous progress tracking',
    'Teachers who want statistical insights into student performance',
    'Educators who need exportable reports for analysis',
    'Professionals who manage schedules across multiple institutions',
];

export default function Landing() {
    return (
        <div className="landing-page">
            {/* Navbar */}
            <nav
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'rgba(10, 15, 30, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0 var(--space-8)',
                    height: 'var(--header-height)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            background: 'linear-gradient(135deg, var(--color-accent), #0d9488)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: 'var(--font-size-sm)',
                        }}
                    >
                        CT
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
                        Coach<span style={{ color: 'var(--color-accent)' }}>Track</span>
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Link to="/login" className="btn btn-ghost">
                        Login
                    </Link>
                    <Link to="/register" className="btn btn-primary">
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="landing-hero-content animate-fade-in-up">
                    <div className="landing-hero-badge">
                        <Zap size={16} />
                        Built for Coaching Tutors
                    </div>
                    <h1>
                        The <span className="highlight">Smarter Way</span> to
                        <br />
                        Manage Your <span className="highlight-gold">Coaching Center</span>
                    </h1>
                    <p className="landing-hero-text">
                        Track batches, students, attendance, lessons, and exams — all in one
                        beautifully designed dashboard. Get statistical insights that drive
                        real teaching improvement.
                    </p>
                    <div className="landing-hero-buttons">
                        <Link to="/register" className="btn btn-primary btn-lg">
                            Start for Free
                            <ArrowRight size={18} />
                        </Link>
                        <a href="#features" className="btn btn-secondary btn-lg">
                            Explore Features
                        </a>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="landing-section" id="features">
                <div className="landing-section-header">
                    <h2>
                        Everything You Need to{' '}
                        <span style={{ color: 'var(--color-accent)' }}>Excel</span>
                    </h2>
                    <p>
                        A comprehensive toolkit designed specifically for coaching tutors who
                        take their teaching seriously.
                    </p>
                </div>
                <div className="landing-features">
                    {features.map((feature, i) => (
                        <div
                            key={i}
                            className={`landing-feature-card animate-fade-in-up stagger-${i + 1}`}
                        >
                            <div
                                className="landing-feature-icon"
                                style={{ background: feature.bg, color: feature.color }}
                            >
                                <feature.icon size={28} />
                            </div>
                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Who is this for? */}
            <section className="landing-section landing-who" id="who">
                <div className="landing-section-header">
                    <h2>
                        Who Is{' '}
                        <span style={{ color: 'var(--color-gold)' }}>CoachTrack</span> For?
                    </h2>
                    <p>
                        Designed for dedicated educators who want data-driven coaching
                        management.
                    </p>
                </div>
                <div className="landing-who-grid">
                    <div>
                        <h3
                            style={{
                                fontSize: 'var(--font-size-xl)',
                                fontWeight: 700,
                                marginBottom: 'var(--space-6)',
                            }}
                        >
                            Perfect for tutors and coaching centers that demand{' '}
                            <span style={{ color: 'var(--color-accent)' }}>
                                rigorous management
                            </span>
                        </h3>
                        <ul className="landing-who-list">
                            {benefits.map((benefit, i) => (
                                <li key={i}>
                                    <CheckCircle size={20} />
                                    <span>{benefit}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div
                        style={{
                            background: 'var(--color-bg-card)',
                            borderRadius: 'var(--radius-xl)',
                            border: '1px solid var(--color-border)',
                            padding: 'var(--space-8)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: 'var(--space-4)',
                        }}
                    >
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                background:
                                    'linear-gradient(135deg, var(--color-accent), var(--color-gold))',
                                borderRadius: 'var(--radius-xl)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <GraduationCap size={40} color="white" />
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                            Ready to Transform Your Teaching?
                        </h3>
                        <p
                            style={{
                                color: 'var(--color-text-secondary)',
                                fontSize: 'var(--font-size-sm)',
                            }}
                        >
                            Join CoachTrack today and bring scientific management to your
                            coaching practice.
                        </p>
                        <Link
                            to="/register"
                            className="btn btn-gold btn-lg"
                            style={{ width: '100%' }}
                        >
                            Create Free Account
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <p>
                    © {new Date().getFullYear()} CoachTrack — Built for educators who care
                    about progress.
                </p>
            </footer>
        </div>
    );
}
