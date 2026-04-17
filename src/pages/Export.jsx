import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';
import { examService } from '../services/examService';
import { Download, FileSpreadsheet, FileText, ClipboardCheck, BookOpen, BarChart3, UserCheck, Filter, ArrowRight } from 'lucide-react';
import { format, isWithinInterval } from 'date-fns';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const EXPORT_TYPES = [
    { id: 'attendance', icon: ClipboardCheck, title: 'Attendance History', desc: 'Present/Absent/Late records for students' },
    { id: 'lessons', icon: BookOpen, title: 'Lesson Progress', desc: 'Which lessons are finished and when they were taught' },
    { id: 'exams', icon: BarChart3, title: 'Exam Scores', desc: 'Student marks and how they are doing in tests' },
    { id: 'students', icon: UserCheck, title: 'Student List', desc: 'User accounts and which batches they belong to' },
];

export default function Export() {
    const { userProfile } = useAuth();
    const [selectedType, setSelectedType] = useState('attendance');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exportFormat, setExportFormat] = useState('csv');
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (userProfile?.id) loadBatches();
    }, [userProfile]);

    async function loadBatches() {
        try {
            // Only export data for active batches by default
            const activeBatches = await batchService.getBatches(userProfile.id);
            setBatches(activeBatches);
        } catch (err) { 
            console.error('Error loading batches:', err); 
        } finally { 
            setLoading(false); 
        }
    }

    function isInDateRange(dateVal) {
        if (!dateFrom && !dateTo) return true;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (dateFrom && !dateTo) return d >= new Date(dateFrom);
        if (!dateFrom && dateTo) return d <= new Date(dateTo);
        try {
            return isWithinInterval(d, { start: new Date(dateFrom), end: new Date(dateTo) });
        } catch (e) { return true; }
    }

    async function handleExport() {
        setExporting(true);
        const toastId = toast.loading('Preparing export...');
        try {
            const uid = userProfile.id;
            let rows = [];
            let title = '';

            // Strictly filter for enrolled students for all clinical data exports
            const enrolledStudents = await studentService.getStudentsByTeacher(uid);
            const studentMap = {};
            const enrolledStudentIds = new Set();
            enrolledStudents.forEach((s) => { 
                studentMap[s.id] = s.name; 
                enrolledStudentIds.add(s.id);
            });

            const batchMap = {};
            batches.forEach((b) => { batchMap[b.id] = b.name; });

            if (selectedType === 'attendance') {
                title = 'Attendance Records';
                const attendance = await attendanceService.getAttendanceByTeacher(uid);
                
                attendance.forEach((data) => {
                    if (selectedBatch && data.batch_id !== selectedBatch) return;
                    const dateVal = new Date(data.date);
                    if (!isInDateRange(dateVal)) return;

                    (data.records || []).forEach((r) => {
                        // Only export records for currently enrolled students
                        if (!enrolledStudentIds.has(r.studentId)) return;
                        
                        rows.push({
                            Date: format(dateVal, 'yyyy-MM-dd'),
                            Batch: batchMap[data.batch_id] || data.batch_id,
                            Student: studentMap[r.studentId] || r.studentId,
                            Status: r.status,
                        });
                    });
                });
            } else if (selectedType === 'lessons') {
                title = 'Syllabus Coverage';
                const { data: lessons, error } = await supabase
                    .from('lessons')
                    .select('*')
                    .eq('teacher_id', uid);

                if (error) throw error;

                lessons.forEach((data) => {
                    if (selectedBatch && data.batch_id !== selectedBatch) return;
                    rows.push({
                        Batch: batchMap[data.batch_id] || data.batch_id,
                        'Topic #': data.order || '',
                        Title: data.title,
                        Status: data.status,
                        'Covered On': data.covered_on || '—',
                        Description: data.description || '',
                    });
                });
            } else if (selectedType === 'exams') {
                title = 'Exam Performance';
                const exams = await examService.getExams(uid);

                exams.forEach((data) => {
                    if (selectedBatch && data.batch_id !== selectedBatch) return;
                    const dateVal = new Date(data.date);
                    if (!isInDateRange(dateVal)) return;

                    (data.scores || []).forEach((s) => {
                        // Only include enrolled students in the export
                        if (!enrolledStudentIds.has(s.studentId)) return;

                        rows.push({
                            Exam: data.title,
                            Date: format(dateVal, 'yyyy-MM-dd'),
                            Batch: batchMap[data.batch_id] || data.batch_id,
                            Student: studentMap[s.studentId] || s.studentId,
                            'Marks Obtained': s.marksObtained,
                            'Total Marks': data.totalMarks,
                            'Percentage': data.totalMarks ? Math.round((s.marksObtained / data.totalMarks) * 100) + '%' : '',
                            Remarks: s.remarks || '',
                        });
                    });
                });
            } else if (selectedType === 'students') {
                title = 'Enrolled Students';
                enrolledStudents.forEach((data) => {
                    if (selectedBatch && !(data.batchIds || []).includes(selectedBatch)) return;
                    rows.push({
                        'Student ID': data.student_id || '',
                        Name: data.name,
                        Grade: data.grade || '',
                        School: data.school || '',
                        Email: data.email || '',
                        Phone: data.phone || '',
                        Guardian: data.guardian_name || '',
                        'Guardian Phone': data.guardian_phone || '',
                        Batches: (data.batchIds || []).map((id) => batchMap[id] || id).join(', '),
                    });
                });
            }

            if (rows.length === 0) {
                toast.error('No matching records found for export.', { id: toastId });
                setExporting(false);
                return;
            }

            if (exportFormat === 'csv') {
                const csv = Papa.unparse(rows);
                downloadFile(csv, `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`, 'text/csv');
            } else {
                const pdfDoc = new jsPDF();
                pdfDoc.setFontSize(22);
                pdfDoc.setTextColor(20, 184, 166);
                pdfDoc.text(title, 14, 22);
                
                pdfDoc.setFontSize(10);
                pdfDoc.setTextColor(100, 116, 139);
                pdfDoc.text(`Generated on ${format(new Date(), 'PPP p')}`, 14, 30);
                
                if (selectedBatch) {
                    const batchName = batches.find((b) => b.id === selectedBatch)?.name || '';
                    pdfDoc.text(`Filtering for Batch: ${batchName}`, 14, 36);
                }

                const cols = Object.keys(rows[0]);
                const tableRows = rows.map((r) => cols.map((c) => String(r[c] || '')));
                autoTable(pdfDoc, {
                    head: [cols],
                    body: tableRows,
                    startY: 42,
                    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
                    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });
                pdfDoc.save(`${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
            }

            toast.success(`${title} exported successfully!`, { id: toastId });
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Failed to generate export.', { id: toastId });
        } finally {
            setExporting(false);
        }
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Download Reports</h1>
                    <p className="page-subtitle">Save your records to your computer as PDF or CSV files</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-8)', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                        {EXPORT_TYPES.map((type) => (
                            <div 
                                key={type.id} 
                                className={`glass-card ${selectedType === type.id ? 'selected' : ''}`} 
                                onClick={() => setSelectedType(type.id)}
                                style={{ 
                                    cursor: 'pointer',
                                    padding: 'var(--space-5)',
                                    transition: 'all 0.3s ease',
                                    border: selectedType === type.id ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.05)',
                                    background: selectedType === type.id ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}
                            >
                                <div style={{ 
                                    width: '48px', 
                                    height: '48px', 
                                    borderRadius: '12px', 
                                    background: selectedType === type.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                    color: selectedType === type.id ? 'white' : 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <type.icon size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>{type.title}</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{type.desc}</p>
                                </div>
                                {selectedType === type.id && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                                        <ArrowRight size={18} style={{ color: 'var(--color-primary)' }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: 'var(--space-6)', position: 'sticky', top: 'var(--space-8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-6)', color: 'var(--color-primary)' }}>
                        <Filter size={18} />
                        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Select Batch</label>
                            <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                                <option value="">All Batches</option>
                                {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                            </select>
                        </div>

                        {(selectedType === 'attendance' || selectedType === 'exams') && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}>From Date</label>
                                    <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 800 }}>To Date</label>
                                    <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                            </div>
                        )}

                        <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Save As</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                <button 
                                    className={`btn btn-sm ${exportFormat === 'csv' ? 'btn-primary' : 'btn-secondary'}`} 
                                    onClick={() => setExportFormat('csv')}
                                    style={{ borderRadius: '10px', height: '42px', border: 'none' }}
                                >
                                    <FileSpreadsheet size={16} /> CSV
                                </button>
                                <button 
                                    className={`btn btn-sm ${exportFormat === 'pdf' ? 'btn-primary' : 'btn-secondary'}`} 
                                    onClick={() => setExportFormat('pdf')}
                                    style={{ borderRadius: '10px', height: '42px', border: 'none' }}
                                >
                                    <FileText size={16} /> PDF
                                </button>
                            </div>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: 'var(--space-4) 0' }} />

                        <button 
                            className="btn btn-primary" 
                            onClick={handleExport} 
                            disabled={exporting} 
                            style={{ 
                                width: '100%', 
                                height: '52px', 
                                fontSize: '15px', 
                                fontWeight: 800,
                                boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.25)'
                            }}
                        >
                            <Download size={18} /> {exporting ? 'Saving...' : 'Download Now'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
