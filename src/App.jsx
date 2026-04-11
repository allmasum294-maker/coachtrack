import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';

// Layout
import AppLayout from './components/layout/AppLayout';
import PublicLayout from './components/layout/PublicLayout';
import ErrorBoundary from './components/common/ErrorBoundary';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
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
import SessionLog from './pages/SessionLog';
import StudentAnalytics from './pages/StudentAnalytics';
import StudentTimeline from './pages/StudentTimeline';
import ReportCard from './pages/ReportCard';
import Homework from './pages/Homework';
import Leaderboard from './pages/Leaderboard';
import StudyPlans from './pages/StudyPlans';
import Schools from './pages/Schools';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { currentUser, userProfile, isApproved, isAdmin, loading } = useAuth();

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

  if (userProfile && !isApproved && !isAdmin) {
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
  const { currentUser, isApproved, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (currentUser && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: 'var(--color-accent)', secondary: 'var(--color-bg-card)' } },
              error: { iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-bg-card)' } },
            }}
          />
          <Routes>
            {/* Public Routes Wrapped in PublicLayout */}
            <Route element={<PublicLayout />}>
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
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />
            </Route>

            {/* Protected Routes (inside app layout) */}
            <Route
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <AppLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/students" element={<Students />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/schools" element={<Schools />} />
              <Route path="/lessons" element={<Lessons />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/sessions" element={<SessionLog />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/student-analytics" element={<StudentAnalytics />} />
              <Route path="/timeline" element={<StudentTimeline />} />
              <Route path="/report-card" element={<ReportCard />} />
              <Route path="/homework" element={<Homework />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/study-plans" element={<StudyPlans />} />
              <Route path="/export" element={<Export />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
