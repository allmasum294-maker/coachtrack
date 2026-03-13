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

                <div className="auth-footer">
                    Don't have an account?{' '}
                    <Link to="/register">Register here</Link>
                </div>
            </div>
        </div>
    );
}
