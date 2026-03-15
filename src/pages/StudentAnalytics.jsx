import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, TrendingUp, TrendingDown, Calendar, AlertCircle, Filter, BookOpen, ClipboardCheck } from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';

export default function StudentAnalytics() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showExamTable, setShowExamTable] = useState(false);

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [studentSnap, batchSnap, attSnap, examSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    function isInDateRange(dateVal) {
        if (!dateFrom && !dateTo) return true;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (dateFrom && d < startOfDay(new Date(dateFrom))) return false;
        if (dateTo && d > endOfDay(new Date(dateTo))) return false;
        return true;
    }

    function toDate(val) {
        if (!val) return new Date(0);
        return val.toDate ? val.toDate() : new Date(val);
    }

    const filteredStudents = selectedBatchId
        ? students.filter(s => s.batchIds?.includes(selectedBatchId))
        : students;

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    // Compute detailed stats
    const stats = useMemo(() => {
        if (!selectedStudent) return null;

        let totalClasses = 0, presentClasses = 0, absentClasses = 0, lateClasses = 0;

        attendance.forEach((a) => {
            if (!selectedStudent.batchIds?.includes(a.batchId)) return;
            if (!isInDateRange(toDate(a.date))) return;
            const record = (a.records || []).find(r => r.studentId === selectedStudent.id);
            if (record) {
                totalClasses++;
                if (record.status === 'present') presentClasses++;
                else if (record.status === 'absent') absentClasses++;
                else if (record.status === 'late') lateClasses++;
            }
        });

        const studentAttRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        let totalExamMarks = 0, totalMarksEarned = 0, examsTaken = 0;

        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batchId)) return;
            if (!isInDateRange(toDate(e.date))) return;
            const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
            if (sScore) {
                examsTaken++;
                totalExamMarks += e.totalMarks;
                totalMarksEarned += sScore.marksObtained;
            }
        });

        const avgScore = totalExamMarks > 0 ? Math.round((totalMarksEarned / totalExamMarks) * 100) : 0;

        let totalHomeworks = 0, completedHomeworks = 0, lateHomeworks = 0, partialHomeworks = 0, notSubmittedHomeworks = 0;

        homeworks.forEach(hw => {
            if (!selectedStudent.batchIds?.includes(hw.batchId)) return;
            const hwDate = hw.dueDate ? toDate(hw.dueDate) : (hw.createdAt ? toDate(hw.createdAt) : null);
            if (hwDate && !isInDateRange(hwDate)) return;

            totalHomeworks++;
            // Check new submissions format first
            const sub = hw.submissions?.[selectedStudent.id];
            if (sub) {
                if (sub.status === 'completed') completedHomeworks++;
                else if (sub.status === 'late') lateHomeworks++;
                else if (sub.status === 'partial') partialHomeworks++;
                else notSubmittedHomeworks++;
            } else if ((hw.completedBy || []).includes(selectedStudent.id)) {
                completedHomeworks++;
            } else {
                notSubmittedHomeworks++;
            }
        });

        const hwCompletionRate = totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0;

        return {
            studentAttRate, totalClasses, presentClasses, absentClasses, lateClasses,
            avgScore, examsTaken,
            hwCompletionRate, totalHomeworks, completedHomeworks, lateHomeworks, partialHomeworks, notSubmittedHomeworks,
        };
    }, [selectedStudent, attendance, exams, homeworks, dateFrom, dateTo]);

    // Chart Data
    const attData = useMemo(() => {
        if (!selectedStudent) return [];
        const history = [];
        attendance
            .filter(a => selectedStudent.batchIds?.includes(a.batchId))
            .filter(a => isInDateRange(toDate(a.date)))
            .sort((a, b) => toDate(a.date) - toDate(b.date))
            .forEach(a => {
                const record = (a.records || []).find(r => r.studentId === selectedStudent.id);
                if (record) {
                    history.push({
                        date: format(toDate(a.date), 'MMM d'),
                        status: record.status === 'present' ? 100 : 0,
                    });
                }
            });
        return history.slice(-15);
    }, [selectedStudent, attendance, dateFrom, dateTo]);

    const examData = useMemo(() => {
        if (!selectedStudent) return [];
        const history = [];
        exams
            .filter(e => selectedStudent.batchIds?.includes(e.batchId))
            .filter(e => isInDateRange(toDate(e.date)))
            .sort((a, b) => toDate(a.date) - toDate(b.date))
            .forEach(e => {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (sScore) {
                    let batchSum = 0;
                    e.scores.forEach(s => batchSum += s.marksObtained);
                    const batchAvg = e.scores.length > 0 ? Math.round((batchSum / e.scores.length) / e.totalMarks * 100) : 0;
                    history.push({
                        name: e.title,
                        Student: Math.round((sScore.marksObtained / e.totalMarks) * 100),
                        BatchAvg: batchAvg
                    });
                }
            });
        return history.slice(-10);
    }, [selectedStudent, exams, dateFrom, dateTo]);

    const hwData = useMemo(() => {
        if (!selectedStudent) return [];
        return homeworks
            .filter(hw => selectedStudent.batchIds?.includes(hw.batchId))
            .filter(hw => {
                const d = hw.dueDate ? toDate(hw.dueDate) : (hw.createdAt ? toDate(hw.createdAt) : null);
                return d ? isInDateRange(d) : true;
            })
            .sort((a, b) => toDate(a.dueDate || a.createdAt) - toDate(b.dueDate || b.createdAt))
            .slice(-10)
            .map(hw => {
                const sub = hw.submissions?.[selectedStudent.id];
                const isCompleted = sub?.status === 'completed' || (!sub && (hw.completedBy || []).includes(selectedStudent.id));
                return {
                    name: hw.title.substring(0, 15) + (hw.title.length > 15 ? '...' : ''),
                    Status: isCompleted ? 1 : 0
                };
            });
    }, [selectedStudent, homeworks, dateFrom, dateTo]);

    // Per-Exam Score Table
    const examTableData = useMemo(() => {
        if (!selectedStudent) return [];
        return exams
            .filter(e => selectedStudent.batchIds?.includes(e.batchId))
            .filter(e => isInDateRange(toDate(e.date)))
            .sort((a, b) => toDate(b.date) - toDate(a.date))
            .map(e => {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (!sScore) return null;
                const topics = e.topicConfig || (e.topics || []).map(t => ({ name: t, maxMarks: null }));
                return {
                    title: e.title,
                    date: format(toDate(e.date), 'MMM d, yyyy'),
                    totalMarks: e.totalMarks,
                    marksObtained: sScore.marksObtained,
                    percentage: e.totalMarks > 0 ? Math.round((sScore.marksObtained / e.totalMarks) * 100) : 0,
                    topicMarks: sScore.topicMarks || {},
                    topics,
                };
            })
            .filter(Boolean);
    }, [selectedStudent, exams, dateFrom, dateTo]);

    const topicStats = useMemo(() => {
        if (!selectedStudent) return { strengths: [], weaknesses: [] };
        const topicsPerformance = {};
        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batchId)) return;
            if (!isInDateRange(toDate(e.date))) return;
            const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
            if (sScore && sScore.topicMarks) {
                const batchTopicSums = {};
                const batchTopicCounts = {};
                e.scores.forEach(score => {
                    if (score.topicMarks) {
                        Object.entries(score.topicMarks).forEach(([topic, mark]) => {
                            const val = parseFloat(mark) || 0;
                            batchTopicSums[topic] = (batchTopicSums[topic] || 0) + val;
                            batchTopicCounts[topic] = (batchTopicCounts[topic] || 0) + 1;
                        });
                    }
                });
                Object.entries(sScore.topicMarks).forEach(([topic, mark]) => {
                    const studentVal = parseFloat(mark) || 0;
                    const batchAvg = batchTopicSums[topic] / (batchTopicCounts[topic] || 1);
                    const diff = studentVal - batchAvg;
                    if (!topicsPerformance[topic]) topicsPerformance[topic] = { count: 0, diffSum: 0 };
                    topicsPerformance[topic].diffSum += diff;
                    topicsPerformance[topic].count += 1;
                });
            }
        });
        const analyzed = Object.entries(topicsPerformance).map(([topic, data]) => ({
            topic, avgDiff: data.diffSum / data.count,
        }));
        analyzed.sort((a, b) => b.avgDiff - a.avgDiff);
        return {
            strengths: analyzed.filter(t => t.avgDiff >= 0).slice(0, 3).map(t => t.topic),
            weaknesses: [...analyzed].reverse().filter(t => t.avgDiff < 0).slice(0, 3).map(t => t.topic)
        };
    }, [selectedStudent, exams, dateFrom, dateTo]);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Student Analytics</h1>
                    <p className="page-subtitle">Detailed performance insights per student</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter by Batch</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                            <option value="">-- All Batches --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> From Date
                        </label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> To Date
                        </label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>
                {(dateFrom || dateTo) && (
                    <div style={{ padding: '0 var(--space-4) var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                            Clear Date Filter
                        </button>
                    </div>
                )}
            </div>

            {selectedStudent && stats ? (
                <>
                    {/* Detailed Attendance Breakdown */}
                    <div className="dashboard-stats" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="stat-card">
                            <div className="stat-card-icon teal"><Calendar size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.studentAttRate}%</div>
                                <div className="stat-card-label">Attendance Rate</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon blue"><TrendingUp size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.avgScore}%</div>
                                <div className="stat-card-label">Average Score</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon gold"><AlertCircle size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.examsTaken}</div>
                                <div className="stat-card-label">Exams Taken</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-icon" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <div className="stat-card-value">{stats.hwCompletionRate}%</div>
                                <div className="stat-card-label">Homework Done</div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Breakdowns - Attendance & Homework */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        {/* Attendance Breakdown Card */}
                        <div className="card" style={{ padding: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ClipboardCheck size={18} style={{ color: 'var(--color-accent)' }} /> Attendance Details
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[
                                    { label: 'Total Classes', value: stats.totalClasses, color: 'var(--color-text-primary)' },
                                    { label: 'Attended', value: stats.presentClasses, color: 'var(--color-success)', perc: stats.totalClasses > 0 ? Math.round((stats.presentClasses / stats.totalClasses) * 100) : 0 },
                                    { label: 'Absent', value: stats.absentClasses, color: 'var(--color-danger)', perc: stats.totalClasses > 0 ? Math.round((stats.absentClasses / stats.totalClasses) * 100) : 0 },
                                    { label: 'Late', value: stats.lateClasses, color: 'var(--color-warning)', perc: stats.totalClasses > 0 ? Math.round((stats.lateClasses / stats.totalClasses) * 100) : 0 },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                                            <span>{item.label}</span>
                                            <span style={{ fontWeight: 700, color: item.color }}>
                                                {item.value}{item.perc !== undefined ? ` (${item.perc}%)` : ''}
                                            </span>
                                        </div>
                                        {item.perc !== undefined && (
                                            <div className="progress-bar" style={{ height: 6 }}>
                                                <div className="progress-bar-fill" style={{ width: `${item.perc}%`, background: item.color }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Homework Breakdown Card */}
                        <div className="card" style={{ padding: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <BookOpen size={18} style={{ color: 'var(--color-primary)' }} /> Homework Details
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {[
                                    { label: 'Total Assigned', value: stats.totalHomeworks, color: 'var(--color-text-primary)' },
                                    { label: 'Completed', value: stats.completedHomeworks, color: 'var(--color-success)', perc: stats.totalHomeworks > 0 ? Math.round((stats.completedHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Late', value: stats.lateHomeworks, color: 'var(--color-warning)', perc: stats.totalHomeworks > 0 ? Math.round((stats.lateHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Partial', value: stats.partialHomeworks, color: 'var(--color-primary)', perc: stats.totalHomeworks > 0 ? Math.round((stats.partialHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Not Submitted', value: stats.notSubmittedHomeworks, color: 'var(--color-danger)', perc: stats.totalHomeworks > 0 ? Math.round((stats.notSubmittedHomeworks / stats.totalHomeworks) * 100) : 0 },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>
                                            <span>{item.label}</span>
                                            <span style={{ fontWeight: 700, color: item.color }}>
                                                {item.value}{item.perc !== undefined ? ` (${item.perc}%)` : ''}
                                            </span>
                                        </div>
                                        {item.perc !== undefined && (
                                            <div className="progress-bar" style={{ height: 6 }}>
                                                <div className="progress-bar-fill" style={{ width: `${item.perc}%`, background: item.color }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Topic Strengths & Weaknesses */}
                    {(topicStats.strengths.length > 0 || topicStats.weaknesses.length > 0) && (
                        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-success)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <TrendingUp size={18} /> Top Strengths
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {topicStats.strengths.map(t => (
                                            <span key={t} className="badge" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)' }}>{t}</span>
                                        ))}
                                        {topicStats.strengths.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>Not enough data.</span>}
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-danger)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <TrendingDown size={18} /> Areas for Improvement
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {topicStats.weaknesses.map(t => (
                                            <span key={t} className="badge" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)' }}>{t}</span>
                                        ))}
                                        {topicStats.weaknesses.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No critical weaknesses detected.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Per-Exam Score Table */}
                    {examTableData.length > 0 && (
                        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>📊 Per-Exam Score Details</h3>
                                <button className="btn btn-ghost" onClick={() => setShowExamTable(!showExamTable)} style={{ fontSize: 'var(--font-size-sm)' }}>
                                    {showExamTable ? 'Hide' : 'Show'} Table
                                </button>
                            </div>
                            {showExamTable && (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--color-bg-elevated)' }}>
                                                <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--color-border)' }}>Exam</th>
                                                <th style={{ padding: 'var(--space-3)', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--color-border)' }}>Date</th>
                                                {examTableData[0]?.topics?.map(t => (
                                                    <th key={t.name} style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--color-border)' }}>
                                                        {t.name}{t.maxMarks != null ? <div style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-text-muted)' }}>/{t.maxMarks}</div> : ''}
                                                    </th>
                                                ))}
                                                <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--color-border)' }}>Total</th>
                                                <th style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--color-border)' }}>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {examTableData.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: 'var(--space-3)', fontWeight: 500 }}>{row.title}</td>
                                                    <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>{row.date}</td>
                                                    {row.topics.map(t => (
                                                        <td key={t.name} style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                                                            {row.topicMarks[t.name] !== undefined ? row.topicMarks[t.name] : '—'}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700 }}>
                                                        {row.marksObtained}/{row.totalMarks}
                                                    </td>
                                                    <td style={{ padding: 'var(--space-3)', textAlign: 'center', fontWeight: 700, color: row.percentage >= 70 ? 'var(--color-success)' : row.percentage >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                        {row.percentage}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="analytics-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
                        {/* Attendance Trend */}
                        <div className="chart-card card">
                            <div className="chart-card-header">
                                <div>
                                    <div className="chart-card-title">Recent Attendance</div>
                                    <div className="chart-card-subtitle">Last 15 classes (100 = Present, 0 = Absent)</div>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={attData}>
                                    <defs>
                                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} ticks={[0, 100]} />
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                                    <Area type="step" dataKey="status" stroke="#14b8a6" fill="url(#colorAtt)" strokeWidth={2} activeDot={{ r: 6 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Exam History */}
                        <div className="chart-card">
                            <div className="chart-card-header">
                                <div>
                                    <div className="chart-card-title">Exam Performance</div>
                                    <div className="chart-card-subtitle">Student scores vs Batch average</div>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={examData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3654" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3654', borderRadius: 8, color: '#f1f5f9' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Bar dataKey="Student" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="BatchAvg" fill="#64748b" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Homework Status */}
                        <div className="chart-card card">
                            <div className="chart-card-header" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                <div>
                                    <div className="chart-card-title">Recent Homework</div>
                                    <div className="chart-card-subtitle">Last 10 assignments (1 = Done, 0 = Pending)</div>
                                </div>
                            </div>
                            <div style={{ padding: 'var(--space-4)' }}>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={hwData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tick={{ fill: 'var(--color-text-muted)' }} />
                                        <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 1]} ticks={[0, 1]} tick={{ fill: 'var(--color-text-muted)' }} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text-primary)' }}
                                            formatter={(value) => [value === 1 ? 'Completed' : 'Pending', 'Status']}
                                        />
                                        <Bar dataKey="Status" radius={[4, 4, 0, 0]}>
                                            {hwData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.Status === 1 ? 'var(--color-success)' : 'var(--color-danger)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="empty-state card">
                    <User size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }} />
                    <div className="empty-state-title">No Student Selected</div>
                    <div className="empty-state-text">Select a student from the dropdown above to view their analytics.</div>
                </div>
            )}
        </div>
    );
}
