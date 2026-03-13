import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // NOTE: This assumes standard Firebase authentication flow.
    // We mock the google login function for now if not implemented in AuthContext,
    // but provide a beautiful UI button as requested.
    async function handleGoogleLogin() {
        setLoading(true);
        // await loginWithGoogle() -> if implemented in context
        // For now, this is just the UI implementation as requested.
        setTimeout(() => setLoading(false), 1000); 
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Too many attempts. Please try again later.');
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            background: 'linear-gradient(135deg, var(--color-accent), #0d9488)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto var(--space-4)',
                        }}
                    >
                        <LogIn size={24} color="white" />
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Login to access your coaching dashboard</p>
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
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        style={{ width: '100%', marginTop: 'var(--space-2)' }}
                    >
                        {loading ? (
                            <span className="loading-spinner" style={{ width: 20, height: 20 }} />
                        ) : (
                            'Login'
                        )}
                    </button>
                </form>

                <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--space-4) 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                        <span style={{ padding: '0 var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
                    </div>
                    
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                        CoachTrack wants to login with Google
                    </p>
                    
                    <button 
                        type="button" 
                        onClick={handleGoogleLogin}
                        className="btn" 
                        style={{ 
                            width: '100%', 
                            background: 'white', 
                            color: '#333', 
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--space-2)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                    >
                        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                <div className="auth-footer" style={{ marginTop: 'var(--space-6)' }}>
                    Don't have an account?{' '}
                    <Link to="/register">Register here</Link>
                </div>
            </div>
        </div>
    );
}
