import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    User, FileSignature, Printer, Search, 
    Award, TrendingUp, BarChart3, BookOpen,
    GraduationCap, Calendar, CheckCircle2, AlertCircle,
    Star, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';
import { examService } from '../services/examService';
import { homeworkService } from '../services/homeworkService';

export default function ReportCard() {
    const { userProfile } = useAuth();
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
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [allStudents, activeBatches, allAttendance, allExams, allHomeworks] = await Promise.all([
                studentService.getStudentsByTeacher(uid),
                batchService.getBatches(uid, true),
                attendanceService.getAttendanceByTeacher(uid),
                examService.getExams(uid),
                homeworkService.getHomeworkByTeacher(uid),
            ]);
            setStudents(allStudents || []);
            setBatches(activeBatches);
            setAttendance(allAttendance);
            setExams(allExams);
            setHomework(allHomeworks);
        } catch (err) {
            console.error('Error loading student data:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredStudents = useMemo(() => {
        let list = students;
        if (selectedBatchId) {
            list = list.filter(s => s.batchIds?.includes(selectedBatchId));
        }
        return list;
    }, [students, selectedBatchId]);

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    const selectedStudent = useMemo(() => students.find((s) => s.id === selectedStudentId), [students, selectedStudentId]);

    const stats = useMemo(() => {
        if (!selectedStudent) return null;

        let totalClasses = 0;
        let presentClasses = 0;

        attendance.forEach((a) => {
            if (selectedStudent.batchIds?.includes(a.batch_id)) {
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
            if (selectedStudent.batchIds?.includes(e.batch_id)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
                if (sScore) {
                    const perc = e.totalMarks > 0 ? Math.round((sScore.marksObtained / e.totalMarks) * 100) : 0;
                    studentExams.push({
                        title: e.title,
                        date: e.date ? format(new Date(e.date), 'MMM d, yyyy') : 'No Date',
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
            if (selectedStudent.batchIds?.includes(hw.batch_id)) {
                totalHomework++;
                const submissions = hw.submissions || [];
                const sub = submissions.find(s => s.student_id === selectedStudent.id);
                if (sub && (sub.status === 'completed' || sub.status === 'late')) {
                    completedHomework++;
                }
            }
        });

        const hwCompletionRate = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

        return { totalClasses, presentClasses, attRate, studentExams, avgScore, totalHomework, completedHomework, hwCompletionRate };
    }, [selectedStudent, attendance, exams, homework]);

    const handlePrint = () => window.print();

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <style>
                {`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; background: white !important; font-family: 'Inter', sans-serif !important; }
                    .app-layout { grid-template-columns: 1fr; display: block !important; }
                    .sidebar, .topbar, .page-header, .no-print, .btn, .tabs, .glass-card:not(.print-section), .glass-panel:not(.print-section) { display: none !important; }
                    .main-content { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
                    .print-section {
                        margin: 0 !important;
                        padding: 40px !important;
                        width: 100% !important;
                        height: 100vh;
                        box-sizing: border-box;
                        background: white !important;
                        color: black !important;
                        box-shadow: none !important;
                        border: none !important;
                        backdrop-filter: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .report-card-inner {
                        border: 3px double #000 !important;
                        padding: 2.5rem !important;
                        background: transparent !important;
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .badge { border: 1px solid #ddd !important; background: transparent !important; color: black !important; }
                }
                `}
            </style>
            
            <div className="page-header no-print">
                <div>
                    <h1 className="page-title">Report Card</h1>
                    <p className="page-subtitle">Create and print report cards for your students</p>
                </div>
            </div>

            {/* Premium Selector */}
            <div className="glass-card no-print" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={14} /> SELECT BATCH
                        </label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={{ height: '52px', fontWeight: 700 }}>
                            <option value="">All Batches</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <GraduationCap size={16} /> SELECT STUDENT
                        </label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={{ height: '52px', fontWeight: 700 }}>
                            <option value="">Choose a student...</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {selectedStudent && stats ? (
                <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div className="glass-panel print-section" style={{ padding: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
                        {/* Decorative background for UI */}
                        <div className="no-print" style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, background: 'var(--color-primary)', filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none' }} />
                        
                        <div className="report-card-inner" style={{ background: 'rgba(255,255,255,0.02)', padding: 'var(--space-10)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                            
                            {/* Certificate Header */}
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
                                <div style={{ display: 'inline-block', marginBottom: 'var(--space-6)', position: 'relative' }}>
                                    <div style={{ padding: '16px', background: 'var(--color-primary)', borderRadius: '24px', color: 'white', boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.5)' }}>
                                        <Award size={40} />
                                    </div>
                                    <div style={{ position: 'absolute', top: -10, right: -10, color: '#fbbf24' }}>
                                        <Sparkles size={24} className="animate-pulse" />
                                    </div>
                                </div>
                                <h2 style={{ fontSize: '38px', fontWeight: 900, color: 'var(--color-text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Report Card</h2>
                                <div style={{ height: '3px', width: '80px', background: 'var(--color-primary)', margin: '0 auto var(--space-4)', borderRadius: '2px' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-8)', marginBottom: 'var(--space-12)', padding: 'var(--space-8)', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>STUDENT NAME</h4>
                                    <p style={{ fontSize: '20px', fontWeight: 900 }}>{selectedStudent.name}</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>GRADE</h4>
                                    <p style={{ fontSize: '20px', fontWeight: 900 }}>{selectedStudent.grade}</p>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>YEAR</h4>
                                    <p style={{ fontSize: '20px', fontWeight: 900 }}>{format(new Date(), 'yyyy')}</p>
                                </div>
                            </div>

                            {/* Performance Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', textAlign: 'center', borderBottom: '4px solid var(--color-teal)' }}>
                                    <div style={{ color: 'var(--color-teal)', marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={24} /></div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>ATTENDANCE</h4>
                                    <div style={{ fontSize: '32px', fontWeight: 900 }}>{stats.attRate}<span style={{ fontSize: '14px', opacity: 0.5 }}>%</span></div>
                                </div>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', textAlign: 'center', borderBottom: '4px solid var(--color-primary)', background: 'rgba(59, 130, 246, 0.05)' }}>
                                    <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}><TrendingUp size={24} /></div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>EXAM MARKS</h4>
                                    <div style={{ fontSize: '32px', fontWeight: 900 }}>{stats.avgScore}<span style={{ fontSize: '14px', opacity: 0.5 }}>%</span></div>
                                </div>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', textAlign: 'center', borderBottom: '4px solid var(--color-warning)' }}>
                                    <div style={{ color: 'var(--color-warning)', marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}><Star size={24} /></div>
                                    <h4 style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>HOMEWORK</h4>
                                    <div style={{ fontSize: '32px', fontWeight: 900 }}>{stats.hwCompletionRate}<span style={{ fontSize: '14px', opacity: 0.5 }}>%</span></div>
                                </div>
                            </div>

                            {/* Exam Records */}
                            <div style={{ marginBottom: 'var(--space-12)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: 'var(--space-6)' }}>
                                    <BarChart3 size={24} color="var(--color-primary)" />
                                    <h3 style={{ fontSize: '20px', fontWeight: 900 }}>Exam Records</h3>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                                </div>
                                <div className="table-container" style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', overflow: 'hidden' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '18px 24px', background: 'rgba(255,255,255,0.02)' }}>EXAM TITLE</th>
                                                <th style={{ background: 'rgba(255,255,255,0.02)' }}>DATE</th>
                                                <th style={{ background: 'rgba(255,255,255,0.02)' }}>MARKS</th>
                                                <th style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'right', paddingRight: '24px' }}>RESULT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.studentExams.length === 0 ? (
                                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)', fontSize: '15px', fontStyle: 'italic' }}>No exams found for this student yet.</td></tr>
                                            ) : (
                                                stats.studentExams.map((e, i) => (
                                                    <tr key={i}>
                                                        <td style={{ padding: '20px 24px', fontWeight: 800 }}>{e.title}</td>
                                                        <td style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{e.date}</td>
                                                        <td><span style={{ fontWeight: 900 }}>{e.marks}</span> <span style={{ opacity: 0.5 }}>/ {e.total}</span></td>
                                                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                                                                <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                    <div style={{ width: `${e.percent}%`, height: '100%', background: e.percent >= 80 ? 'var(--color-teal)' : e.percent >= 60 ? 'var(--color-primary)' : 'var(--color-warning)' }} />
                                                                </div>
                                                                <span style={{ fontWeight: 900, minWidth: '40px' }}>{e.percent}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Teacher's Notes */}
                            <div className="no-print" style={{ marginBottom: 'var(--space-8)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <TrendingUp size={18} color="var(--color-primary)" />
                                    <h3 style={{ fontSize: '16px', fontWeight: 900 }}>Teacher's Notes</h3>
                                </div>
                                <textarea 
                                    className="form-textarea" 
                                    rows={4} 
                                    placeholder="Write your notes about the student's progress and areas for improvement here..."
                                    style={{ borderRadius: '20px', padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '15px', fontWeight: 600, lineHeight: '1.6' }}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                            </div>

                            {/* Official Signature Section */}
                            <div style={{ marginTop: 'var(--space-12)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <div style={{ width: '180px', height: '1px', background: 'black', marginBottom: '10px', display: 'none' }} className="only-print"></div>
                                    <div style={{ fontWeight: 900, fontSize: '15px' }}>{userProfile?.displayName || 'TEACHER'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>TEACHER SIGNATURE</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 900, fontSize: '15px' }}>{format(new Date(), 'MMMM d, yyyy')}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ISSUE DATE</div>
                                </div>
                            </div>
                        </div>

                        {/* Export Trigger */}
                        <div className="no-print" style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary btn-lg" onClick={handlePrint} style={{ height: '60px', padding: '0 40px', borderRadius: '18px', fontSize: '16px', fontWeight: 900, boxShadow: '0 15px 30px -10px rgba(59, 130, 246, 0.4)', gap: '12px' }}>
                                <Printer size={20} /> PRINT REPORT
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in no-print">
                    <div className="glass-panel" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                        <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-8)' }}>
                            <GraduationCap size={44} style={{ color: 'var(--color-border)', opacity: 0.5 }} />
                        </div>
                        <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px' }}>Create a Report</h2>
                        <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', margin: '0 auto' }}>Select a student above to see their report card and print it.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
