import { Rocket, Target, Users, Code, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function About() {
    return (
        <div className="support-page" style={{ padding: '160px 24px 100px', maxWidth: '900px', margin: '0 auto', color: 'var(--color-text-primary)' }}>
            <div style={{ textAlign: 'center', marginBottom: '80px' }}>
                <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '8px', 
                    padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', 
                    color: 'var(--color-primary)', borderRadius: '100px', 
                    fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', 
                    letterSpacing: '0.1em', marginBottom: '24px'
                }}>
                    < Rocket size={14} /> Our Mission
                </div>
                <h1 style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    Empowering Private <br />
                    <span style={{ color: 'var(--color-primary)' }}>Education Centers</span>
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '20px', lineHeight: 1.6, maxWidth: '700px', margin: '0 auto', fontWeight: 500 }}>
                    CoachTrack was built to bridge the gap between complex enterprise software and simple, effective tools for local tutors and coaching institutions.
                </p>
            </div>

            <div style={{ display: 'grid', gap: '80px' }}>
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'center' }}>
                    <div className="glass-card" style={{ padding: '40px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '12px', width: 'fit-content', marginBottom: '24px' }}><Target size={24} /></div>
                        <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '16px' }}>What kind of project is this?</h2>
                        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px', fontWeight: 500 }}>
                            CoachTrack is an Open Source Management System tailored for individual teachers, coaching centers, and private tutors. It handles everything from student enrollment and batch scheduling to attendance tracking and performance analysis.
                        </p>
                    </div>
                    <div>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '20px' }}>
                            <li style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ color: 'var(--color-primary)', fontWeight: 900 }}>01</div>
                                <p style={{ fontWeight: 600 }}>Real-time student attendance monitoring.</p>
                            </li>
                            <li style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ color: 'var(--color-primary)', fontWeight: 900 }}>02</div>
                                <p style={{ fontWeight: 600 }}>Detailed lesson plans and homework tracking.</p>
                            </li>
                            <li style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ color: 'var(--color-primary)', fontWeight: 900 }}>03</div>
                                <p style={{ fontWeight: 600 }}>Comprehensive exam management & report cards.</p>
                            </li>
                        </ul>
                    </div>
                </section>

                <div style={{ 
                    padding: '60px 40px', 
                    textAlign: 'center', 
                    background: 'var(--color-bg-secondary)', 
                    borderRadius: '32px',
                    border: '1px solid var(--color-border)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <h2 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '24px' }}>Ready to Scale Your Coaching?</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '40px', fontWeight: 500 }}>Join hundreds of teachers who focus more on teaching and less on spreadsheets.</p>
                    <Link to="/register" className="btn btn-primary" style={{ padding: '0 40px', height: '56px', borderRadius: '14px', fontWeight: 900 }}>JOIN TODAY</Link>
                </div>
            </div>
        </div>
    );
}
