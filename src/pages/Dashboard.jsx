import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
    Users,
    GraduationCap,
    Calendar,
    TrendingUp,
    ClipboardCheck,
    BookOpen,
    ArrowRight,
    Clock,
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns';

export default function Dashboard() {
    const { currentUser, userProfile } = useAuth();
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeBatches: 0,
        classesThisWeek: 0,
        avgAttendance: 0,
    });
    const [upcomingClasses, setUpcomingClasses] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        loadDashboardData();
    }, [currentUser]);

    async function loadDashboardData() {
        try {
            const uid = currentUser.uid;

            // Fetch batches
            const batchSnap = await getDocs(
                query(collection(db, 'batches'), where('teacherId', '==', uid))
            );
            const batches = batchSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Fetch students
            const studentSnap = await getDocs(
                query(collection(db, 'students'), where('teacherId', '==', uid))
            );

            // Fetch schedules this week
            const now = new Date();
            const weekStart = startOfWeek(now, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

            const scheduleSnap = await getDocs(
                query(collection(db, 'schedules'), where('teacherId', '==', uid))
            );
            const schedules = scheduleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

            // Compute upcoming classes (next 5 that haven't passed)
            const upcoming = schedules
                .filter((s) => {
                    if (!s.date) return false;
                    const d = s.date.toDate ? s.date.toDate() : new Date(s.date);
                    return d >= now && s.status !== 'cancelled';
                })
                .sort((a, b) => {
                    const da = a.date.toDate ? a.date.toDate() : new Date(a.date);
                    const db2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                    return da - db2;
                })
                .slice(0, 5);

            // Fetch attendance for avg
            const attendanceSnap = await getDocs(
                query(collection(db, 'attendance'), where('teacherId', '==', uid))
            );
            let totalPresent = 0;
            let totalRecords = 0;
            attendanceSnap.docs.forEach((d) => {
                const data = d.data();
                if (data.records) {
                    data.records.forEach((r) => {
                        totalRecords++;
                        if (r.status === 'present') totalPresent++;
                    });
                }
            });

            setStats({
                totalStudents: studentSnap.size,
                activeBatches: batches.length,
                classesThisWeek: schedules.filter((s) => {
                    if (!s.date) return false;
                    const d = s.date.toDate ? s.date.toDate() : new Date(s.date);
                    return d >= weekStart && d <= weekEnd && s.status !== 'cancelled';
                }).length,
                avgAttendance: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0,
            });

            setUpcomingClasses(upcoming);
        } catch (err) {
            console.error('Error loading dashboard:', err);
        } finally {
            setLoading(false);
        }
    }

    function formatClassDate(date) {
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isToday(d)) return 'Today';
        if (isTomorrow(d)) return 'Tomorrow';
        return format(d, 'EEE, MMM d');
    }

    function formatClassTime(date) {
        const d = date.toDate ? date.toDate() : new Date(date);
        return format(d, 'h:mm a');
    }

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="loading-spinner" />
                <p style={{ color: 'var(--color-text-muted)' }}>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Welcome */}
            <div className="dashboard-welcome">
                <h1>
                    {greeting()},{' '}
                    <span style={{ color: 'var(--color-accent)' }}>
                        {userProfile?.displayName || 'Teacher'}
                    </span>
                </h1>
                <p>Here's an overview of your coaching activity</p>
            </div>

            {/* Stats */}
            <div className="dashboard-stats">
                <div className="stat-card animate-fade-in-up stagger-1">
                    <div className="stat-card-icon teal">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.totalStudents}</div>
                        <div className="stat-card-label">Total Students</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-2">
                    <div className="stat-card-icon gold">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.activeBatches}</div>
                        <div className="stat-card-label">Active Batches</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-3">
                    <div className="stat-card-icon blue">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.classesThisWeek}</div>
                        <div className="stat-card-label">Classes This Week</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-4">
                    <div className="stat-card-icon green">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.avgAttendance}%</div>
                        <div className="stat-card-label">Avg Attendance</div>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="dashboard-grid">
                {/* Upcoming Classes */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Upcoming Classes</div>
                            <div className="card-subtitle">Your next scheduled sessions</div>
                        </div>
                        <Link to="/schedule" className="btn btn-ghost btn-sm">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="dashboard-upcoming">
                        {upcomingClasses.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                <Calendar size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }} />
                                <div className="empty-state-title">No upcoming classes</div>
                                <div className="empty-state-text">
                                    Schedule your first class to see it here.
                                </div>
                            </div>
                        ) : (
                            upcomingClasses.map((cls) => (
                                <div key={cls.id} className="upcoming-class-item">
                                    <div className="upcoming-class-time">
                                        <span className="time">{formatClassTime(cls.date)}</span>
                                        <span className="day">{formatClassDate(cls.date)}</span>
                                    </div>
                                    <div className="upcoming-class-info">
                                        <h4>{cls.title}</h4>
                                        <p>{cls.batchName || 'No batch assigned'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">Quick Actions</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <Link to="/attendance" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <ClipboardCheck size={18} /> Mark Attendance
                        </Link>
                        <Link to="/schedule" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <Calendar size={18} /> Schedule Class
                        </Link>
                        <Link to="/students" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <Users size={18} /> Manage Students
                        </Link>
                        <Link to="/lessons" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <BookOpen size={18} /> Update Lessons
                        </Link>
                        <Link to="/analytics" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                            <TrendingUp size={18} /> View Analytics
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
