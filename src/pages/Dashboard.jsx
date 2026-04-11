import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    Users, Calendar, TrendingUp, ClipboardCheck, BookOpen, 
    ArrowRight, Clock, AlertTriangle, PlayCircle, 
    Crown, Activity, Zap, ChevronRight, ShieldAlert
} from 'lucide-react';
import { format, isToday, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { safeToDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';

export default function Dashboard() {
    const { userProfile } = useAuth();
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
        if (!userProfile?.id) return;
        loadDashboardData();
    }, [userProfile]);

    async function loadDashboardData() {
        try {
            const uid = userProfile.id;
            const now = new Date();
            const weekStart = startOfWeek(now, { weekStartsOn: 0 });
            const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

            // 1. Fetch Students and ignore status for mapping (filtering later)
            const allStudents = await studentService.getStudentsByTeacher(uid);
            const studentIds = allStudents.filter(s => s.status === 'enrolled').map(s => s.id);
            const studentsMap = {};
            allStudents.forEach(s => { studentsMap[s.id] = s; });

            // 2. Fetch ACTIVE Batches
            const activeBatches = await batchService.getBatches(uid, true);
            const activeBatchIds = activeBatches.map(b => b.id);
            const activeBatchMap = {};
            activeBatches.forEach(b => { activeBatchMap[b.id] = b; });

            // 3. Fetch Schedules for active batches
            const { data: schedulesData } = await supabase
                .from('schedules')
                .select('*')
                .eq('teacher_id', uid)
                .in('batch_id', activeBatchIds);
            
            const schedules = schedulesData || [];
            
            let classesToday = 0;
            const upcoming = schedules
                .filter((s) => {
                    if (!s.date || s.status === 'cancelled') return false;
                    const d = new Date(s.date);
                    if (isToday(d)) classesToday++;
                    return d >= now;
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5)
                .map(s => ({
                    ...s,
                    batchName: activeBatchMap[s.batch_id]?.name || 'Unknown Batch'
                }));

            // 4. Fetch Attendance and Log
            const { data: attendanceData } = await supabase
                .from('attendance_records')
                .select('*, attendance_log(*)')
                .eq('teacher_id', uid);
            
            let weekRecords = 0;
            let weekPresent = 0;
            const studentAttendance = {};
            const lastAttendDate = {};

            studentIds.forEach(id => {
                studentAttendance[id] = { studentId: id, total: 0, present: 0 };
            });

            (attendanceData || []).forEach((record) => {
                const recordDate = new Date(record.date);
                const isThisWeek = recordDate >= weekStart && recordDate <= weekEnd;
                
                if (record.attendance_log) {
                    record.attendance_log.forEach((log) => {
                        if (studentAttendance[log.student_id]) {
                            if (isThisWeek) {
                                weekRecords++;
                                if (log.status === 'present') weekPresent++;
                            }
                            studentAttendance[log.student_id].total++;
                            if (log.status === 'present') {
                                studentAttendance[log.student_id].present++;
                                if (!lastAttendDate[log.student_id] || recordDate > lastAttendDate[log.student_id]) {
                                    lastAttendDate[log.student_id] = recordDate;
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
            const { data: examsData } = await supabase
                .from('exams')
                .select('*')
                .eq('teacher_id', uid);
            
            let nextExamDays = null;
            const examsList = examsData || [];

            const upcomingExams = examsList
                .filter(e => {
                    const ed = new Date(e.date);
                    ed.setHours(0,0,0,0);
                    const t = new Date();
                    t.setHours(0,0,0,0);
                    return ed >= t;
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (upcomingExams.length > 0) {
                const earliestExamDate = new Date(upcomingExams[0].date);
                nextExamDays = differenceInDays(earliestExamDate, new Date());
                if (nextExamDays < 0) nextExamDays = 0;
            }

            // Past exams for risk analysis (marks drop)
            // Note: In Supabase schema, scores are likely in exam_results table
            const { data: resultsData } = await supabase
                .from('exam_results')
                .select('*, exams(date, total_marks)')
                .in('exam_id', examsList.map(e => e.id));

            const studentScores = {};
            (resultsData || []).forEach(res => {
                const examDate = new Date(res.exams.date);
                if (examDate < now) {
                    if (studentAttendance[res.student_id]) {
                        if (!studentScores[res.student_id]) studentScores[res.student_id] = [];
                        const perc = res.exams.total_marks > 0 ? (res.marks_obtained / res.exams.total_marks) * 100 : 0;
                        studentScores[res.student_id].push({ date: examDate, perc });
                    }
                }
            });

            Object.keys(studentScores).forEach(sid => {
                const history = studentScores[sid].sort((a, b) => a.date - b.date);
                if (history.length >= 2) {
                    const last = history[history.length - 1].perc;
                    const prev = history[history.length - 2].perc;
                    if (last < prev - 10) { 
                        addRisk(sid, `Scores dropped recently`, 'medium');
                    }
                }
            });

            const finalAtRiskList = Object.values(riskMap)
                .filter(risk => {
                    const student = studentsMap[risk.studentId];
                    if (!student) return false;
                    const studentBatchIds = student.batchIds || [];
                    return studentBatchIds.some(bid => activeBatchIds.includes(bid));
                })
                .sort((a,b) => b.score - a.score);

            setStats({
                classesToday,
                weekAttendance,
                nextExamDays: nextExamDays === null ? '—' : (nextExamDays === 0 ? 'Today' : `${nextExamDays} Days`),
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
            <div className="glass-panel" style={{ padding: 'clamp(20px, 5vw, 40px)', marginBottom: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, background: 'var(--color-accent)', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '6px 12px', background: 'var(--color-accent-soft)', color: 'var(--color-accent)', borderRadius: '20px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Crown size={12} /> Teacher Dashboard
                            </div>
                        </div>
                        <h1 style={{ fontSize: 'clamp(24px, 5vw, 40px)', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                            {greeting}, <span style={{ color: 'var(--color-accent)' }}>{userProfile?.displayName?.split(' ')[0] || 'Teacher'}</span>
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px', fontWeight: 500, maxWidth: '500px', lineHeight: 1.6 }}>
                            You have <span style={{ color: 'var(--color-text-primary)', fontWeight: 800 }}>{stats.classesToday} classes</span> scheduled for today.
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button 
                            className="btn btn-ghost" 
                            onClick={() => {
                                loadDashboardData();
                                toast.success('Data refreshed');
                            }}
                            style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8 }}
                        >
                            <Zap size={14} /> REFRESH
                        </button>
                        <Link to="/attendance" className="btn btn-primary" style={{ padding: '0 24px', height: '48px', borderRadius: '12px', fontWeight: 900, gap: '10px' }}>
                            <ClipboardCheck size={20} /> START CLASS
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="responsive-grid" style={{ marginBottom: 'var(--space-8)' }}>
                {[
                    { label: 'Classes Today', val: stats.classesToday, icon: <PlayCircle size={24} />, color: '#10b981', delay: '0s' },
                    { label: 'Attendance (Week)', val: `${stats.weekAttendance}%`, icon: <TrendingUp size={24} />, color: '#3b82f6', delay: '0.1s' },
                    { label: 'Next Exam', val: stats.nextExamDays, icon: <Clock size={24} />, color: '#f59e0b', delay: '0.2s' },
                    { label: 'Attention Needed', val: stats.attentionNeeded, icon: <AlertTriangle size={24} />, color: '#ef4444', delay: '0.3s', isUrgent: stats.attentionNeeded > 0 }
                ].map((m, i) => (
                    <div key={i} className="glass-card animate-fade-in-up" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', animationDelay: m.delay }}>
                        <div style={{ 
                            width: '54px', height: '54px', borderRadius: '16px', 
                            background: `${m.color}15`, color: m.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {m.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</div>
                            <div style={{ fontSize: '24px', fontWeight: 900 }}>{m.val}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="responsive-grid" style={{ gridTemplateColumns: atRiskList.length > 0 ? '1.6fr 1fr' : '1fr', alignItems: 'start' }}>
                
                {/* Intervention Monitor */}
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ 
                        padding: '20px 32px', 
                        background: 'var(--color-danger-soft)',
                        borderBottom: '1px solid var(--color-border-glass)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>Priority Students</h3>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Needs extra attention</p>
                            </div>
                        </div>
                        <div style={{ padding: '6px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '10px', fontSize: '11px', fontWeight: 900 }}>
                            {atRiskList.length} FLAGGED
                        </div>
                    </div>

                    <div style={{ padding: '32px' }}>
                        {atRiskList.length === 0 ? (
                            <div style={{ padding: '60px 0', textAlign: 'center' }}>
                                <div style={{ width: '100px', height: '100px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', marginBottom: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={48} />
                                </div>
                                <h4 style={{ fontSize: '22px', fontWeight: 900, color: '#10b981', marginBottom: '8px' }}>Everything looks good!</h4>
                                <p style={{ color: 'var(--color-text-muted)', maxWidth: '340px', margin: 'auto', fontWeight: 500 }}>No students are currently flagged for attention.</p>
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
                                            VIEW STUDENT <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Upcoming Classes */}
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming Classes</h3>
                            <Link to="/schedule" style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textDecoration: 'none' }}>FULL SCHEDULE</Link>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {upcomingClasses.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 500 }}>
                                    No classes scheduled yet.
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
                        <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px', color: 'var(--color-text-muted)' }}>Quick Links</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { to: '/attendance', icon: <ClipboardCheck size={20} />, label: 'Attendance', color: '#10b981' },
                                { to: '/students', icon: <Users size={20} />, label: 'Students', color: '#3b82f6' },
                                { to: '/homework', icon: <BookOpen size={20} />, label: 'Homework', color: '#8b5cf6' },
                                { to: '/analytics', icon: <Activity size={20} />, label: 'Stats', color: '#f59e0b' }
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
