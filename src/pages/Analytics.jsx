import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';
import { examService } from '../services/examService';
import toast from 'react-hot-toast';
import {
    BarChart3, TrendingUp, Users, BookOpen, Calendar, 
    ClipboardCheck, Filter, Target, Award, Brain, Clock, Zap
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { format, subDays } from 'date-fns';

const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#a78bfa', '#22c55e'];

export default function Analytics() {
    const { userProfile } = useAuth();
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [exams, setExams] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [targetClasses, setTargetClasses] = useState('');

    const enrolledStudentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);

    useEffect(() => {
        if (selectedBatch) {
            const b = batches.find(x => x.id === selectedBatch);
            setTargetClasses(b?.target_classes || '');
        } else {
            setTargetClasses('');
        }
    }, [selectedBatch, batches]);

    useEffect(() => {
        if (userProfile?.id) loadAllData();
    }, [userProfile]);

    async function loadAllData() {
        try {
            const uid = userProfile.id;
            const [activeBatches, allStudents, allAttendance, lessonRes, allExams, schedRes] = await Promise.all([
                batchService.getBatches(uid, false),
                studentService.getStudentsByTeacher(uid),
                attendanceService.getAttendanceByTeacher(uid),
                supabase.from('lessons').select('*').eq('teacher_id', uid),
                examService.getExams(uid),
                supabase.from('schedules').select('*').eq('teacher_id', uid),
            ]);
            setBatches(activeBatches);
            setStudents(allStudents.filter(s => s.status === 'enrolled'));
            setAttendance(allAttendance);
            setLessons(lessonRes.data || []);
            setExams(allExams);
            setSchedules(schedRes.data || []);
        } catch (err) {
            console.error('Error loading analytics data:', err);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveTarget() {
        if (!selectedBatch) return;
        try {
            const val = parseInt(targetClasses, 10) || 0;
            const { error } = await supabase
                .from('batches')
                .update({ target_classes: val })
                .eq('id', selectedBatch);
            if (error) throw error;
            setBatches(batches.map(b => b.id === selectedBatch ? { ...b, target_classes: val } : b));
            toast.success('Batch goals updated');
        } catch (err) {
            console.error(err);
            toast.error('Failed to update target');
        }
    }

    function getFilteredSchedules() {
        return schedules.filter(s => {
            if (selectedBatch && s.batch_id !== selectedBatch) return false;
            return s.date >= startDate && s.date <= endDate;
        });
    }

    // --- Computed Analytics ---
    const stats = useMemo(() => {
        // Attendance Rate
        const filteredAtt = selectedBatch ? attendance.filter(a => a.batch_id === selectedBatch) : attendance;
        let totalRecords = 0, presentCount = 0;
        filteredAtt.forEach(a => {
            (a.records || []).forEach(r => {
                if (enrolledStudentIds.has(r.studentId)) {
                    totalRecords++;
                    if (r.status === 'present') presentCount++;
                }
            });
        });
        const attRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

        // Syllabus Progress
        const filteredLessons = selectedBatch ? lessons.filter(l => l.batch_id === selectedBatch) : lessons;
        const covered = filteredLessons.filter(l => l.status === 'covered').length;
        const totalL = filteredLessons.length;
        const sylProgress = totalL > 0 ? Math.round((covered / totalL) * 100) : 0;

        // Exam Average
        const filteredExams = selectedBatch ? exams.filter(e => e.batch_id === selectedBatch) : exams;
        let totalPct = 0, examCount = 0;
        filteredExams.forEach(e => {
            const scores = (e.scores || []).filter(s => enrolledStudentIds.has(s.studentId));
            if (scores.length > 0 && e.totalMarks > 0) {
                const avg = scores.reduce((sum, s) => sum + s.marksObtained, 0) / scores.length;
                totalPct += (avg / e.totalMarks) * 100;
                examCount++;
            }
        });
        const avgPerf = examCount > 0 ? Math.round(totalPct / examCount) : 0;

        return { attRate, sylProgress, avgPerf, studentCount: students.length };
    }, [attendance, lessons, exams, students, selectedBatch, enrolledStudentIds]);

    function getAttendanceTrend() {
        const filtered = selectedBatch ? attendance.filter((a) => a.batch_id === selectedBatch) : attendance;
        const byDate = {};
        filtered.forEach((a) => {
            const key = format(new Date(a.date), 'MMM d');
            if (!byDate[key]) byDate[key] = { present: 0, total: 0 };
            (a.records || []).forEach((r) => {
                if (enrolledStudentIds.has(r.studentId)) {
                    byDate[key].total++;
                    if (r.status === 'present') byDate[key].present++;
                }
            });
        });
        return Object.entries(byDate).map(([date, v]) => ({
            date, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        })).slice(-15);
    }

    function getBatchAttendanceComparison() {
        return batches.map((batch) => {
            const batchAtt = attendance.filter((a) => a.batch_id === batch.id);
            let total = 0, present = 0;
            batchAtt.forEach((a) => {
                (a.records || []).forEach((r) => { 
                    if (enrolledStudentIds.has(r.studentId)) {
                        total++; 
                        if (r.status === 'present') present++; 
                    }
                });
            });
            return { name: batch.name, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
        });
    }

    function getSyllabusCoverage() {
        return batches.map((batch) => {
            const batchLessons = lessons.filter((l) => l.batch_id === batch.id);
            const covered = batchLessons.filter((l) => l.status === 'covered').length;
            const total = batchLessons.length;
            return { name: batch.name, covered, total, percent: total > 0 ? Math.round((covered / total) * 100) : 0 };
        });
    }

    function getExamPerformanceTrend() {
        const filtered = selectedBatch ? exams.filter((e) => e.batch_id === selectedBatch) : exams;
        return filtered
            .filter((e) => (e.scores || []).some(s => enrolledStudentIds.has(s.studentId)))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((exam) => {
                const scores = exam.scores.filter(s => enrolledStudentIds.has(s.studentId));
                const marks = scores.map((s) => s.marksObtained);
                const avg = marks.reduce((acc, m) => acc + m, 0) / marks.length;
                const percent = exam.totalMarks > 0 ? Math.round((avg / exam.totalMarks) * 100) : 0;
                return { name: exam.title, avg: percent };
            });
    }

    function getBatchRadarData() {
        return batches.map((batch) => {
            const batchAtt = attendance.filter((a) => a.batchId === batch.id);
            let totalR = 0, presentR = 0;
            batchAtt.forEach((a) => (a.records || []).forEach((r) => { 
                if (enrolledStudentIds.has(r.studentId)) {
                    totalR++; 
                    if (r.status === 'present') presentR++; 
                }
            }));
            const attRate = totalR > 0 ? Math.round((presentR / totalR) * 100) : 0;

            const batchLessons = lessons.filter((l) => l.batchId === batch.id);
            const coveredL = batchLessons.filter(l => l.status === 'covered').length;
            const sylRate = batchLessons.length > 0 ? Math.round((coveredL / batchLessons.length) * 100) : 0;

            const batchExams = exams.filter((e) => e.batchId === batch.id);
            let examPerf = 0;
            let totalPct = 0, examCount = 0;
            batchExams.forEach(e => {
                const scores = (e.scores || []).filter(s => enrolledStudentIds.has(s.studentId));
                if (scores.length > 0 && e.totalMarks > 0) {
                    const avg = scores.reduce((sum, s) => sum + s.marksObtained, 0) / scores.length;
                    totalPct += (avg / e.totalMarks) * 100;
                    examCount++;
                }
            });
            examPerf = examCount > 0 ? Math.round(totalPct / examCount) : 0;

            return { subject: batch.name, Attendance: attRate, Topics: sylRate, Performance: examPerf };
        });
    }

    function getTeachingHours() {
        const completed = schedules.filter((s) => s.status === 'completed' || s.status === 'scheduled');
        const byWeek = {};
        completed.forEach((s) => {
            if (!s.startTime || !s.endTime) return;
            const dateVal = s.date?.toDate ? s.date.toDate() : new Date(s.date);
            const weekKey = format(dateVal, "'Week' w");
            if (!byWeek[weekKey]) byWeek[weekKey] = 0;
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            byWeek[weekKey] += ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        });
        return Object.entries(byWeek).map(([week, hours]) => ({ week, hours: Math.round(hours * 10) / 10 }));
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    const targetData = (() => {
        const filtered = getFilteredSchedules();
        const done = filtered.filter(s => s.status === 'completed').length;
        const cancelled = filtered.filter(s => s.status === 'cancelled').length;
        const scheduled = filtered.filter(s => s.status === 'scheduled').length;
        let target = selectedBatch ? (batches.find(b => b.id === selectedBatch)?.targetClasses || 0) : batches.reduce((sum, b) => sum + (b.targetClasses || 0), 0);
        return { done, cancelled, scheduled, target };
    })();

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Class Progress</h1>
                    <p className="page-subtitle">See how your classes and students are doing</p>
                </div>
            </div>

            {/* Quick Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {[
                    { label: 'Total Students', value: stats.studentCount, icon: Users, color: 'var(--color-primary)' },
                    { label: 'Average Attendance', value: `${stats.attRate}%`, icon: ClipboardCheck, color: 'var(--color-teal)' },
                    { label: 'Topics Finished', value: `${stats.sylProgress}%`, icon: BookOpen, color: 'var(--color-warning)' },
                    { label: 'Average Exam Score', value: `${stats.avgPerf}%`, icon: Award, color: 'var(--color-primary)' },
                ].map((stat, i) => (
                    <div key={i} className="glass-panel" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div style={{ 
                            width: '48px', height: '48px', borderRadius: '14px', 
                            background: `${stat.color}15`, color: stat.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                            <div style={{ fontSize: '24px', fontWeight: 800 }}>{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Control Panel */}
            <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: '240px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}><Filter size={12} style={{ marginRight: '4px' }} /> Select Batch</label>
                        <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                            <option value="">All Active Batches</option>
                            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                    </div>
                </div>

                <div style={{ flex: 3, display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}>Start Date</label>
                        <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}>End Date</label>
                        <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>

                {selectedBatch && (
                    <div className="form-group" style={{ flex: 2 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}>Monthly Class Goal</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="number" className="form-input" placeholder="Classes" value={targetClasses} onChange={e => setTargetClasses(e.target.value)} />
                            <button className="btn btn-primary" onClick={handleSaveTarget} style={{ height: '42px', padding: '0 20px' }}><Zap size={16} /> Set</button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--space-6)' }}>
                {/* Target Fulfillment Card */}
                <div className="glass-panel" style={{ gridColumn: 'span 12', padding: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
                        <div>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)' }}>Classes Taken</h3>
                            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>How many classes you've taken in this period</p>
                        </div>
                        <div className="glass-card" style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.05)', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 800 }}>
                            {targetData.done} Classes Done
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', alignItems: 'center' }}>
                        <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                            <Clock size={32} style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Done</div>
                            <div style={{ fontSize: '36px', fontWeight: 900 }}>{targetData.done}</div>
                        </div>
                        <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                            <Calendar size={32} style={{ color: 'var(--color-teal)', marginBottom: '12px' }} />
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Upcoming</div>
                            <div style={{ fontSize: '36px', fontWeight: 900 }}>{targetData.scheduled}</div>
                        </div>
                        <div className="glass-card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                            <Target size={32} style={{ color: 'var(--color-warning)', marginBottom: '12px' }} />
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Target Progress</div>
                            <div style={{ fontSize: '36px', fontWeight: 900 }}>{targetData.target > 0 ? Math.min(Math.round((targetData.done / targetData.target) * 100), 100) : 0}%</div>
                        </div>
                        
                        <div style={{ height: '180px', gridColumn: 'span 2' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={[
                                            { name: 'Done', value: targetData.done, color: 'var(--color-primary)' },
                                            { name: 'Cancelled', value: targetData.cancelled, color: 'var(--color-danger)' },
                                            { name: 'Upcoming', value: targetData.scheduled, color: 'var(--color-teal)' }
                                        ].filter(x => x.value > 0)} 
                                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" stroke="none" paddingAngle={8}
                                    >
                                        {
                                            [
                                                { name: 'Done', value: targetData.done, color: 'var(--color-primary)' },
                                                { name: 'Cancelled', value: targetData.cancelled, color: 'var(--color-danger)' },
                                                { name: 'Upcoming', value: targetData.scheduled, color: 'var(--color-teal)' }
                                            ].filter(x => x.value > 0).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))
                                        }
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Attendance Area Chart */}
                <div className="glass-panel" style={{ gridColumn: 'span 8', padding: 'var(--space-6)' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Attendance Trends</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Student attendance in recent classes</p>
                    </div>
                    <div style={{ height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getAttendanceTrend()}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                <Area type="monotone" dataKey="rate" stroke="var(--color-primary)" fill="url(#chartGrad)" strokeWidth={4} animationDuration={2000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Academic Radar */}
                <div className="glass-panel" style={{ gridColumn: 'span 4', padding: 'var(--space-6)' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Overall Progress</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>How the class is doing overall</p>
                    </div>
                    <div style={{ height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={getBatchRadarData()}>
                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                <PolarAngleAxis dataKey="subject" stroke="var(--color-text-muted)" fontSize={10} />
                                <PolarRadiusAxis domain={[0, 100]} stroke="rgba(255,255,255,0.1)" fontSize={9} />
                                <Radar name="Attendance" dataKey="Attendance" stroke="var(--color-teal)" fill="var(--color-teal)" fillOpacity={0.4} />
                                <Radar name="Topics" dataKey="Topics" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.4} />
                                <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Performance Line Chart */}
                <div className="glass-panel" style={{ gridColumn: 'span 6', padding: 'var(--space-6)' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Exam Marks</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>See how marks are changing over time</p>
                    </div>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getExamPerformanceTrend()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                <Line type="stepAfter" dataKey="avg" stroke="var(--color-warning)" strokeWidth={4} dot={{ fill: 'var(--color-warning)', r: 5, strokeWidth: 0 }} activeDot={{ r: 8 }} animationDuration={2000} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Syllabus Gauge List */}
                <div className="glass-panel" style={{ gridColumn: 'span 6', padding: 'var(--space-6)' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Lessons Finished</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>See how many lessons are done for each batch</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        {getSyllabusCoverage().map((item, i) => (
                            <div key={i} className="glass-card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 800 }}>{item.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.covered} / {item.total} Topics Finished</div>
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-primary)' }}>{item.percent}%</div>
                                </div>
                                <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        width: `${item.percent}%`, height: '100%', 
                                        background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, var(--color-primary))`,
                                        boxShadow: `0 0 15px ${COLORS[i % COLORS.length]}40`
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Effort Chart */}
                <div className="glass-panel" style={{ gridColumn: 'span 12', padding: 'var(--space-6)' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Class Hours</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total hours you've spent teaching each week</p>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getTeachingHours()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="week" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                <Bar dataKey="hours" fill="var(--color-primary)" radius={[8, 8, 0, 0]} animationDuration={2000} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
