import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Download, FileSpreadsheet, FileText, Calendar, ClipboardCheck, BookOpen, BarChart3 } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const EXPORT_TYPES = [
    { id: 'attendance', icon: ClipboardCheck, title: 'Attendance Records', desc: 'Export student attendance data with present/absent/late status' },
    { id: 'lessons', icon: BookOpen, title: 'Lessons Covered', desc: 'Export syllabus coverage and topic completion data' },
    { id: 'exams', icon: BarChart3, title: 'Exam Results', desc: 'Export exam scores, averages, and performance data' },
    { id: 'students', icon: FileText, title: 'Student Data', desc: 'Export student profiles and batch assignments' },
];

export default function Export() {
    const { currentUser } = useAuth();
    const [selectedType, setSelectedType] = useState('attendance');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exportFormat, setExportFormat] = useState('csv');
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (currentUser) loadBatches();
    }, [currentUser]);

    async function loadBatches() {
        try {
            const snap = await getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid)));
            setBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function isInDateRange(dateVal) {
        if (!dateFrom && !dateTo) return true;
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (dateFrom && !dateTo) return d >= new Date(dateFrom);
        if (!dateFrom && dateTo) return d <= new Date(dateTo);
        return isWithinInterval(d, { start: new Date(dateFrom), end: new Date(dateTo) });
    }

    async function handleExport() {
        setExporting(true);
        try {
            const uid = currentUser.uid;
            let rows = [];
            let title = '';

            if (selectedType === 'attendance') {
                title = 'Attendance Records';
                const [attSnap, studentSnap] = await Promise.all([
                    getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                    getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                ]);
                const studentMap = {};
                studentSnap.docs.forEach((d) => { studentMap[d.id] = d.data().name; });
                const batchMap = {};
                batches.forEach((b) => { batchMap[b.id] = b.name; });

                attSnap.docs.forEach((d) => {
                    const data = d.data();
                    if (selectedBatch && data.batchId !== selectedBatch) return;
                    const dateVal = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    if (!isInDateRange(dateVal)) return;
                    (data.records || []).forEach((r) => {
                        rows.push({
                            Date: format(dateVal, 'yyyy-MM-dd'),
                            Batch: batchMap[data.batchId] || data.batchId,
                            Student: studentMap[r.studentId] || r.studentId,
                            Status: r.status,
                        });
                    });
                });
            } else if (selectedType === 'lessons') {
                title = 'Lessons Covered';
                const lessonSnap = await getDocs(query(collection(db, 'lessons'), where('teacherId', '==', uid)));
                const batchMap = {};
                batches.forEach((b) => { batchMap[b.id] = b.name; });

                lessonSnap.docs.forEach((d) => {
                    const data = d.data();
                    if (selectedBatch && data.batchId !== selectedBatch) return;
                    rows.push({
                        Batch: batchMap[data.batchId] || data.batchId,
                        'Topic #': data.order || '',
                        Title: data.title,
                        Status: data.status,
                        'Covered On': data.coveredOn || '—',
                        Description: data.description || '',
                    });
                });
            } else if (selectedType === 'exams') {
                title = 'Exam Results';
                const [examSnap, studentSnap] = await Promise.all([
                    getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                    getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                ]);
                const studentMap = {};
                studentSnap.docs.forEach((d) => { studentMap[d.id] = d.data().name; });
                const batchMap = {};
                batches.forEach((b) => { batchMap[b.id] = b.name; });

                examSnap.docs.forEach((d) => {
                    const data = d.data();
                    if (selectedBatch && data.batchId !== selectedBatch) return;
                    const dateVal = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    if (!isInDateRange(dateVal)) return;
                    (data.scores || []).forEach((s) => {
                        rows.push({
                            Exam: data.title,
                            Date: format(dateVal, 'yyyy-MM-dd'),
                            Batch: batchMap[data.batchId] || data.batchId,
                            Student: studentMap[s.studentId] || s.studentId,
                            'Marks Obtained': s.marksObtained,
                            'Total Marks': data.totalMarks,
                            'Percentage': data.totalMarks ? Math.round((s.marksObtained / data.totalMarks) * 100) + '%' : '',
                            Remarks: s.remarks || '',
                        });
                    });
                });
            } else if (selectedType === 'students') {
                title = 'Student Data';
                const studentSnap = await getDocs(query(collection(db, 'students'), where('teacherId', '==', uid)));
                const batchMap = {};
                batches.forEach((b) => { batchMap[b.id] = b.name; });

                studentSnap.docs.forEach((d) => {
                    const data = d.data();
                    if (selectedBatch && !(data.batchIds || []).includes(selectedBatch)) return;
                    rows.push({
                        Name: data.name,
                        Email: data.email || '',
                        Phone: data.phone || '',
                        Grade: data.grade || '',
                        School: data.school || '',
                        Guardian: data.guardianName || '',
                        'Guardian Phone': data.guardianPhone || '',
                        Batches: (data.batchIds || []).map((id) => batchMap[id] || id).join(', '),
                        Address: data.address || '',
                        Notes: data.notes || '',
                    });
                });
            }

            if (rows.length === 0) {
                toast.error('No data to export with the current filters.');
                setExporting(false);
                return;
            }

            if (exportFormat === 'csv') {
                const csv = Papa.unparse(rows);
                downloadFile(csv, `${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`, 'text/csv');
            } else {
                const pdfDoc = new jsPDF();
                pdfDoc.setFontSize(16);
                pdfDoc.text(title, 14, 20);
                pdfDoc.setFontSize(10);
                pdfDoc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 28);
                if (selectedBatch) {
                    const batchName = batches.find((b) => b.id === selectedBatch)?.name || '';
                    pdfDoc.text(`Batch: ${batchName}`, 14, 34);
                }
                const cols = Object.keys(rows[0]);
                const tableRows = rows.map((r) => cols.map((c) => String(r[c])));
                autoTable(pdfDoc, {
                    head: [cols],
                    body: tableRows,
                    startY: selectedBatch ? 40 : 34,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [20, 184, 166] },
                });
                pdfDoc.save(`${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
            }

            toast.success(`Exported ${rows.length} records as ${exportFormat.toUpperCase()}!`);
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Export failed.');
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
                    <h1 className="page-title">Export Data</h1>
                    <p className="page-subtitle">Download your coaching data as CSV or PDF</p>
                </div>
            </div>

            {/* Export Type Selection */}
            <div className="export-options">
                {EXPORT_TYPES.map((type) => (
                    <div key={type.id} className={`export-option-card ${selectedType === type.id ? 'selected' : ''}`} onClick={() => setSelectedType(type.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <type.icon size={20} style={{ color: selectedType === type.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                            <h3>{type.title}</h3>
                        </div>
                        <p>{type.desc}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Filters</h3>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ minWidth: 200 }}>
                        <label className="form-label">Batch</label>
                        <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                            <option value="">All Batches</option>
                            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                    </div>
                    {(selectedType === 'attendance' || selectedType === 'exams') && (
                        <>
                            <div className="form-group" style={{ minWidth: 160 }}>
                                <label className="form-label">From Date</label>
                                <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ minWidth: 160 }}>
                                <label className="form-label">To Date</label>
                                <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                            </div>
                        </>
                    )}
                    <div className="form-group">
                        <label className="form-label">Format</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button className={`btn btn-sm ${exportFormat === 'csv' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setExportFormat('csv')}>
                                <FileSpreadsheet size={14} /> CSV
                            </button>
                            <button className={`btn btn-sm ${exportFormat === 'pdf' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setExportFormat('pdf')}>
                                <FileText size={14} /> PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Button */}
            <button className="btn btn-gold btn-lg" onClick={handleExport} disabled={exporting} style={{ width: '100%', maxWidth: 400 }}>
                <Download size={20} /> {exporting ? 'Exporting...' : `Export ${EXPORT_TYPES.find((t) => t.id === selectedType)?.title} as ${exportFormat.toUpperCase()}`}
            </button>
        </div>
    );
}
