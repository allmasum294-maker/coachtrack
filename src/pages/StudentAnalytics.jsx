import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format } from 'date-fns';

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

    const filteredStudents = selectedBatchId
        ? students.filter(s => s.batchIds?.includes(selectedBatchId))
        : students;

    // Reset selected student if they are no longer in the filtered list
    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    // Compute stats
    const getStudentStats = () => {
        if (!selectedStudent) return null;

        let totalClasses = 0;
        let presentClasses = 0;
        
        let batchTotalClasses = 0;
        let batchPresentClasses = 0;

        attendance.forEach((a) => {
            if (selectedStudent.batchIds?.includes(a.batchId)) {
                (a.records || []).forEach(r => {
                    batchTotalClasses++;
                    if (r.status === 'present') batchPresentClasses++;
                    if (r.studentId === selectedStudent.id) {
                        totalClasses++;
                        if (r.status === 'present') {
                            presentClasses++;
                        }
                    }
                });
            }
        });

        const studentAttRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
        const batchAttRate = batchTotalClasses > 0 ? Math.round((batchPresentClasses / batchTotalClasses) * 100) : 0;

        let totalExamMarks = 0;
        let totalMarksEarned = 0;
        let examsTaken = 0;

        exams.forEach(e => {
            if (selectedStudent.batchIds?.includes(e.batchId)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (sScore) {
                    examsTaken++;
                    totalExamMarks += e.totalMarks;
                    totalMarksEarned += sScore.marksObtained;
                }
            }
        });

        const avgScore = totalExamMarks > 0 ? Math.round((totalMarksEarned / totalExamMarks) * 100) : 0;

        let totalHomeworks = 0;
        let completedHomeworks = 0;
        let batchTotalHwCompleted = 0;
        let batchHwOpportunities = 0;

        homeworks.forEach(hw => {
            if (selectedStudent.batchIds?.includes(hw.batchId)) {
                totalHomeworks++;
                if ((hw.completedBy || []).includes(selectedStudent.id)) {
                    completedHomeworks++;
                }

                // calculating batch average hw completion
                const studentsInBatch = students.filter(s => s.batchIds?.includes(hw.batchId)).length;
                batchHwOpportunities += studentsInBatch;
                batchTotalHwCompleted += (hw.completedBy || []).length;
            }
        });

        const hwCompletionRate = totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0;
        const batchHwRate = batchHwOpportunities > 0 ? Math.round((batchTotalHwCompleted / batchHwOpportunities) * 100) : 0;

        return { studentAttRate, batchAttRate, avgScore, examsTaken, hwCompletionRate, batchHwRate, totalHomeworks, completedHomeworks };
    };

    const stats = getStudentStats();

    // Chart Data functions
    const getAttendanceHistory = () => {
        if (!selectedStudent) return [];
        const history = [];
        attendance
            .filter(a => selectedStudent.batchIds?.includes(a.batchId))
            .sort((a,b) => {
                const d1 = a.date.toDate ? a.date.toDate() : new Date(a.date);
                const d2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                return d1 - d2;
            })
            .forEach(a => {
                const record = (a.records || []).find(r => r.studentId === selectedStudent.id);
                if (record) {
                    const dateVal = a.date.toDate ? a.date.toDate() : new Date(a.date);
                    history.push({
                        date: format(dateVal, 'MMM d'),
                        status: record.status === 'present' ? 100 : 0,
                    });
                }
            });
        
        return history.slice(-15);
    };

    const getExamHistory = () => {
        if (!selectedStudent) return [];
        const history = [];
        exams
            .filter(e => selectedStudent.batchIds?.includes(e.batchId))
            .sort((a,b) => {
                const d1 = a.date.toDate ? a.date.toDate() : new Date(a.date);
                const d2 = b.date.toDate ? b.date.toDate() : new Date(b.date);
                return d1 - d2;
            })
            .forEach(e => {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (sScore) {
                    let batchSum = 0;
                    e.scores.forEach(s => batchSum += s.marksObtained);
                    const batchAvg = e.scores.length > 0 ? Math.round((batchSum / e.scores.length) / e.totalMarks * 100) : 0;
                    const studentScore = Math.round((sScore.marksObtained / e.totalMarks) * 100);
                    
                    history.push({
                        name: e.title,
                        Student: studentScore,
                        BatchAvg: batchAvg
                    });
                }
            });
        return history.slice(-10);
    };

    const getHomeworkHistory = () => {
        if (!selectedStudent) return [];
        const history = [];
        homeworks
            .filter(hw => selectedStudent.batchIds?.includes(hw.batchId))
            .sort((a,b) => {
                const d1 = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate || a.createdAt);
                const d2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate || b.createdAt);
                return d1 - d2;
            })
            .forEach(hw => {
                const isCompleted = (hw.completedBy || []).includes(selectedStudent.id);
                history.push({
                    name: hw.title.substring(0, 15) + (hw.title.length > 15 ? '...' : ''),
                    Status: isCompleted ? 1 : 0
                });
            });
        return history.slice(-10);
    };

    const examData = getExamHistory();
    const attData = getAttendanceHistory();
    const hwData = getHomeworkHistory();

    const getTopicStats = () => {
        if (!selectedStudent) return { strengths: [], weaknesses: [] };
        const topicsPerformance = {};
        exams.forEach(e => {
            if (selectedStudent.batchIds?.includes(e.batchId)) {
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
                        
                        if (!topicsPerformance[topic]) {
                            topicsPerformance[topic] = { count: 0, diffSum: 0 };
                        }
                        topicsPerformance[topic].diffSum += diff;
                        topicsPerformance[topic].count += 1;
                    });
                }
            }
        });

        const analyzedTopics = Object.entries(topicsPerformance).map(([topic, data]) => {
            return {
                topic,
                avgDiff: data.diffSum / data.count,
            };
        });

        analyzedTopics.sort((a, b) => b.avgDiff - a.avgDiff);

        return {
            strengths: analyzedTopics.filter(t => t.avgDiff >= 0).slice(0, 3).map(t => t.topic),
            weaknesses: [...analyzedTopics].reverse().filter(t => t.avgDiff < 0).slice(0, 3).map(t => t.topic)
        };
    };

    const topicStats = getTopicStats();

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
                    
                    <div style={{ flex: '1 1 300px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter by Batch (Optional)</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                            <option value="">-- All Batches --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: '1 1 300px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student to View Analytics</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>

                </div>
            </div>

            {selectedStudent && stats ? (
                <>
                    {/* Quick Stats */}
                    <div className="dashboard-stats" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="stat-card">
                            <div className="stat-card-icon teal"><Calendar size={24} /></div>
                            <div>
                                <div className="stat-card-value">{stats.studentAttRate}%</div>
                                <div className="stat-card-label">Overall Attendance</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Batch Average: {stats.batchAttRate}%</div>
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                            </div>
                            <div>
                                <div className="stat-card-value">{stats.hwCompletionRate}%</div>
                                <div className="stat-card-label">Homework Done</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Batch Average: {stats.batchHwRate}%</div>
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
                                        {topicStats.strengths.length === 0 && <span style={{color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)'}}>Not enough data.</span>}
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
                                        {topicStats.weaknesses.length === 0 && <span style={{color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)'}}>No critical weaknesses detected.</span>}
                                    </div>
                                </div>
                            </div>
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

                        {/* Exam History vs Batch */}
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

                        {/* Recent Homework Status */}
                        <div className="chart-card card">
                            <div className="chart-card-header" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                                <div>
                                    <div className="chart-card-title">Recent Homework Tracker</div>
                                    <div className="chart-card-subtitle">Last 10 assignments (1 = Done, 0 = Pending)</div>
                                </div>
                            </div>
                            <div style={{ padding: 'var(--space-4)' }}>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={hwData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                        <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={11} tick={{fill: 'var(--color-text-muted)'}} />
                                        <YAxis stroke="var(--color-text-muted)" fontSize={11} domain={[0, 1]} ticks={[0, 1]} tick={{fill: 'var(--color-text-muted)'}} />
                                        <Tooltip 
                                            contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text-primary)' }} 
                                            formatter={(value) => [value === 1 ? 'Completed' : 'Pending', 'Status']}
                                        />
                                        <Bar dataKey="Status" fill="url(#colorAtt)" radius={[4, 4, 0, 0]}>
                                            {hwData.map((entry, index) => (
                                                <cell key={`cell-${index}`} fill={entry.Status === 1 ? 'var(--color-success)' : 'var(--color-danger)'} />
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
