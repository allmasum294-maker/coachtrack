import { useState, useMemo } from 'react';
import { 
    X, Printer, Calendar, Award, TrendingUp, 
    Star, CheckCircle2, BarChart3, GraduationCap, 
    ChevronRight, Info
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';

export default function ReportCardModal({ student, batches, attendance, exams, homeworks, onClose }) {
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
    const [remarks, setRemarks] = useState('');

    const stats = useMemo(() => {
        if (!student) return null;

        const interval = {
            start: startOfDay(new Date(dateFrom || '2000-01-01')),
            end: endOfDay(new Date(dateTo || '2100-01-01'))
        };

        // 1. Attendance
        let totalClasses = 0;
        let presentClasses = 0;
        attendance.forEach(a => {
            if (student.batchIds?.includes(a.batch_id)) {
                const aDate = new Date(a.date);
                if (isWithinInterval(aDate, interval)) {
                    const record = (a.records || []).find(r => r.studentId === student.id);
                    if (record) {
                        totalClasses++;
                        if (record.status === 'present') {
                            presentClasses++;
                        } else if (record.status === 'late') {
                            presentClasses += 0.5; // 50% credit for being late
                        }
                    }
                }
            }
        });
        const attRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        // 2. Exams
        const studentExams = [];
        let totalExamMarks = 0;
        let totalMarksEarned = 0;
        exams.forEach(e => {
            if (student.batchIds?.includes(e.batch_id)) {
                const eDate = new Date(e.date);
                if (isWithinInterval(eDate, interval)) {
                    const sScore = (e.scores || []).find(sc => sc.studentId === student.id);
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
            }
        });
        const avgScore = totalExamMarks > 0 ? Math.round((totalMarksEarned / totalExamMarks) * 100) : 0;

        // 3. Homework
        let totalHomework = 0;
        let completedHomework = 0;
        homeworks.forEach(hw => {
            if (student.batchIds?.includes(hw.batch_id)) {
                const hwDate = new Date(hw.due_date || hw.created_at);
                if (isWithinInterval(hwDate, interval)) {
                    totalHomework++;
                    
                    // Unified submission check
                    const sub = (hw.submissions || {})[student.id];
                    if (sub) {
                        if (sub.status === 'completed') {
                            completedHomework += 1;
                        } else if (sub.status === 'late') {
                            completedHomework += 0.7; // 70% credit for late homework
                        }
                    }
                }
            }
        });
        const hwRate = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

        return { attRate, totalClasses, presentClasses, studentExams, avgScore, totalHomework, completedHomework, hwRate };
    }, [student, attendance, exams, homeworks, dateFrom, dateTo]);

    const handlePrint = () => {
        window.print();
    };

    if (!student) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-container" style={{ maxWidth: '1000px', width: '95%', height: '90vh', overflowY: 'auto', padding: 0, background: 'var(--color-bg-main)' }}>
                
                {/* Modal Controls (Hidden in Print) */}
                <div className="no-print" style={{ 
                    position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg-card)', 
                    padding: '16px 32px', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)' }}>FROM</div>
                            <input type="date" className="form-input" style={{ width: '130px', height: '36px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)' }}>TO</div>
                            <input type="date" className="form-input" style={{ width: '130px', height: '36px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-primary" onClick={handlePrint} style={{ gap: '8px' }}>
                            <Printer size={18} /> Print Report
                        </button>
                        <button className="btn btn-ghost" onClick={onClose} style={{ width: '40px', padding: 0 }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Report Card Content */}
                <div className="report-card-print-area" style={{ padding: '60px', minHeight: '100%' }}>
                    <div className="report-card-border" style={{ 
                        border: '2px solid var(--color-primary)', 
                        padding: '40px', borderRadius: '32px', 
                        background: 'rgba(255,255,255,0.01)',
                        position: 'relative'
                    }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                            <Award size={64} color="var(--color-primary)" style={{ marginBottom: '16px' }} />
                            <h1 style={{ fontSize: '42px', fontWeight: 900, marginBottom: '8px' }}>Academic Performance</h1>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                                Progress Report • {format(new Date(dateFrom), 'MMM d')} to {format(new Date(dateTo), 'MMM d, yyyy')}
                            </div>
                        </div>

                        {/* Student Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '30px', marginBottom: '50px', paddingBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Student Name</div>
                                <div style={{ fontSize: '24px', fontWeight: 900 }}>{student.name}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Grade / Class</div>
                                <div style={{ fontSize: '24px', fontWeight: 900 }}>{student.grade}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Batch ID</div>
                                <div style={{ fontSize: '24px', fontWeight: 900 }}>{batches.find(b => student.batchIds?.includes(b.id))?.name || 'N/A'}</div>
                            </div>
                        </div>

                        {/* Metric Highlights */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '50px' }}>
                            <div style={{ padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <CheckCircle2 size={32} color="var(--color-teal)" style={{ marginBottom: '12px', margin: '0 auto' }} />
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '4px' }}>ATTENDANCE</div>
                                <div style={{ fontSize: '42px', fontWeight: 900 }}>{stats.attRate}%</div>
                            </div>
                            <div style={{ padding: '30px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <TrendingUp size={32} color="var(--color-primary)" style={{ marginBottom: '12px', margin: '0 auto' }} />
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '4px' }}>EXAM AVERAGE</div>
                                <div style={{ fontSize: '42px', fontWeight: 900 }}>{stats.avgScore}%</div>
                            </div>
                            <div style={{ padding: '30px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Star size={32} color="var(--color-warning)" style={{ marginBottom: '12px', margin: '0 auto' }} />
                                <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '4px' }}>HOMEWORK</div>
                                <div style={{ fontSize: '42px', fontWeight: 900 }}>{stats.hwRate}%</div>
                            </div>
                        </div>

                        {/* Exam Table */}
                        <div style={{ marginBottom: '50px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <BarChart3 size={24} color="var(--color-primary)" />
                                <h3 style={{ fontSize: '20px', fontWeight: 900 }}>Detailed Exam Scores</h3>
                            </div>
                            <div style={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', color: 'var(--color-text-muted)' }}>EXAM NAME</th>
                                            <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '12px', color: 'var(--color-text-muted)' }}>DATE</th>
                                            <th style={{ textAlign: 'center', padding: '16px 24px', fontSize: '12px', color: 'var(--color-text-muted)' }}>MARKS</th>
                                            <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '12px', color: 'var(--color-text-muted)' }}>PERCENTAGE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.studentExams.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>No exams recorded in this period.</td>
                                            </tr>
                                        ) : (
                                            stats.studentExams.map((e, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '20px 24px', fontWeight: 800 }}>{e.title}</td>
                                                    <td style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{e.date}</td>
                                                    <td style={{ textAlign: 'center', padding: '20px 24px', fontWeight: 700 }}>{e.marks} / {e.total}</td>
                                                    <td style={{ textAlign: 'right', padding: '20px 24px', fontWeight: 900, color: e.percent >= 80 ? 'var(--color-teal)' : 'var(--color-primary)' }}>{e.percent}%</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Teacher Remarks */}
                        <div style={{ marginBottom: '60px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Teacher's Observations</div>
                            <div className="no-print">
                                <textarea 
                                    className="form-textarea" 
                                    rows={4} 
                                    placeholder="Write your notes here before printing..."
                                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>
                            <div className="only-print" style={{ 
                                padding: '20px', minHeight: '100px', 
                                border: '1px dashed #000', borderRadius: '16px', 
                                fontSize: '16px', lineHeight: '1.6', 
                                color: '#000', background: 'transparent' 
                            }}>
                                {remarks || 'No remarks provided.'}
                            </div>
                        </div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', padding: '0 20px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '200px', borderBottom: '1px solid var(--color-text-primary)' }}></div>
                                <div style={{ fontSize: '11px', fontWeight: 900, marginTop: '8px', color: 'var(--color-text-muted)' }}>STUDENT SIGNATURE</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '200px', borderBottom: '1px solid var(--color-text-primary)', fontWeight: 900, paddingBottom: '4px' }}>Coach Masum</div>
                                <div style={{ fontSize: '11px', fontWeight: 900, marginTop: '8px', color: 'var(--color-text-muted)' }}>HEAD TEACHER</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print Styles */}
                <style>
                    {`
                    @media print {
                        .no-print { display: none !important; }
                        .only-print { display: block !important; }
                        body { background: white !important; font-family: 'Inter', sans-serif; }
                        .modal-overlay { position: relative !important; background: white !important; padding: 0 !important; }
                        .modal-container { width: 100% !important; height: auto !important; position: relative !important; background: white !important; overflow: visible !important; }
                        .report-card-print-area { padding: 40px !important; color: black !important; }
                        .report-card-border { border: 4px double black !important; color: black !important; background: transparent !important; border-radius: 0 !important; }
                        h1, h2, h3, h4, div, td, th { color: black !important; }
                    }
                    .only-print { display: none; }
                    `}
                </style>
            </div>
        </div>
    );
}
