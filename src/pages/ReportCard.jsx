import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, FileSignature, Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function ReportCard() {
    const { currentUser, userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homework, setHomework] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [remarks, setRemarks] = useState('');

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
                getDocs(query(collection(db, 'homework'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomework(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const filteredStudents = selectedBatchId ? students.filter(s => s.batchIds?.includes(selectedBatchId)) : students;

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    function getStudentStats() {
        if (!selectedStudent) return null;

        let totalClasses = 0;
        let presentClasses = 0;

        attendance.forEach((a) => {
            if (selectedStudent.batchIds?.includes(a.batchId)) {
                (a.records || []).forEach(r => {
                    if (r.studentId === selectedStudent.id) {
                        totalClasses++;
                        if (r.status === 'present') presentClasses++;
                    }
                });
            }
        });

        const attRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        const studentExams = [];
        let totalExamMarks = 0;
        let totalMarksEarned = 0;

        exams.forEach(e => {
            if (selectedStudent.batchIds?.includes(e.batchId)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (sScore) {
                    const perc = e.totalMarks > 0 ? Math.round((sScore.marksObtained / e.totalMarks) * 100) : 0;
                    studentExams.push({
                        title: e.title,
                        date: e.date?.toDate ? format(e.date.toDate(), 'MMM d, yyyy') : 'No Date',
                        marks: sScore.marksObtained,
                        total: e.totalMarks,
                        percent: perc
                    });
                    totalExamMarks += e.totalMarks;
                    totalMarksEarned += sScore.marksObtained;
                }
            }
        });

        const avgScore = totalExamMarks > 0 ? Math.round((totalMarksEarned / totalExamMarks) * 100) : 0;

        let totalHomework = 0;
        let completedHomework = 0;

        homework.forEach(hw => {
            if (selectedStudent.batchIds?.includes(hw.batchId)) {
                totalHomework++;
                if ((hw.completedBy || []).includes(selectedStudent.id)) {
                    completedHomework++;
                }
            }
        });

        const hwCompletionRate = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

        return { totalClasses, presentClasses, attRate, studentExams, avgScore, totalHomework, completedHomework, hwCompletionRate };
    }

    const handlePrint = () => {
        window.print();
    };

    const stats = getStudentStats();

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <style>
                {`
                @media print {
                    @page { margin: 0; }
                    body { margin: 1cm; background: white; }
                    .app-layout { grid-template-columns: 1fr; }
                    .sidebar, .topbar, .page-header, .no-print { display: none !important; }
                    .main-content { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; }
                    .print-section {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        max-width: 100%;
                        background: white !important;
                        color: black !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                `}
            </style>
            <div className="page-header no-print">
                <div>
                    <h1 className="page-title">Report Card Generator</h1>
                    <p className="page-subtitle">Create downloadable PDF performance summaries</p>
                </div>
            </div>

            <div className="card no-print" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '1 1 300px' }}>
                        <label className="form-label">Filter by Batch</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                            <option value="">-- All Batches --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ flex: '1 1 300px' }}>
                        <label className="form-label">Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {selectedStudent && stats ? (
                <div className="dashboard-grid">
                    <div className="card print-section" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-header no-print">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileSignature size={18} style={{ color: 'var(--color-primary)' }} />
                                Report Card Preview
                            </div>
                        </div>
                        <div style={{ padding: 'var(--space-4)' }} className="print-section">
                            <div style={{ background: 'var(--color-bg-base)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)', borderBottom: '2px solid var(--color-primary)', paddingBottom: 'var(--space-4)' }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>Student Performance Report</h2>
                                    <p style={{ color: 'var(--color-text-secondary)' }}>Instructor: {userProfile?.displayName || 'Teacher'}</p>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                                    <div>
                                        <p><strong>Name:</strong> {selectedStudent.name}</p>
                                        <p><strong>Grade:</strong> {selectedStudent.grade}</p>
                                        <p><strong>School:</strong> {selectedStudent.school || 'N/A'}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p><strong>Overall Attendance:</strong> {stats.attRate}%</p>
                                        <p><strong>Average Exam Score:</strong> {stats.avgScore}%</p>
                                        <p><strong>Homework Completion:</strong> {stats.hwCompletionRate}%</p>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Academic Breakdown</h3>
                                <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
                                    <thead>
                                        <tr>
                                            <th>Exam</th>
                                            <th>Date</th>
                                            <th>Marks</th>
                                            <th>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.studentExams.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No exams taken</td></tr>
                                        ) : (
                                            stats.studentExams.map((e, i) => (
                                                <tr key={i}>
                                                    <td>{e.title}</td>
                                                    <td>{e.date}</td>
                                                    <td>{e.marks} / {e.total}</td>
                                                    <td>{e.percent}%</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Instructor Remarks (Added to PDF)</label>
                                    <textarea 
                                        className="form-textarea" 
                                        rows={4} 
                                        placeholder="Add any specific comments or feedback about the student's performance here..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>

                                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                                    <button className="btn btn-primary" onClick={handlePrint} style={{ padding: 'var(--space-3) var(--space-6)' }}>
                                        <Printer size={18} /> Print PDF Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="empty-state card">
                    <User size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }} />
                    <div className="empty-state-title">Select a Student</div>
                    <div className="empty-state-text">Choose a student above to preview and generate their report card.</div>
                </div>
            )}
        </div>
    );
}
