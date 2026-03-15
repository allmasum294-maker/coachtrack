import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';
import {
    BarChart3, TrendingUp, Users, BookOpen, Calendar, ClipboardCheck,
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { format, subDays, differenceInHours } from 'date-fns';

const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#a78bfa', '#22c55e'];

export default function Analytics() {
    const { currentUser } = useAuth();
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

    useEffect(() => {
        if (selectedBatch) {
            const b = batches.find(x => x.id === selectedBatch);
            setTargetClasses(b?.targetClasses || '');
        } else {
            setTargetClasses('');
        }
    }, [selectedBatch, batches]);

    useEffect(() => {
        if (currentUser) loadAllData();
    }, [currentUser]);

    async function loadAllData() {
        try {
            const uid = currentUser.uid;
            const [batchSnap, studentSnap, attSnap, lessonSnap, examSnap, schedSnap] = await Promise.all([
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'lessons'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'schedules'), where('teacherId', '==', uid))),
            ]);
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLessons(lessonSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveTarget() {
        if (!selectedBatch) return;
        try {
            const val = parseInt(targetClasses, 10) || 0;
            await updateDoc(doc(db, 'batches', selectedBatch), { targetClasses: val });
            setBatches(batches.map(b => b.id === selectedBatch ? { ...b, targetClasses: val } : b));
            toast.success('Target classes updated');
        } catch (err) {
            console.error(err);
            toast.error('Failed to update target');
        }
    }

    function getFilteredSchedules() {
        return schedules.filter(s => {
            if (selectedBatch && s.batchId !== selectedBatch) return false;
            const dateVal = s.date?.toDate ? s.date.toDate() : new Date(s.date);
            const dateStr = format(dateVal, 'yyyy-MM-dd');
            return dateStr >= startDate && dateStr <= endDate;
        });
    }

    function getTargetFulfillmentData() {
        const filtered = getFilteredSchedules();
        const fulfilled = filtered.filter(s => s.status === 'completed').length;
        const cancelled = filtered.filter(s => s.status === 'cancelled').length;
        const scheduled = filtered.filter(s => s.status === 'scheduled').length;
        
        let target = 0;
        if (selectedBatch) {
            target = batches.find(b => b.id === selectedBatch)?.targetClasses || 0;
        } else {
            target = batches.reduce((sum, b) => sum + (b.targetClasses || 0), 0);
        }

        return { fulfilled, cancelled, scheduled, target };
    }

    // --- Computed Data ---
    function getAttendanceTrend() {
        const filtered = selectedBatch ? attendance.filter((a) => a.batchId === selectedBatch) : attendance;
        const byDate = {};
        filtered.forEach((a) => {
            const dateVal = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const key = format(dateVal, 'MMM d');
            if (!byDate[key]) byDate[key] = { present: 0, total: 0 };
            (a.records || []).forEach((r) => {
                byDate[key].total++;
                if (r.status === 'present') byDate[key].present++;
            });
        });
        return Object.entries(byDate).map(([date, v]) => ({
            date, rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        })).slice(-15);
    }

    function getBatchAttendanceComparison() {
        return batches.map((batch) => {
            const batchAtt = attendance.filter((a) => a.batchId === batch.id);
            let total = 0, present = 0;
            batchAtt.forEach((a) => {
                (a.records || []).forEach((r) => { total++; if (r.status === 'present') present++; });
            });
            return { name: batch.name, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
        });
    }

    function getSyllabusCoverage() {
        return batches.map((batch) => {
            const batchLessons = lessons.filter((l) => l.batchId === batch.id);
            const covered = batchLessons.filter((l) => l.status === 'covered').length;
            const total = batchLessons.length;
            return { name: batch.name, covered, total, percent: total > 0 ? Math.round((covered / total) * 100) : 0 };
        });
    }

    function getExamPerformanceTrend() {
        const filtered = selectedBatch ? exams.filter((e) => e.batchId === selectedBatch) : exams;
        return filtered
            .filter((e) => (e.scores || []).length > 0)
            .sort((a, b) => {
                const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return da - db2;
            })
            .map((exam) => {
                const marks = exam.scores.map((s) => s.marksObtained);
                const avg = Math.round(marks.reduce((a, b) => a + b, 0) / marks.length);
                const percent = exam.totalMarks > 0 ? Math.round((avg / exam.totalMarks) * 100) : 0;
                return { name: exam.title, avg: percent };
            });
    }

    function getBatchRadarData() {
        return batches.map((batch) => {
            const batchAtt = attendance.filter((a) => a.batchId === batch.id);
            let totalR = 0, presentR = 0;
            batchAtt.forEach((a) => (a.records || []).forEach((r) => { totalR++; if (r.status === 'present') presentR++; }));
            const attRate = totalR > 0 ? Math.round((presentR / totalR) * 100) : 0;

            const batchLessons = lessons.filter((l) => l.batchId === batch.id);
            const coveredL = batchLessons.filter((l) => l.status === 'covered').length;
            const sylRate = batchLessons.length > 0 ? Math.round((coveredL / batchLessons.length) * 100) : 0;

            const batchExams = exams.filter((e) => e.batchId === batch.id && (e.scores || []).length > 0);
            let examPerf = 0;
            if (batchExams.length > 0) {
                const avgs = batchExams.map((e) => {
                    const marks = e.scores.map((s) => s.marksObtained);
                    return e.totalMarks > 0 ? (marks.reduce((a, b) => a + b, 0) / marks.length / e.totalMarks) * 100 : 0;
                });
                examPerf = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
            }

            const studentCount = students.filter((s) => (s.batchIds || []).includes(batch.id)).length;

            return { subject: batch.name, Attendance: attRate, Syllabus: sylRate, Performance: examPerf };
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
            byWeek[weekKey] += (eh * 60 + em - sh * 60 - sm) / 60;
        });
        return Object.entries(byWeek).map(([week, hours]) => ({ week, hours: Math.round(hours * 10) / 10 }));
    }

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Analytics</h1>
                    <p className="page-subtitle">Deep insights into your coaching performance</p>
                </div>
            </div>

            <div className="analytics-filters" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-select" style={{ width: 200 }} value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input type="date" className="form-input" style={{ width: 150 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <span style={{ color: 'var(--color-text-muted)' }}>to</span>
                    <input type="date" className="form-input" style={{ width: 150 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                {selectedBatch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto', background: 'var(--color-surface-2)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>Target:</span>
                        <input type="number" className="form-input" style={{ width: 80, padding: '4px 8px' }} placeholder="Classes" value={targetClasses} onChange={e => setTargetClasses(e.target.value)} />
                        <button className="btn btn-primary btn-sm" onClick={handleSaveTarget}>Save</button>
                    </div>
                )}
            </div>

            <div className="analytics-charts">
                {/* Target Fulfillment (Newly Added) */}
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Target Fulfillment & Class Status</div>
                            <div className="chart-card-subtitle">Completed vs Cancelled classes within {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d')}</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', padding: 'var(--space-4)' }}>
                        {(() => {
                            const { fulfilled, cancelled, scheduled, target } = getTargetFulfillmentData();
                            const totalFiltered = fulfilled + cancelled + scheduled;
                            const progress = target > 0 ? Math.min(Math.round((fulfilled / target) * 100), 100) : 0;
                            
                            return (
                                <>
                                    <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-accent)' }}>{fulfilled}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Fulfilled Classes</div>
                                        {target > 0 && (
                                            <div style={{ marginTop: 'var(--space-4)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                                                    <span style={{ color: 'var(--color-text-muted)' }}>Progress to Target ({target})</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{progress}%</span>
                                                </div>
                                                <div className="progress-bar" style={{ height: 8 }}>
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }} />
                                                </div>
                                            </div>
                                        )}
                                        {target === 0 && selectedBatch && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', marginTop: 'var(--space-2)' }}>Set a target to track progress</div>
                                        )}
                                    </div>
                                    <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-danger)' }}>{cancelled}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Cancelled Classes</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                                            {totalFiltered > 0 ? Math.round((cancelled / totalFiltered) * 100) : 0}% of scheduled
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--color-teal)' }}>{scheduled}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Upcoming / Scheduled</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                                            Pending completion
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '150px' }}>
                                        {totalFiltered > 0 ? (
                                            <ResponsiveContainer width="100%" height={150}>
                                                <PieChart>
                                                    <Pie data={[
                                                        { name: 'Fulfilled', value: fulfilled, color: 'var(--color-accent)' },
                                                        { name: 'Cancelled', value: cancelled, color: 'var(--color-danger)' },
                                                        { name: 'Scheduled', value: scheduled, color: 'var(--color-teal)' }
                                                    ].filter(x => x.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                                                        {
                                                            [
                                                                { name: 'Fulfilled', value: fulfilled, color: 'var(--color-accent)' },
                                                                { name: 'Cancelled', value: cancelled, color: 'var(--color-danger)' },
                                                                { name: 'Scheduled', value: scheduled, color: 'var(--color-teal)' }
                                                            ].filter(x => x.value > 0).map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))
                                                        }
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div style={{ color: 'var(--color-text-muted)' }}>No data in selected range</div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
                {/* Attendance Trend */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Attendance Trend</div>
                            <div className="chart-card-subtitle">Attendance rate over time</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={getAttendanceTrend()}>
                            <defs>
                                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                            <Area type="monotone" dataKey="rate" stroke="#14b8a6" fill="url(#attGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Batch Attendance Comparison */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Batch Comparison</div>
                            <div className="chart-card-subtitle">Attendance rate by batch</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={getBatchAttendanceComparison()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                            <Bar dataKey="rate" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Exam Performance Trend */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Performance Trend</div>
                            <div className="chart-card-subtitle">Average exam scores over time (%)</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={getExamPerformanceTrend()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                            <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Syllabus Coverage */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Syllabus Coverage</div>
                            <div className="chart-card-subtitle">Curriculum completion per batch</div>
                        </div>
                    </div>
                    <div style={{ padding: 'var(--space-2)' }}>
                        {getSyllabusCoverage().map((item, i) => (
                            <div key={i} style={{ marginBottom: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{item.name}</span>
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}>{item.percent}% ({item.covered}/{item.total})</span>
                                </div>
                                <div className="progress-bar" style={{ height: 12 }}>
                                    <div className="progress-bar-fill" style={{ width: `${item.percent}%` }} />
                                </div>
                            </div>
                        ))}
                        {getSyllabusCoverage().length === 0 && (
                            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>No lesson data available</p>
                        )}
                    </div>
                </div>

                {/* Batch Radar */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Batch Overview</div>
                            <div className="chart-card-subtitle">Overall metrics comparison</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={getBatchRadarData()}>
                            <PolarGrid stroke="#2a3654" />
                            <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={12} />
                            <PolarRadiusAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
                            <Radar name="Attendance" dataKey="Attendance" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} />
                            <Radar name="Syllabus" dataKey="Syllabus" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                            <Radar name="Performance" dataKey="Performance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                            <Legend />
                            <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Teaching Hours */}
                <div className="chart-card">
                    <div className="chart-card-header">
                        <div>
                            <div className="chart-card-title">Teaching Hours</div>
                            <div className="chart-card-subtitle">Weekly teaching productivity</div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={getTeachingHours()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                            <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                            <Bar dataKey="hours" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
