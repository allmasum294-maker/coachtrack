import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#0a0f1e', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>Application Error</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', marginBottom: '24px' }}>
            A runtime error occurred in the application. This is usually caused by missing data or a small code mismatch.
          </p>
          <div style={{ background: '#1a2235', padding: '16px', borderRadius: '8px', textAlign: 'left', width: '100%', maxWidth: '600px', overflowX: 'auto', border: '1px solid #2a3654' }}>
            <code style={{ fontSize: '12px', color: '#f8fafc' }}>{this.state.error?.toString()}</code>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button 
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/dashboard'; }} 
                style={{ padding: '10px 20px', background: 'transparent', border: '2px solid #3b82f6', borderRadius: '8px', color: '#3b82f6', cursor: 'pointer', fontWeight: 700 }}
              >
                Return to Dashboard
              </button>
              <button 
                onClick={() => window.location.reload()} 
                style={{ padding: '10px 20px', background: 'var(--color-primary)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 800 }}
              >
                Reload Page
              </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
