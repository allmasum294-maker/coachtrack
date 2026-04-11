import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, User, AlertCircle, Sparkles, ShieldCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const { register, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    async function handleGoogleRegister() {
        setError('');
        setIsGoogleLoading(true);
        try {
            toast.success('Redirecting to Google login...');
            await loginWithGoogle();
        } catch (err) {
            console.error('Google Auth Error:', err);
            setError('Google sign-up failed. Please try again.');
            setIsGoogleLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            return setError('Passwords do not match.');
        }
        if (password.length < 6) {
            return setError('Password is too short. Please use at least 6 characters.');
        }

        setIsSubmitting(true);
        try {
            await register(email, password, displayName);
            setSuccess(true);
        } catch (err) {
            console.error('Registration Error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already in use.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Please check your email format.');
            } else {
                setError('Failed to create account. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="auth-page" style={{ 
                background: 'var(--color-bg-primary)',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
            }}>
                <div className="glass-card animate-fade-in-up" style={{ textAlign: 'center', maxWidth: '500px', padding: '60px' }}>
                    <div style={{ 
                        width: 80, height: 80, 
                        background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                        borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 32px', border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                        <ShieldCheck size={40} />
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px' }}>Account Created!</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', lineHeight: 1.6, marginBottom: '40px', fontWeight: 500 }}>
                        Your account has been set up successfully. You can now log in and start managing your classes.
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', height: '56px', borderRadius: '14px', fontWeight: 900 }}>
                        GO TO LOGIN
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page" style={{ 
            background: 'var(--color-bg-primary)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Mesh */}
            <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)', zIndex: 0 }} />
            <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(217, 119, 6, 0.05) 0%, transparent 70%)', zIndex: 0 }} />

            <div className="glass-card animate-fade-in-up" style={{ 
                width: '100%', 
                maxWidth: '500px', 
                padding: '48px',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5)'
            }}>
                <div className="auth-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ 
                        width: 64, height: 64, 
                        background: 'linear-gradient(135deg, var(--color-gold), #b45309)',
                        borderRadius: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px', color: 'white',
                        boxShadow: '0 12px 24px rgba(217, 119, 6, 0.3)'
                    }}>
                        <UserPlus size={32} />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.02em' }}>Create Account</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', fontWeight: 500 }}>Join our coaching platform as a teacher</p>
                </div>

                {error && (
                    <div className="animate-shake" style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', 
                        padding: '16px', background: 'rgba(239, 68, 68, 0.1)', 
                        color: '#ef4444', borderRadius: '12px', 
                        fontSize: '13px', fontWeight: 700, marginBottom: '24px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Your full name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                style={{ paddingLeft: '48px', height: '52px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                className="form-input"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{ paddingLeft: '48px', height: '52px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '48px', height: '52px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>Verify</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    style={{ paddingLeft: '48px', height: '52px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting || isGoogleLoading}
                        style={{ width: '100%', height: '52px', borderRadius: '12px', fontWeight: 900, fontSize: '15px', marginTop: '8px', boxShadow: '0 15px 30px -5px rgba(59, 130, 246, 0.4)', background: 'linear-gradient(135deg, var(--color-gold), #b45309)' }}
                    >
                        {isSubmitting ? <span className="loading-spinner" style={{ width: 20, height: 20 }} /> : 'REGISTER'}
                    </button>
                </form>

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>OR REGISTER WITH</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                    
                    <button 
                        type="button" 
                        onClick={handleGoogleRegister}
                        disabled={isSubmitting || isGoogleLoading}
                        className="btn" 
                        style={{ 
                            width: '100%', height: '52px', background: 'white', color: '#000', 
                            borderRadius: '12px', display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: '12px', fontWeight: 800, fontSize: '14px',
                            opacity: (isSubmitting || isGoogleLoading) ? 0.7 : 1,
                            cursor: (isSubmitting || isGoogleLoading) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isGoogleLoading ? (
                            <span className="loading-spinner" style={{ width: 20, height: 20, borderTopColor: '#000' }} />
                        ) : (
                            <>
                                <svg width="20" height="20" viewBox="0 0 48 48">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                </svg>
                                Google Register
                            </>
                        )}
                    </button>
                    
                    <p style={{ marginTop: '32px', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>
                        Already have an account? <Link to="/login" style={{ color: 'var(--color-gold)', fontWeight: 900 }}>LOGIN</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
