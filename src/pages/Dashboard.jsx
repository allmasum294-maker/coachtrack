import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
    Users, Calendar, TrendingUp, ClipboardCheck, BookOpen, 
    ArrowRight, Clock, AlertTriangle, PlayCircle, 
    Crown, Activity, Zap, ChevronRight, ShieldAlert
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfWeek, endOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';
import { batchService } from '../services/batchService';

// Helper for safe date conversion from Firestore or String
const safeToDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate();
    const d = new Date(dateVal);
    return isValid(d) ? d : null;
};

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

            // 1. Fetch ENROLLED Students
            const studentSnap = await getDocs(query(
                collection(db, 'students'), 
                where('teacherId', '==', uid),
                where('status', '==', 'enrolled')
            ));
            const studentIds = studentSnap.docs.map(d => d.id);
            const studentsMap = {};
            studentSnap.docs.forEach(d => {
                studentsMap[d.id] = { id: d.id, ...d.data() };
            });

            // 2. Fetch ACTIVE Batches
            const activeBatches = await batchService.getBatches(uid, true);
            const activeBatchIds = activeBatches.map(b => b.id);
            const activeBatchMap = {};
            activeBatches.forEach(b => { activeBatchMap[b.id] = b; });

            // 3. Fetch Schedules and filter by active batches
            const scheduleSnap = await getDocs(query(collection(db, 'schedules'), where('teacherId', '==', uid)));
            const schedules = scheduleSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => activeBatchIds.includes(s.batchId));
            
            let classesToday = 0;
            const upcoming = schedules
                .filter((s) => {
                    if (!s.date || s.status === 'cancelled') return false;
                    const d = safeToDate(s.date);
                    if (!d) return false;
                    if (isToday(d)) classesToday++;
                    return d >= now;
                })
                .sort((a, b) => {
                    const da = safeToDate(a.date) || new Date(0);
                    const db2 = safeToDate(b.date) || new Date(0);
                    return da - db2;
                })
                .slice(0, 5);

            // 4. Fetch Attendance audit
            const attendanceSnap = await getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid)));
            let weekRecords = 0;
            let weekPresent = 0;
            const studentAttendance = {};
            const lastAttendDate = {};

            studentIds.forEach(id => {
                studentAttendance[id] = { studentId: id, total: 0, present: 0 };
            });

            attendanceSnap.docs.forEach((dSnapshot) => {
                const data = dSnapshot.data();
                const recordDate = safeToDate(data.date);
                if (!recordDate) return;
                const isThisWeek = recordDate >= weekStart && recordDate <= weekEnd;
                
                if (data.records) {
                    data.records.forEach((r) => {
                        if (studentAttendance[r.studentId]) {
                            if (isThisWeek) {
                                weekRecords++;
                                if (r.status === 'present') weekPresent++;
                            }
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

            Object.values(studentAttendance).forEach(stats => {
                if (stats.total > 2) {
                    const rate = (stats.present / stats.total) * 100;
                    if (rate < 70) {
                        addRisk(stats.studentId, `Critical Attendance (${Math.round(rate)}%)`, 'high');
                    }
                }
            });

            Object.keys(studentsMap).forEach(sid => {
                const lastA = lastAttendDate[sid];
                if (studentAttendance[sid] && studentAttendance[sid].total > 0 && lastA && lastA < twoWeeksAgo) {
                    addRisk(sid, 'Inactivity Period > 14 Days', 'high');
                }
            });

            // 5. Fetch Exam Performance
            const examSnap = await getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid)));
            let nextExamDays = null;
            const examsData = examSnap.docs.map(e => ({ id: e.id, ...e.data() }));

            const upcomingExams = examsData
                .filter(e => {
                    const ed = safeToDate(e.date);
                    if (!ed) return false;
                    ed.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    return ed >= today;
                })
                .sort((a, b) => {
                    const da = safeToDate(a.date) || new Date(0);
                    const db2 = safeToDate(b.date) || new Date(0);
                    return da - db2;
                });

            if (upcomingExams.length > 0) {
                const earliestExamDate = safeToDate(upcomingExams[0].date);
                if (earliestExamDate) {
                    nextExamDays = differenceInDays(earliestExamDate, new Date());
                    if (nextExamDays < 0) nextExamDays = 0;
                }
            }

            const pastExams = examsData
                .filter(e => e.date && !upcomingExams.find(ue => ue.id === e.id))
                .sort((a, b) => {
                    const da = safeToDate(a.date) || new Date(0);
                    const db2 = safeToDate(b.date) || new Date(0);
                    return da - db2;
                });

            const studentScores = {};
            pastExams.forEach(exam => {
                if (exam.scores) {
                    exam.scores.forEach(sc => {
                        if (studentAttendance[sc.studentId]) {
                            if (!studentScores[sc.studentId]) studentScores[sc.studentId] = [];
                            const perc = exam.totalMarks > 0 ? (sc.marksObtained / exam.totalMarks) * 100 : 0;
                            studentScores[sc.studentId].push(perc);
                        }
                    });
                }
            });

            Object.keys(studentScores).forEach(sid => {
                const scores = studentScores[sid];
                if (scores.length >= 2) {
                    const last = scores[scores.length - 1];
                    const prev = scores[scores.length - 2];
                    if (last < prev - 10) { 
                        addRisk(sid, `Performance Regression Detected`, 'medium');
                    }
                }
            });

            const finalAtRiskList = Object.values(riskMap).sort((a,b) => b.score - a.score);

            setStats({
                classesToday,
                weekAttendance,
                nextExamDays: nextExamDays === null ? '—' : (nextExamDays === 0 ? 'Today' : `${nextExamDays} Days`),
                attentionNeeded: finalAtRiskList.length,
            });

            setAtRiskList(finalAtRiskList);
            setUpcomingClasses(upcoming);
        } catch (err) {
            console.error('Core Analytical Fault:', err);
        } finally {
            setLoading(false);
        }
    }

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="glass-panel" style={{ padding: '40px', marginBottom: 'var(--space-8)', position: 'relative', overflow: 'hidden', border: 'none', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 64, 175, 0.05) 100%)' }}>
                <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, background: 'var(--color-primary)', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '20px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Crown size={12} /> Elite Educator Profile
                            </div>
                        </div>
                        <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                            {greeting()}, <span className="text-gradient">{userProfile?.displayName?.split(' ')[0] || 'Academic Director'}</span>
                        </h1>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '16px', fontWeight: 500, maxWidth: '500px', lineHeight: 1.6 }}>
                            Your academic landscape is synchronized. You have <span style={{ color: 'var(--color-text-primary)', fontWeight: 800 }}>{stats.classesToday} active sessions</span> targeting optimized learning outcomes today.
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Link to="/attendance" className="btn btn-primary" style={{ padding: '0 28px', height: '48px', borderRadius: '14px', fontWeight: 900, boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4)', gap: '10px' }}>
                            <ClipboardCheck size={20} /> SYNC ATTENDANCE
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: 'var(--space-8)' }}>
                {[
                    { label: 'Active Sessions', val: stats.classesToday, icon: <PlayCircle size={24} />, color: '#10b981', delay: '0s' },
                    { label: 'Yield Rate (Week)', val: `${stats.weekAttendance}%`, icon: <TrendingUp size={24} />, color: '#3b82f6', delay: '0.1s' },
                    { label: 'Phase Assessment', val: stats.nextExamDays, icon: <Clock size={24} />, color: '#f59e0b', delay: '0.2s' },
                    { label: 'Critical Profiles', val: stats.attentionNeeded, icon: <AlertTriangle size={24} />, color: '#ef4444', delay: '0.3s', isUrgent: stats.attentionNeeded > 0 }
                ].map((m, i) => (
                    <div key={i} className="glass-card hover-lift animate-fade-in-up" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', animationDelay: m.delay }}>
                        <div style={{ 
                            width: '54px', height: '54px', borderRadius: '16px', 
                            background: `${m.color}15`, color: m.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: m.isUrgent ? `0 0 20px ${m.color}30` : 'none'
                        }}>
                            {m.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{m.label}</div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: m.isUrgent ? m.color : 'inherit' }}>{m.val}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Intervention Monitor */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ 
                        padding: '24px 32px', 
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}>
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>Mission Control: Intervention Alerts</h3>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Profiles requiring immediate cognitive realignment</p>
                            </div>
                        </div>
                        <div style={{ padding: '6px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '10px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                            {atRiskList.length} PROFILES FLAGGED
                        </div>
                    </div>

                    <div style={{ padding: '32px' }}>
                        {atRiskList.length === 0 ? (
                            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                                <div style={{ width: '100px', height: '100px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', marginBottom: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={48} />
                                </div>
                                <h4 style={{ fontSize: '22px', fontWeight: 900, color: '#10b981', marginBottom: '8px' }}>Ecosystem Stability: Optimal</h4>
                                <p style={{ color: 'var(--color-text-muted)', maxWidth: '340px', margin: 'auto', fontWeight: 500 }}>No performance deltas or adherence risks identified in the current cycle.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {atRiskList.map((risk, i) => (
                                    <div key={risk.studentId} className="glass-panel hover-lift" style={{ 
                                        padding: '20px', 
                                        borderLeft: `5px solid ${risk.score >= 2 ? '#ef4444' : '#f59e0b'}`,
                                        background: 'rgba(255, 255, 255, 0.02)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '15px' }}>
                                                    {risk.name.charAt(0)}
                                                </div>
                                                <div style={{ fontWeight: 800, fontSize: '15px' }}>{risk.name}</div>
                                            </div>
                                            <Zap size={16} style={{ color: risk.score >= 2 ? '#ef4444' : '#f59e0b', opacity: 0.8 }} />
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {risk.reasons.map((r, i) => (
                                                <span key={i} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                        <Link to="/students" style={{ display: 'flex', width: '100%', marginTop: '20px', fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textDecoration: 'none', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                            PROFILE ANALYSIS <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Operational Queue */}
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Operational Queue</h3>
                            <Link to="/schedule" style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textDecoration: 'none' }}>LEDGER</Link>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {upcomingClasses.length === 0 ? (
                                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 500 }}>
                                    No sessions buffered.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {upcomingClasses.map((cls) => (
                                        <div key={cls.id} className="glass-panel hover-lift" style={{ 
                                            padding: '16px 20px', 
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                                                     {(() => {
                                                        const d = safeToDate(cls.date);
                                                        return d ? `${format(d, 'HH:mm')} • ${format(d, 'EEE')}` : 'TBA';
                                                     })()}
                                                    </div>
                                                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--color-text-primary)' }}>{cls.title}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{cls.batchName}</div>
                                                </div>
                                                <Link to={`/sessions?scheduleId=${cls.id}&batchId=${cls.batchId}`} style={{ 
                                                    width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary)', 
                                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                                                }}>
                                                    <PlayCircle size={20} />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Access Matrix */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px', color: 'var(--color-text-muted)' }}>Navigation Matrix</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { to: '/attendance', icon: <ClipboardCheck size={20} />, label: 'Presence', color: '#10b981' },
                                { to: '/students', icon: <Users size={20} />, label: 'Profiles', color: '#3b82f6' },
                                { to: '/homework', icon: <BookOpen size={20} />, label: 'Curricula', color: '#8b5cf6' },
                                { to: '/analytics', icon: <TrendingUp size={20} />, label: 'Metrics', color: '#f59e0b' }
                            ].map((link, i) => (
                                <Link key={i} to={link.to} className="glass-panel hover-lift" style={{ 
                                    padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                    gap: '10px', textDecoration: 'none', color: 'inherit', border: '1px solid rgba(255,255,255,0.05)' 
                                }}>
                                    <div style={{ color: link.color }}>{link.icon}</div>
                                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{link.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
