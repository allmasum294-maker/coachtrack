import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, FileSignature, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export default function ReportCard() {
    const { currentUser, userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homework, setHomework] = useState([]);
    const [loading, setLoading] = useState(true);
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

    function generatePDF() {
        const stats = getStudentStats();
        if (!stats) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // Title
        doc.setFontSize(22);
        doc.setTextColor(20, 184, 166); // Teal
        doc.text("Student Performance Report", pageWidth / 2, 20, { align: "center" });

        // Instructor Name
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Instructor: ${userProfile?.displayName || 'Teacher'}`, pageWidth / 2, 28, { align: "center" });
        doc.text(`Date Generated: ${format(new Date(), 'MMM d, yyyy')}`, pageWidth / 2, 34, { align: "center" });

        doc.setDrawColor(20, 184, 166);
        doc.setLineWidth(1);
        doc.line(14, 40, pageWidth - 14, 40);

        // Student Details
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text(`Student Name: ${selectedStudent.name}`, 14, 52);
        doc.text(`Grade/Class: ${selectedStudent.grade || 'N/A'}`, 14, 60);
        doc.text(`School: ${selectedStudent.school || 'N/A'}`, 14, 68);

        const assignedBatches = batches.filter(b => selectedStudent.batchIds?.includes(b.id)).map(b => b.name).join(', ');
        doc.text(`Batches: ${assignedBatches || 'None'}`, 14, 76);

        // Attendance Summary
        doc.setFontSize(16);
        doc.setTextColor(20, 184, 166);
        doc.text("Attendance Summary", 14, 90);
        doc.setFontSize(12);
        doc.setTextColor(50);
        doc.text(`Total Classes: ${stats.totalClasses}`, 14, 100);
        doc.text(`Classes Attended: ${stats.presentClasses}`, 14, 108);
        doc.text(`Attendance Percentage: ${stats.attRate}%`, 14, 116);

        // Homework Summary
        doc.setFontSize(16);
        doc.setTextColor(20, 184, 166);
        doc.text("Homework Completion", pageWidth / 2, 90);
        doc.setFontSize(12);
        doc.setTextColor(50);
        doc.text(`Total Assigned: ${stats.totalHomework}`, pageWidth / 2, 100);
        doc.text(`Completed: ${stats.completedHomework}`, pageWidth / 2, 108);
        doc.text(`Completion Rate: ${stats.hwCompletionRate}%`, pageWidth / 2, 116);

        // Academic Performance Table
        doc.setFontSize(16);
        doc.setTextColor(20, 184, 166);
        doc.text("Academic Performance", 14, 136);

        const tableColumn = ["Exam Title", "Date", "Marks Obtained", "Total Marks", "Percentage"];
        const tableRows = [];

        stats.studentExams.forEach(e => {
            const rowData = [
                e.title,
                e.date,
                e.marks.toString(),
                e.total.toString(),
                `${e.percent}%`
            ];
            tableRows.push(rowData);
        });

        tableRows.push(["OVERALL AVERAGE", "", "", "", `${stats.avgScore}%`]);

        doc.autoTable({
            startY: 144,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [20, 184, 166] },
            styles: { fontSize: 11 },
            alternateRowStyles: { fillColor: [240, 248, 255] }
        });

        const finalY = doc.previousAutoTable.finalY || 144;

        // Remarks
        doc.setFontSize(16);
        doc.setTextColor(20, 184, 166);
        doc.text("Instructor Remarks", 14, finalY + 20);
        
        doc.setFontSize(12);
        doc.setTextColor(50);
        
        const splitRemarks = doc.splitTextToSize(remarks || "Keep up the excellent effort!", pageWidth - 28);
        doc.text(splitRemarks, 14, finalY + 30);

        // Footer signature line
        const sigY = pageHeight - 30;
        doc.setDrawColor(100);
        doc.line(pageWidth - 80, sigY, pageWidth - 14, sigY);
        doc.setFontSize(10);
        doc.text("Authorized Signature", pageWidth - 47, sigY + 6, { align: "center" });

        doc.save(`${selectedStudent.name.replace(/\s+/g, '_')}_ReportCard.pdf`);
    }

    const stats = getStudentStats();

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Report Card Generator</h1>
                    <p className="page-subtitle">Create downloadable PDF performance summaries</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-4)' }}>
                    <div className="form-group" style={{ maxWidth: 400 }}>
                        <label className="form-label">Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {selectedStudent && stats ? (
                <div className="dashboard-grid">
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileSignature size={18} style={{ color: 'var(--color-primary)' }} />
                                Report Card Preview
                            </div>
                        </div>
                        <div style={{ padding: 'var(--space-4)' }}>
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

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                                    <button className="btn btn-primary" onClick={generatePDF} style={{ padding: 'var(--space-3) var(--space-6)' }}>
                                        <Download size={18} /> Download PDF Report
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
