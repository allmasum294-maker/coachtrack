import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';
import { examService } from '../services/examService';
import { homeworkService } from '../services/homeworkService';
import { User, TrendingUp, TrendingDown, Calendar, AlertCircle, Filter, BookOpen, ClipboardCheck, ChevronDown, ChevronUp } from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function StudentAnalytics() {
    const { userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}-01`;
    });
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [showExamTable, setShowExamTable] = useState(false);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    // Handle incoming student ID from URL
    useEffect(() => {
        if (students.length > 0) {
            const hashParts = window.location.hash.split('?');
            if (hashParts.length > 1) {
                const params = new URLSearchParams(hashParts[1]);
                const studentId = params.get('id');
                if (studentId) {
                    const student = students.find(s => s.id === studentId);
                    if (student) {
                        setSelectedStudentId(studentId);
                        if (student.batchIds?.length > 0) {
                            setSelectedBatchId(student.batchIds[0]);
                        }
                    }
                }
            }
        }
    }, [students]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            
            // Fetch batches first independently
            try {
                const activeBatches = await batchService.getBatches(uid);
                setBatches(activeBatches);
            } catch (batchErr) {
                console.error('Error loading batches:', batchErr);
            }

            const [allStudentsRes, allAttendanceRes, allExamsRes, allHomeworksRes] = await Promise.allSettled([
                studentService.getStudentsByTeacher(uid),
                attendanceService.getAttendanceByTeacher(uid),
                examService.getExams(uid),
                homeworkService.getHomeworkByTeacher(uid),
            ]);

            if (allStudentsRes.status === 'fulfilled') {
                // Remove strict 'enrolled' filter to ensure all teacher students are visible
                setStudents(allStudentsRes.value || []);
            } else {
                console.error('Error loading students:', allStudentsRes.reason);
            }

            if (allAttendanceRes.status === 'fulfilled') setAttendance(allAttendanceRes.value || []);
            if (allExamsRes.status === 'fulfilled') setExams(allExamsRes.value || []);
            if (allHomeworksRes.status === 'fulfilled') setHomeworks(allHomeworksRes.value || []);

        } catch (err) {
            console.error('Global error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    const memoizedDateRange = useMemo(() => ({ from: dateFrom, to: dateTo }), [dateFrom, dateTo]);

    function safeToDate(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function isInDateRange(dateVal) {
        if (!memoizedDateRange.from && !memoizedDateRange.to) return true;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (memoizedDateRange.from && d < startOfDay(new Date(memoizedDateRange.from))) return false;
        if (memoizedDateRange.to && d > endOfDay(new Date(memoizedDateRange.to))) return false;
        return true;
    }

    const filteredStudents = useMemo(() => {
        return selectedBatchId
            ? students.filter(s => s.batchIds?.includes(selectedBatchId))
            : students;
    }, [selectedBatchId, students]);

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [filteredStudents, selectedStudentId]);

    const selectedStudent = useMemo(() => students.find((s) => s.id === selectedStudentId), [students, selectedStudentId]);

    // Compute detailed stats
    const stats = useMemo(() => {
        if (!selectedStudent) return null;

        let totalClasses = 0, presentClasses = 0, absentClasses = 0, lateClasses = 0;

        attendance.forEach((a) => {
            if (!selectedStudent.batchIds?.includes(a.batch_id)) return;
            const d = new Date(a.date);
            if (!d || !isInDateRange(d)) return;
            const record = (a.records || []).find(r => r.studentId === selectedStudent.id);
            if (record) {
                totalClasses++;
                if (record.status === 'present') presentClasses++;
                else if (record.status === 'late') {
                    lateClasses++;
                    presentClasses += 0.5; // 50% credit for being late
                }
                else if (record.status === 'absent') absentClasses++;
            }
        });

        const studentAttRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        let totalExamMarks = 0, totalMarksEarned = 0, examsTaken = 0;

        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batch_id)) return;
            const ed = new Date(e.date);
            if (!ed || !isInDateRange(ed)) return;
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
            if (!selectedStudent.batchIds?.includes(hw.batch_id)) return;
            const hwDate = new Date(hw.due_date || hw.created_at);
            if (hwDate && !isInDateRange(hwDate)) return;

            totalHomeworks++;
            // Note: Homework submissions in relational schema are handled differently, but service currently wraps them.
            const sub = (hw.submissions || {})[selectedStudent.id];
            if (sub) {
                if (sub.status === 'completed') completedHomeworks++;
                else if (sub.status === 'late') lateHomeworks++;
                else if (sub.status === 'partial') partialHomeworks++;
                else notSubmittedHomeworks++;
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
    }, [selectedStudent, attendance, exams, homeworks, memoizedDateRange]);

    // Chart Data
    const attData = useMemo(() => {
        if (!selectedStudent) return [];
        const history = [];
        attendance
            .filter(a => selectedStudent.batchIds?.includes(a.batch_id))
            .filter(a => {
                const d = new Date(a.date);
                return d && isInDateRange(d);
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .forEach(a => {
                const record = (a.records || []).find(r => r.studentId === selectedStudent.id);
                if (record) {
                    const d = new Date(a.date);
                    history.push({
                        date: format(d, 'MMM d'),
                        status: record.status === 'present' ? 100 : 0,
                    });
                }
            });
        return history.slice(-15);
    }, [selectedStudent, attendance, memoizedDateRange]);

    const examData = useMemo(() => {
        if (!selectedStudent) return [];
        const history = [];
        exams
            .filter(e => selectedStudent.batchIds?.includes(e.batch_id))
            .filter(e => {
                const d = new Date(e.date);
                return d && isInDateRange(d);
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
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
    }, [selectedStudent, exams, memoizedDateRange]);

    const hwData = useMemo(() => {
        if (!selectedStudent) return [];
        return homeworks
            .filter(hw => selectedStudent.batchIds?.includes(hw.batch_id))
            .filter(hw => {
                const d = new Date(hw.due_date || hw.created_at);
                return isInDateRange(d);
            })
            .sort((a, b) => new Date(a.due_date || a.created_at) - new Date(b.due_date || b.created_at))
            .slice(-10)
            .map(hw => {
                const sub = (hw.submissions || {})[selectedStudent.id];
                const isCompleted = sub?.status === 'completed' || sub?.status === 'late';
                return {
                    name: hw.title.length > 15 ? hw.title.substring(0, 15) + '...' : hw.title,
                    Status: isCompleted ? 1 : 0
                };
            });
    }, [selectedStudent, homeworks, memoizedDateRange]);

    // Per-Exam Score Table
    const examTableData = useMemo(() => {
        if (!selectedStudent) return [];
        return exams
            .filter(e => selectedStudent.batchIds?.includes(e.batch_id))
            .filter(e => {
                const d = new Date(e.date);
                return d && isInDateRange(d);
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(e => {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (!sScore) return null;
                const topics = e.topicConfig || (e.topics || []).map(t => ({ name: t, maxMarks: null }));
                return {
                    title: e.title,
                    date: format(new Date(e.date), 'MMM d, yyyy'),
                    totalMarks: e.totalMarks,
                    marksObtained: sScore.marksObtained,
                    percentage: e.totalMarks > 0 ? Math.round((sScore.marksObtained / e.totalMarks) * 100) : 0,
                    topicMarks: sScore.topicMarks || {},
                    topics,
                };
            })
            .filter(Boolean);
    }, [selectedStudent, exams, memoizedDateRange]);

    const topicStats = useMemo(() => {
        if (!selectedStudent) return { strengths: [], weaknesses: [] };
        const topicsPerformance = {};
        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batch_id)) return;
            const ed = safeToDate(e.date);
            if (!ed || !isInDateRange(ed)) return;
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
    }, [selectedStudent, exams, memoizedDateRange]);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Student Progress</h1>
                    <p className="page-subtitle">See exactly how each student is doing</p>
                </div>
            </div>

            <div className="glass-panel" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter by Batch</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                            <option value="">-- All Batches --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> From Date
                        </label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> To Date
                        </label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>
                {(dateFrom || dateTo) && (
                    <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            const day = String(now.getDate()).padStart(2, '0');
                            setDateFrom(`${year}-${month}-01`);
                            setDateTo(`${year}-${month}-${day}`);
                        }}>
                            Clear Date Filter
                        </button>
                    </div>
                )}
            </div>

            {selectedStudent && stats ? (
                <>
                    {/* Primary Stats */}
                    <div className="dashboard-stats" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="stat-card glass-card">
                            <div className="stat-card-icon teal"><Calendar size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.studentAttRate}%</div>
                                <div className="stat-card-label">Attendance</div>
                            </div>
                        </div>
                        <div className="stat-card glass-card">
                            <div className="stat-card-icon blue"><TrendingUp size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.avgScore}%</div>
                                <div className="stat-card-label">Average Marks</div>
                            </div>
                        </div>
                        <div className="stat-card glass-card">
                            <div className="stat-card-icon gold"><AlertCircle size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.examsTaken}</div>
                                <div className="stat-card-label">Exams Taken</div>
                            </div>
                        </div>
                        <div className="stat-card glass-card">
                            <div className="stat-card-icon" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <div className="stat-card-value">{stats.hwCompletionRate}%</div>
                                <div className="stat-card-label">Homework Done</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                        {/* Attendance Breakdown */}
                        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ClipboardCheck size={20} className="text-accent" /> Attendance Record
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {[
                                    { label: 'Total Classes', value: stats.totalClasses, color: 'var(--color-text-primary)' },
                                    { label: 'Attended', value: stats.presentClasses, color: 'var(--color-success)', perc: stats.totalClasses > 0 ? Math.round((stats.presentClasses / stats.totalClasses) * 100) : 0 },
                                    { label: 'Absent', value: stats.absentClasses, color: 'var(--color-danger)', perc: stats.totalClasses > 0 ? Math.round((stats.absentClasses / stats.totalClasses) * 100) : 0 },
                                    { label: 'Late', value: stats.lateClasses, color: 'var(--color-warning)', perc: stats.totalClasses > 0 ? Math.round((stats.lateClasses / stats.totalClasses) * 100) : 0 },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                                            <span className="text-muted">{item.label}</span>
                                            <span style={{ fontWeight: 600, color: item.color }}>
                                                {item.value}{item.perc !== undefined ? ` (${item.perc}%)` : ''}
                                            </span>
                                        </div>
                                        {item.perc !== undefined && (
                                            <div className="progress-bar" style={{ height: 8 }}>
                                                <div className="progress-bar-fill" style={{ width: `${item.perc}%`, background: item.color }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Homework Breakdown */}
                        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <BookOpen size={20} className="text-primary" /> Homework Record
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {[
                                    { label: 'Total Assigned', value: stats.totalHomeworks, color: 'var(--color-text-primary)' },
                                    { label: 'Completed', value: stats.completedHomeworks, color: 'var(--color-success)', perc: stats.totalHomeworks > 0 ? Math.round((stats.completedHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Late', value: stats.lateHomeworks, color: 'var(--color-warning)', perc: stats.totalHomeworks > 0 ? Math.round((stats.lateHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Partial', value: stats.partialHomeworks, color: 'var(--color-primary)', perc: stats.totalHomeworks > 0 ? Math.round((stats.partialHomeworks / stats.totalHomeworks) * 100) : 0 },
                                    { label: 'Not Submitted', value: stats.notSubmittedHomeworks, color: 'var(--color-danger)', perc: stats.totalHomeworks > 0 ? Math.round((stats.notSubmittedHomeworks / stats.totalHomeworks) * 100) : 0 },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                                            <span className="text-muted">{item.label}</span>
                                            <span style={{ fontWeight: 600, color: item.color }}>
                                                {item.value}{item.perc !== undefined ? ` (${item.perc}%)` : ''}
                                            </span>
                                        </div>
                                        {item.perc !== undefined && (
                                            <div className="progress-bar" style={{ height: 8 }}>
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
                        <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-8)' }}>
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-success)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <TrendingUp size={20} /> Top Strengths
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {topicStats.strengths.map(t => (
                                            <span key={t} className="badge" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)', border: '1px solid var(--color-success)', padding: 'var(--space-2) var(--space-4)', borderRadius: '20px', fontSize: 'var(--font-size-sm)' }}>{t}</span>
                                        ))}
                                        {topicStats.strengths.length === 0 && <span className="text-muted small">Not enough data.</span>}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-danger)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <TrendingDown size={20} /> Areas for Improvement
                                    </h3>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {topicStats.weaknesses.map(t => (
                                            <span key={t} className="badge" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: 'var(--space-2) var(--space-4)', borderRadius: '20px', fontSize: 'var(--font-size-sm)' }}>{t}</span>
                                        ))}
                                        {topicStats.weaknesses.length === 0 && <span className="text-muted small">No critical weaknesses detected.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Per-Exam Score Details */}
                    {examTableData.length > 0 && (
                        <div className="glass-card" style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}>
                            <button
                                className="w-full text-left"
                                onClick={() => setShowExamTable(!showExamTable)}
                                style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', borderBottom: showExamTable ? '1px solid var(--color-border)' : 'none' }}
                            >
                                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, margin: 0 }}>📊 Exam Records Sheet</h3>
                                {showExamTable ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {showExamTable && (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <th style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Exam</th>
                                                <th style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Date</th>
                                                {examTableData[0]?.topics?.map(t => (
                                                    <th key={t.name} style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>
                                                        {t.name}{t.maxMarks != null ? <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.6 }}>/{t.maxMarks}</div> : ''}
                                                    </th>
                                                ))}
                                                <th style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Total</th>
                                                <th style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {examTableData.map((row, i) => (
                                                <tr key={i} className="hover-bg" style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: 'var(--space-4) var(--space-6)', fontWeight: 500 }}>{row.title}</td>
                                                    <td style={{ padding: 'var(--space-4) var(--space-6)', color: 'var(--color-text-secondary)' }}>{row.date}</td>
                                                    {row.topics.map(t => (
                                                        <td key={t.name} style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center' }}>
                                                            {row.topicMarks[t.name] !== undefined ? row.topicMarks[t.name] : '—'}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center', fontWeight: 600 }}>
                                                        {row.marksObtained}/{row.totalMarks}
                                                    </td>
                                                    <td style={{ padding: 'var(--space-4) var(--space-6)', textAlign: 'center', fontWeight: 700, color: row.percentage >= 70 ? 'var(--color-success)' : row.percentage >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
                        {/* Attendance Trend */}
                        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Recent Attendance</div>
                                <div className="text-muted small">Last 15 classes (100 = Present, 0 = Absent)</div>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={attData}>
                                    <defs>
                                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 100]} ticks={[0, 100]} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: 'rgba(23, 23, 23, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f1f5f9' }} />
                                    <Area type="step" dataKey="status" stroke="#14b8a6" fill="url(#colorAtt)" strokeWidth={2} activeDot={{ r: 6, strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Exam History */}
                        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Exam Performance</div>
                                <div className="text-muted small">Student scores vs Batch average</div>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={examData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ background: 'rgba(23, 23, 23, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f1f5f9' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                                    <Bar dataKey="Student" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="BatchAvg" fill="rgba(255,255,255,0.2)" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Homework Status */}
                        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Recent Homework</div>
                                <div className="text-muted small">Last 10 assignments (1 = Done, 0 = Pending)</div>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={hwData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 1]} ticks={[0, 1]} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgba(23, 23, 23, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f1f5f9' }}
                                        formatter={(value) => [value === 1 ? 'Completed' : 'Pending', 'Status']}
                                    />
                                    <Bar dataKey="Status" radius={[4, 4, 0, 0]} barSize={25}>
                                        {hwData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.Status === 1 ? 'var(--color-success)' : 'var(--color-danger-soft)'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <div className="empty-state glass-card" style={{ padding: 'var(--space-12)' }}>
                    <div className="empty-state-icon" style={{ background: 'var(--color-bg-elevated)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                        <User size={40} className="text-muted" />
                    </div>
                    <h2 className="empty-state-title" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Student Selected</h2>
                    <p className="empty-state-text" style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Select a student from the menu above to see their progress and graphs.</p>
                </div>
            )}
        </div>
    );
}


