import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    Users, Calendar, TrendingUp, ClipboardCheck, BookOpen, 
    ArrowRight, Clock, AlertTriangle, PlayCircle, 
    Crown, Activity, Zap, ChevronRight, ShieldAlert, Sparkles, MapPin
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

            const allStudents = await studentService.getStudentsByTeacher(uid);
            const studentIds = (allStudents || []).map(s => s.id);
            const studentsMap = {};
            allStudents.forEach(s => { studentsMap[s.id] = s; });

            const activeBatches = await batchService.getBatches(uid);
            const activeBatchIds = activeBatches.map(b => b.id);
            const activeBatchMap = {};
            activeBatches.forEach(b => { activeBatchMap[b.id] = b; });

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

            const { data: attendanceData } = await supabase
                .from('attendance_records')
                .select('*, attendance_log(*)')
                .eq('teacher_id', uid);
            
            let weekRecords = 0;
            let weekPresent = 0;
            const studentAttendance = {};

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
                            if (log.status === 'present') studentAttendance[log.student_id].present++;
                        }
                    });
                }
            });

            const weekAttRate = weekRecords > 0 ? Math.round((weekPresent / weekRecords) * 100) : 0;
            const lowAttStudents = Object.values(studentAttendance)
                .filter(s => s.total >= 3 && (s.present / s.total) < 0.7)
                .map(s => studentsMap[s.studentId]);

            const { data: examsData } = await supabase
                .from('exams')
                .select('*')
                .eq('teacher_id', uid)
                .gte('date', format(now, 'yyyy-MM-dd'))
                .order('date', { ascending: true })
                .limit(1);
            
            let nextExamDays = null;
            if (examsData?.[0]) {
                nextExamDays = differenceInDays(new Date(examsData[0].date), now);
            }

            setStats({
                classesToday,
                weekAttendance: weekAttRate,
                nextExamDays,
                attentionNeeded: lowAttStudents.length
            });
            setUpcomingClasses(upcoming);
            setAtRiskList(lowAttStudents.slice(0, 3));
        } catch (err) {
            console.error('Dashboard load error:', err);
            toast.error('Failed to sync dashboard');
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    const statsCards = [
        { label: 'Classes Today', value: stats.classesToday, icon: Clock, color: 'var(--color-primary)', bg: 'rgba(59, 130, 246, 0.1)' },
        { label: 'Week Attendance', value: `${stats.weekAttendance}%`, icon: Users, color: 'var(--color-accent)', bg: 'rgba(20, 184, 166, 0.1)' },
        { label: 'Next Exam', value: stats.nextExamDays === null ? 'None' : (stats.nextExamDays === 0 ? 'Today' : `In ${stats.nextExamDays} Days`), icon: Calendar, color: 'var(--color-gold)', bg: 'rgba(245, 158, 11, 0.1)' },
        { label: 'Attention Needed', value: stats.attentionNeeded, icon: AlertTriangle, color: 'var(--color-danger)', bg: 'rgba(239, 68, 68, 0.1)' },
    ];

    return (
        <div className="animate-fade-in">
            {/* Announcement / Welcome Card */}
            <div className="glass-panel" style={{ 
                padding: '40px', 
                marginBottom: 'var(--space-8)', 
                background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 27, 75, 0.4) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'rgba(20, 184, 166, 0.15)', borderRadius: '50%', filter: 'blur(80px)' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Crown size={16} style={{ color: 'var(--color-gold)' }} />
                        <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)' }}>Platform Overview</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em', color: 'white' }}>
                        Welcome Back, Coach <span style={{ color: 'var(--color-accent)' }}>{userProfile?.displayName?.split(' ')[0]}</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 500, maxWidth: '600px', lineHeight: 1.6 }}>
                        You have <span style={{ color: 'white', fontWeight: 800 }}>{stats.classesToday} classes</span> scheduled for today. Your students' performance is trending <span style={{ color: '#10b981', fontWeight: 800 }}>Up (+4%)</span> this week.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: 'var(--space-8)' }}>
                {statsCards.map((card, idx) => (
                    <div key={idx} className="glass-card hover-lift" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '14px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${card.color}20` }}>
                                <card.icon size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{card.label}</div>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{card.value}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                {/* Upcoming Classes */}
                <div className="glass-panel" style={{ padding: '30px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Zap size={20} style={{ color: 'var(--color-accent)' }} /> Upcoming Sessions
                        </h2>
                        <Link to="/schedule" style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Full Calendar <ChevronRight size={14} />
                        </Link>
                    </div>
                    
                    {upcomingClasses.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '20px' }}>
                            <BookOpen size={40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                            <p style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>No upcoming classes found today.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {upcomingClasses.map((s) => (
                                <div key={s.id} className="hover-lift" style={{ 
                                    background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: '16px', 
                                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ textAlign: 'center', minWidth: '44px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{format(new Date(s.date), 'dd')}</div>
                                            <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-accent)' }}>{format(new Date(s.date), 'MMM')}</div>
                                        </div>
                                        <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                        <div>
                                            <div style={{ fontSize: '15px', fontWeight: 800 }}>{s.batchName}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</div>
                                        </div>
                                    </div>
                                    <Link to={`/attendance`} className="btn btn-ghost btn-sm" style={{ padding: '0 12px', height: '32px', fontSize: '10px' }}>LOG SESSION</Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Attention Needed Sidebox */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="glass-panel" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', fontWeight: 900, fontSize: '13px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <ShieldAlert size={20} /> Monitoring Radar
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px' }}>{stats.attentionNeeded} Attention Required</h3>
                        
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {atRiskList.map(student => (
                                <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '12px' }}>
                                        {student.name.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 800 }}>{student.name}</div>
                                        <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>Low Attendance Radar</div>
                                    </div>
                                    <Link to="/students" style={{ color: 'var(--color-text-muted)' }}><ChevronRight size={16} /></Link>
                                </div>
                            ))}
                            {atRiskList.length === 0 && (
                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>All students are currently on track. Excellent work!</p>
                            )}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '24px', background: 'var(--color-bg-glass)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                            <Sparkles size={16} style={{ color: 'var(--color-gold)', opacity: 0.4 }} />
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '8px' }}>Pro Tip</h4>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6, fontWeight: 500 }}>
                            Use the **Institutional Targeting** in Homework to give school-specific tasks like Board Questions or Mock Emails effortlessly.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
