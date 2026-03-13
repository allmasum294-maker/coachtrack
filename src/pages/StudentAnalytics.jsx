import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState('');

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [studentSnap, batchSnap, attSnap, examSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

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

        return { studentAttRate, batchAttRate, avgScore, examsTaken };
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

    const examData = getExamHistory();
    const attData = getAttendanceHistory();

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
                <div style={{ padding: 'var(--space-4)' }}>
                    <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student to View Analytics</label>
                    <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={{ maxWidth: 400 }}>
                        <option value="">-- Choose a Student --</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                    </select>
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
                    </div>

                    <div className="analytics-charts">
                        {/* Attendance Trend */}
                        <div className="chart-card">
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
