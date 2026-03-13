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
            const pastExams = examsData
                .filter(e => e.date && !upcomingExams.find(ue => ue.id === e.id))
                .sort((a, b) => {
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
        if (!date) return '—';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return '—';
            if (isToday(d)) return 'Today';
            if (isTomorrow(d)) return 'Tomorrow';
            return format(d, 'EEE, MMM d');
        } catch (err) {
            console.error('Error formatting date:', err);
            return '—';
        }
    }

    function formatClassTime(timeStr) {
        if (!timeStr) return 'TBD';
        try {
            const [hoursRaw, minutesRaw] = timeStr.split(':');
            let h = parseInt(hoursRaw, 10);
            const m = parseInt(minutesRaw, 10) || 0;
            
            if (isNaN(h)) return timeStr;

            // Handle AM/PM if string natively has it stored
            const lower = timeStr.toLowerCase();
            if (lower.includes('pm') && h < 12) h += 12;
            if (lower.includes('am') && h === 12) h = 0;

            const d = new Date();
            d.setHours(h, m, 0);
            return format(d, 'h:mm a');
        } catch (err) {
            console.error('Error formatting time:', err);
            return timeStr;
        }
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
            <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1>
                        {greeting()},{' '}
                        <span style={{ color: 'var(--color-accent)' }}>
                            {userProfile?.displayName || 'Teacher'}
                        </span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>Here's an overview of your coaching activity today</p>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-3)', display: 'none' /* hidden on mobile natively via css if needed */ }}>
                     <Link to="/schedule" className="btn btn-primary" style={{ boxShadow: 'var(--shadow-glow)' }}>
                         <Calendar size={18} /> Schedule Class
                     </Link>
                </div>
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
            <div className="dashboard-grid" style={{ alignItems: 'start' }}>
                
                {/* Students At Risk */}
                <div className="card dashboard-risk-card" style={{ border: '1px solid var(--color-danger-soft)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.05)' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', background: 'linear-gradient(to right, var(--color-danger-soft), transparent)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                        <div>
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: 'var(--color-danger)', padding: '8px', borderRadius: 'var(--radius-full)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertTriangle size={20} />
                                </div>
                                <span style={{ color: 'var(--color-danger)', fontWeight: 800 }}>Predictive "At-Risk" Alerts</span>
                            </div>
                            <div className="card-subtitle" style={{ marginLeft: '40px' }}>Students needing immediate intervention based on recent attendance and grade drops (Last 3 Weeks).</div>
                        </div>
                    </div>
                    <div style={{ padding: 'var(--space-5)' }}>
                        {atRiskList.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
                                <div style={{ background: 'var(--color-success-soft)', padding: '16px', borderRadius: 'var(--radius-full)', color: 'var(--color-success)', display: 'inline-flex', marginBottom: 'var(--space-4)' }}>
                                    <PlayCircle size={32} />
                                </div>
                                <div className="empty-state-title" style={{ color: 'var(--color-success)' }}>Zero Students At Risk!</div>
                                <div className="empty-state-text">All your active students are performing well above the threshold. Keep up the great work!</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                                {atRiskList.map(risk => (
                                    <div key={risk.studentId} className="card-interactive" style={{ 
                                        background: 'var(--color-bg-card)', 
                                        padding: 'var(--space-5)', 
                                        borderRadius: 'var(--radius-lg)', 
                                        border: `1px solid ${risk.score >= 2 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                        borderLeft: `4px solid ${risk.score >= 2 ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                                        boxShadow: 'var(--shadow-sm)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                 <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', color: 'var(--color-text-primary)' }}>
                                                    {risk.name.charAt(0)}
                                                </div>
                                                <h4 style={{ fontWeight: 700, fontSize: '16px' }}>{risk.name}</h4>
                                            </div>
                                            <span className={`badge ${risk.score >= 2 ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px' }}>
                                                {risk.score >= 2 ? 'High Risk' : 'Medium Risk'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Flagged Reasons:</div>
                                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.4 }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* Upcoming Classes */}
                    <div className="card">
                        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
                            <div>
                                <div className="card-title">Upcoming Sessions</div>
                                <div className="card-subtitle">Your agenda for the next few days.</div>
                            </div>
                            <Link to="/schedule" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-accent)' }}>
                                View Calendar <ArrowRight size={16} />
                            </Link>
                        </div>
                        <div className="dashboard-upcoming" style={{ padding: 'var(--space-2) 0' }}>
                            {upcomingClasses.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                                    <Calendar size={40} style={{ color: 'var(--color-border)', marginBottom: 'var(--space-3)' }} />
                                    <div className="empty-state-title">Your schedule is clear</div>
                                    <div className="empty-state-text">
                                        You don't have any upcoming classes scheduled.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {upcomingClasses.map((cls) => (
                                        <div key={cls.id} className="upcoming-class-item" style={{ 
                                            padding: 'var(--space-4)', 
                                            borderBottom: '1px solid var(--color-bg-secondary)',
                                            margin: 0,
                                            borderRadius: 0,
                                            background: 'transparent'
                                        }}>
                                            <div className="upcoming-class-time" style={{ background: 'var(--color-bg-elevated)', minWidth: '70px', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                                                <span className="time" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{formatClassTime(cls.startTime)}</span>
                                                <span className="day" style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>{formatClassDate(cls.date)}</span>
                                            </div>
                                            <div className="upcoming-class-info" style={{ flex: 1 }}>
                                                <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', marginBottom: '2px' }}>{cls.title}</h4>
                                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                    Batch: {cls.batchName || 'Unassigned'}
                                                </p>
                                            </div>
                                            <Link to={`/sessions?scheduleId=${cls.id}&batchId=${cls.batchId}`} className="btn btn-ghost btn-icon" title="Log Session">
                                                <PlayCircle size={18} style={{ color: 'var(--color-text-muted)' }} />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="card">
                        <div className="card-header" style={{ paddingBottom: 'var(--space-3)' }}>
                            <div className="card-title">Quick Links</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: 'var(--space-4)', paddingTop: 0 }}>
                            <Link to="/attendance" className="btn btn-secondary" style={{ justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: 'var(--space-4)', height: 'auto' }}>
                                <ClipboardCheck size={24} style={{ color: 'var(--color-accent)' }} /> 
                                <span style={{ fontSize: 'var(--font-size-sm)' }}>Attendance</span>
                            </Link>
                            <Link to="/students" className="btn btn-secondary" style={{ justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: 'var(--space-4)', height: 'auto' }}>
                                <Users size={24} style={{ color: 'var(--color-info)' }} /> 
                                <span style={{ fontSize: 'var(--font-size-sm)' }}>Students</span>
                            </Link>
                            <Link to="/homework" className="btn btn-secondary" style={{ justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: 'var(--space-4)', height: 'auto' }}>
                                <BookOpen size={24} style={{ color: 'var(--color-primary)' }} /> 
                                <span style={{ fontSize: 'var(--font-size-sm)' }}>Homework</span>
                            </Link>
                            <Link to="/analytics" className="btn btn-secondary" style={{ justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: 'var(--space-4)', height: 'auto' }}>
                                <TrendingUp size={24} style={{ color: 'var(--color-gold)' }} /> 
                                <span style={{ fontSize: 'var(--font-size-sm)' }}>Analytics</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
