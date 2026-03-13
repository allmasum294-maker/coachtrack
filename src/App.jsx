import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import Students from './pages/Students';
import Schedule from './pages/Schedule';
import Attendance from './pages/Attendance';
import Lessons from './pages/Lessons';
import Exams from './pages/Exams';
import Analytics from './pages/Analytics';
import Export from './pages/Export';
import Notifications from './pages/Notifications';
import AdminPanel from './pages/AdminPanel';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-4)' }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile && !userProfile.isApproved && userProfile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'var(--color-warning-soft)',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              color: 'var(--color-warning)',
            }}
          >
            ⏳
          </div>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 800,
              marginBottom: 'var(--space-3)',
            }}
          >
            Pending Approval
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              lineHeight: 1.6,
            }}
          >
            Your account is awaiting admin approval. You'll be able to access the
            dashboard once an administrator approves your registration.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

// Public route wrapper (redirect to dashboard if logged in)
function PublicRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (currentUser && userProfile?.isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2235',
              color: '#f1f5f9',
              border: '1px solid #2a3654',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#14b8a6', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Protected Routes (inside app layout) */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/students" element={<Students />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/lessons" element={<Lessons />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/export" element={<Export />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
