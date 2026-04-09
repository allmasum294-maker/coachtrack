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
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '24px', padding: '10px 20px', background: '#14b8a6', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
