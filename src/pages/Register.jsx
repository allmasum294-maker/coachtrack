import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';

export default function Register() {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            return setError('Passwords do not match.');
        }
        if (password.length < 6) {
            return setError('Password must be at least 6 characters.');
        }

        setLoading(true);
        try {
            await register(email, password, displayName);
            setSuccess(true);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="auth-page">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            background: 'var(--color-success-soft)',
                            borderRadius: 'var(--radius-full)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto var(--space-6)',
                        }}
                    >
                        <UserPlus size={32} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <h1
                        style={{
                            fontSize: 'var(--font-size-2xl)',
                            fontWeight: 800,
                            marginBottom: 'var(--space-3)',
                        }}
                    >
                        Registration Successful!
                    </h1>
                    <p
                        style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-base)',
                            marginBottom: 'var(--space-6)',
                            lineHeight: 1.6,
                        }}
                    >
                        Your account has been created. An <strong>admin must approve</strong>{' '}
                        your account before you can access the dashboard. You'll be able to
                        login once approved.
                    </p>
                    <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            background: 'linear-gradient(135deg, var(--color-gold), #d97706)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto var(--space-4)',
                        }}
                    >
                        <UserPlus size={24} color="white" />
                    </div>
                    <h1>Create Account</h1>
                    <p>Register as a tutor to get started</p>
                </div>

                {error && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-3) var(--space-4)',
                            background: 'var(--color-danger-soft)',
                            color: 'var(--color-danger)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-sm)',
                            marginBottom: 'var(--space-4)',
                        }}
                    >
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-text-muted)',
                                }}
                            />
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Your full name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-text-muted)',
                                }}
                            />
                            <input
                                className="form-input"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-text-muted)',
                                }}
                            />
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Minimum 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--color-text-muted)',
                                }}
                            />
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Repeat your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-gold btn-lg"
                        disabled={loading}
                        style={{ width: '100%', marginTop: 'var(--space-2)' }}
                    >
                        {loading ? (
                            <span className="loading-spinner" style={{ width: 20, height: 20 }} />
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login">Login here</Link>
                </div>
            </div>
        </div>
    );
}
