import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
    Users, Calendar, TrendingUp, ClipboardCheck, BookOpen, ArrowRight, Clock, AlertTriangle, PlayCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

export default function Dashboard() {
    const { currentUser, userProfile } = useAuth();
    const [stats, setStats] = useState({
        classesToday: 0,
        weekAttendance: 0,
        nextExamDays: null,
        attentionNeeded: 0,
    });
    const [upcomingClasses, setUpcomingClasses] = useState([]);
    const [atRiskList, setAtRiskList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        loadDashboardData();
    }, [currentUser]);

    async function loadDashboardData() {
        try {
            const uid = currentUser.uid;
            const now = new Date();
            const weekStart = startOfWeek(now, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

            // 1. Fetch Students
            const studentSnap = await getDocs(query(collection(db, 'students'), where('teacherId', '==', uid)));
            const studentIds = studentSnap.docs.map(d => d.id);
            const studentsMap = {};
            studentSnap.docs.forEach(d => {
                studentsMap[d.id] = { id: d.id, ...d.data() };
            });

            // 2. Fetch Schedules (For Today's Classes & Upcoming)
            const scheduleSnap = await getDocs(query(collection(db, 'schedules'), where('teacherId', '==', uid)));
            const schedules = scheduleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let classesToday = 0;
            const upcoming = schedules
                .filter((s) => {
                    if (!s.date || s.status === 'cancelled') return false;
                    const d = s.date.toDate ? s.date.toDate() : new Date(s.date);
                    if (isToday(d)) classesToday++;
                    return d >= now;
                })
                .sort((a, b) => {
                    const da = a.date.toDate ? a.date.toDate() : new Date(a.date);
                    const db2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                    return da - db2;
                })
                .slice(0, 5);

            // 3. Fetch Attendance (For Week Attendance & Attention Needed)
            const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid)));
            let weekRecords = 0;
            let weekPresent = 0;
            const studentAttendance = {};
            const lastAttendDate = {};

            studentIds.forEach(id => {
                studentAttendance[id] = { studentId: id, total: 0, present: 0 };
            });

            attendanceSnap.docs.forEach((d) => {
                const data = d.data();
                const recordDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
                const isThisWeek = recordDate >= weekStart && recordDate <= weekEnd;
                
                if (data.records) {
                    data.records.forEach((r) => {
                        if (isThisWeek) {
                            weekRecords++;
                            if (r.status === 'present') weekPresent++;
                        }
                        if (studentAttendance[r.studentId]) {
                            studentAttendance[r.studentId].total++;
                            if (r.status === 'present') {
                                studentAttendance[r.studentId].present++;
                                if (!lastAttendDate[r.studentId] || recordDate > lastAttendDate[r.studentId]) {
                                    lastAttendDate[r.studentId] = recordDate;
                                }
                            }
                        }
                    });
                }
            });

            const weekAttendance = weekRecords > 0 ? Math.round((weekPresent / weekRecords) * 100) : 0;

            // Risk Analysis logic
            const riskMap = {};
            function addRisk(sid, reason, severity) {
                if (!riskMap[sid]) {
                    riskMap[sid] = {
                        studentId: sid,
                        name: studentsMap[sid]?.name || 'Unknown',
                        reasons: [],
                        score: 0
                    };
                }
                if (!riskMap[sid].reasons.includes(reason)) {
                    riskMap[sid].reasons.push(reason);
                    riskMap[sid].score += (severity === 'high' ? 2 : 1);
                }
            }

            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(now.getDate() - 14);

            let attentionNeeded = 0;
            Object.values(studentAttendance).forEach(stats => {
                if (stats.total > 2) {
                    const rate = (stats.present / stats.total) * 100;
                    if (rate < 70) {
                        attentionNeeded++;
                        addRisk(stats.studentId, `Low attendance (${Math.round(rate)}%)`, 'high');
                    }
                }
            });

            Object.keys(studentsMap).forEach(sid => {
                const lastA = lastAttendDate[sid];
                if (studentAttendance[sid] && studentAttendance[sid].total > 0 && lastA && lastA < twoWeeksAgo) {
                    addRisk(sid, 'No attendance in 2+ weeks', 'high');
                }
            });

            // 4. Fetch Exams
            const examSnap = await getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid)));
            let nextExamDays = null;
            
            const examsData = examSnap.docs.map(e => ({ id: e.id, ...e.data() }));

            const upcomingExams = examsData
                .filter(e => {
                    if (!e.date) return false;
                    const ed = e.date.toDate ? e.date.toDate() : new Date(e.date);
                    ed.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    return ed >= today;
                })
                .sort((a, b) => {
                    const da = a.date.toDate ? a.date.toDate() : new Date(a.date);
                    const db2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                    return da - db2;
                });

            if (upcomingExams.length > 0) {
                const earliestExamDate = upcomingExams[0].date.toDate ? upcomingExams[0].date.toDate() : new Date(upcomingExams[0].date);
                nextExamDays = differenceInDays(earliestExamDate, new Date());
                if (nextExamDays < 0) nextExamDays = 0;
            }

            // Declining exam scores
            const pastExams = examsData.filter(e => !upcomingExams.find(ue => ue.id === e.id)).sort((a,b) => {
                const da = a.date.toDate ? a.date.toDate() : new Date(a.date);
                const db2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                return da - db2;
            });

            const studentScores = {};
            pastExams.forEach(exam => {
                if (exam.scores) {
                    exam.scores.forEach(sc => {
                        if (!studentScores[sc.studentId]) studentScores[sc.studentId] = [];
                        const perc = exam.totalMarks > 0 ? (sc.marksObtained / exam.totalMarks) * 100 : 0;
                        studentScores[sc.studentId].push(perc);
                    });
                }
            });

            Object.keys(studentScores).forEach(sid => {
                const scores = studentScores[sid];
                if (scores.length >= 2) {
                    const last = scores[scores.length - 1];
                    const prev = scores[scores.length - 2];
                    if (last < prev - 10) { 
                        addRisk(sid, `Score dropped significantly (>10%)`, 'medium');
                    }
                }
            });

            const finalAtRiskList = Object.values(riskMap).sort((a,b) => b.score - a.score);

            setStats({
                classesToday,
                weekAttendance,
                nextExamDays: nextExamDays === null ? '—' : (nextExamDays === 0 ? 'Today' : `${nextExamDays} days`),
                attentionNeeded: finalAtRiskList.length,
            });

            setAtRiskList(finalAtRiskList);
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

    function formatClassTime(timeStr) {
        if (!timeStr) return 'TBD';
        const [hours, minutes] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
        return format(d, 'h:mm a');
    }

    function getCountdownText(exam) {
        if (!exam) return 'No upcoming exams';
        const d = exam.date?.toDate ? exam.date.toDate() : new Date(exam.date);
        if (isToday(d)) return 'Today';
        if (isTomorrow(d)) return 'Tomorrow';
        const days = differenceInDays(d, new Date());
        return `In ${days} days`;
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
                        <PlayCircle size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.classesToday}</div>
                        <div className="stat-card-label">Classes Today</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-2">
                    <div className="stat-card-icon blue">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.weekAttendance}%</div>
                        <div className="stat-card-label">Week Attendance</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Live rate for current week</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-3">
                    <div className="stat-card-icon gold">
                        <Clock size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value">{stats.nextExamDays}</div>
                        <div className="stat-card-label">Next Exam In</div>
                    </div>
                </div>

                <div className="stat-card animate-fade-in-up stagger-4">
                    <div className="stat-card-icon red">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <div className="stat-card-value" style={{ color: stats.attentionNeeded > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                            {stats.attentionNeeded}
                        </div>
                        <div className="stat-card-label">Students At Risk</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Below 70% attendance</div>
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
                                        <span className="time">{formatClassTime(cls.startTime)}</span>
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

                {/* Students At Risk */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <div>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
                                Students At Risk
                            </div>
                            <div className="card-subtitle">Students needing attention based on performance & attendance</div>
                        </div>
                    </div>
                    <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                        {atRiskList.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
                                <div className="empty-state-title">No students at risk</div>
                                <div className="empty-state-text">All your active students are doing well!</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                                {atRiskList.map(risk => (
                                    <div key={risk.studentId} style={{ background: 'var(--color-bg-primary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${risk.score >= 2 ? 'var(--color-danger-soft)' : 'var(--color-warning-soft)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <h4 style={{ fontWeight: 600 }}>{risk.name}</h4>
                                            <span className={`badge ${risk.score >= 2 ? 'badge-red' : 'badge-yellow'}`}>
                                                {risk.score >= 2 ? 'High Risk' : 'Medium Risk'}
                                            </span>
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                            {risk.reasons.map((r, i) => (
                                                <li key={i}>{r}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
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
