import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Clock, User, Calendar, FileText, BookOpen, CheckSquare, Filter, XCircle, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function StudentTimeline() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [filterBatch, setFilterBatch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [studentSnap, batchSnap, attSnap, examSnap, sessionSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setSessionLogs(sessionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    function toDate(val) {
        if (!val) return new Date(0);
        return val.toDate ? val.toDate() : new Date(val);
    }

    function isInDateRange(d) {
        if (!dateFrom && !dateTo) return true;
        if (dateFrom && d < startOfDay(new Date(dateFrom))) return false;
        if (dateTo && d > endOfDay(new Date(dateTo))) return false;
        return true;
    }

    // Batch-filtered students for the dropdown
    const filteredStudents = filterBatch
        ? students.filter(s => s.batchIds?.includes(filterBatch))
        : students;

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [filterBatch, filteredStudents, selectedStudentId]);

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    const events = useMemo(() => {
        if (!selectedStudent) return [];
        const evts = [];

        // Profile creation
        if (selectedStudent.createdAt) {
            const d = toDate(selectedStudent.createdAt);
            if (isInDateRange(d)) {
                evts.push({
                    date: d,
                    type: 'profile',
                    icon: <User size={16} />,
                    color: 'var(--color-primary)',
                    title: 'Profile Created',
                    detail: `${selectedStudent.name} was added to the system.`,
                });
            }
        }

        // Attendance
        attendance.forEach(a => {
            if (!selectedStudent.batchIds?.includes(a.batchId)) return;
            const rec = (a.records || []).find(r => r.studentId === selectedStudent.id);
            if (!rec) return;
            const d = toDate(a.date);
            if (!isInDateRange(d)) return;
            const batchName = batches.find(b => b.id === a.batchId)?.name || '';
            evts.push({
                date: d,
                type: 'attendance',
                icon: <Calendar size={16} />,
                color: rec.status === 'present' ? 'var(--color-success)' : rec.status === 'late' ? 'var(--color-warning)' : 'var(--color-danger)',
                title: `Attendance: ${rec.status === 'present' ? '✅ Present' : rec.status === 'late' ? '⏰ Late' : '❌ Absent'}`,
                detail: `Class in ${batchName}`,
            });
        });

        // Exams
        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batchId)) return;
            const d = toDate(e.date);
            if (!isInDateRange(d)) return;
            const s = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
            const detail = s
                ? `Scored ${s.marksObtained}/${e.totalMarks} (${e.totalMarks > 0 ? Math.round((s.marksObtained / e.totalMarks) * 100) : 0}%)`
                : 'No score recorded';
            evts.push({
                date: d,
                type: 'exam',
                icon: <FileText size={16} />,
                color: 'var(--color-accent)',
                title: `Exam: ${e.title}`,
                detail,
            });
        });

        // Session Logs (homework assigned)
        sessionLogs.forEach(l => {
            if (!selectedStudent.batchIds?.includes(l.batchId)) return;
            const d = toDate(l.date);
            if (!isInDateRange(d)) return;
            if (l.homeworkAssigned) {
                evts.push({
                    date: d,
                    type: 'homework_assigned',
                    icon: <BookOpen size={16} />,
                    color: 'var(--color-warning)',
                    title: 'Homework Assigned',
                    detail: l.homeworkAssigned.substring(0, 80) + (l.homeworkAssigned.length > 80 ? '...' : ''),
                });
            }
        });

        // Homework completion events
        homeworks.forEach(hw => {
            if (!selectedStudent.batchIds?.includes(hw.batchId)) return;
            const dueDate = hw.dueDate ? toDate(hw.dueDate) : null;

            // Check student's submission
            const sub = hw.submissions?.[selectedStudent.id];
            const completedByOld = (hw.completedBy || []).includes(selectedStudent.id);

            if (sub) {
                const d = sub.date ? new Date(sub.date) : (dueDate || toDate(hw.createdAt));
                if (!isInDateRange(d)) return;
                if (sub.status === 'completed') {
                    evts.push({
                        date: d,
                        type: 'homework_completed',
                        icon: <CheckSquare size={16} />,
                        color: 'var(--color-success)',
                        title: `HW Completed: ${hw.title}`,
                        detail: 'Submitted on time',
                    });
                } else if (sub.status === 'late') {
                    evts.push({
                        date: d,
                        type: 'homework_completed',
                        icon: <AlertTriangle size={16} />,
                        color: 'var(--color-warning)',
                        title: `HW Late: ${hw.title}`,
                        detail: 'Submitted late',
                    });
                } else if (sub.status === 'not_submitted' && dueDate && dueDate < new Date()) {
                    evts.push({
                        date: dueDate,
                        type: 'homework_missing',
                        icon: <XCircle size={16} />,
                        color: 'var(--color-danger)',
                        title: `HW Missing: ${hw.title}`,
                        detail: `Due ${format(dueDate, 'MMM d')} — not submitted`,
                    });
                }
            } else if (completedByOld) {
                const d = dueDate || toDate(hw.createdAt);
                if (isInDateRange(d)) {
                    evts.push({
                        date: d,
                        type: 'homework_completed',
                        icon: <CheckSquare size={16} />,
                        color: 'var(--color-success)',
                        title: `HW Completed: ${hw.title}`,
                        detail: 'Completed',
                    });
                }
            } else if (dueDate && dueDate < new Date()) {
                if (isInDateRange(dueDate)) {
                    evts.push({
                        date: dueDate,
                        type: 'homework_missing',
                        icon: <XCircle size={16} />,
                        color: 'var(--color-danger)',
                        title: `HW Not Submitted: ${hw.title}`,
                        detail: `Due ${format(dueDate, 'MMM d')} — not submitted`,
                    });
                }
            }
        });

        // Filter by type
        const filteredEvts = filterType === 'all'
            ? evts
            : evts.filter(e => {
                if (filterType === 'attendance') return e.type === 'attendance';
                if (filterType === 'exam') return e.type === 'exam';
                if (filterType === 'homework') return e.type === 'homework_assigned' || e.type === 'homework_completed' || e.type === 'homework_missing';
                return true;
            });

        // Sort descending
        filteredEvts.sort((a, b) => b.date - a.date);
        return filteredEvts;
    }, [selectedStudent, attendance, exams, sessionLogs, homeworks, batches, filterType, dateFrom, dateTo]);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Student Timeline</h1>
                    <p className="page-subtitle">Chronological view of a student's activity</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 180px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter by Batch</label>
                        <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                            <option value="">All Batches</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Event Type</label>
                        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="all">All Events</option>
                            <option value="attendance">Attendance</option>
                            <option value="exam">Exams</option>
                            <option value="homework">Homework</option>
                        </select>
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> From
                        </label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Filter size={12} /> To
                        </label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>
                {(dateFrom || dateTo) && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 'var(--font-size-xs)' }} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                            Clear Date Filter
                        </button>
                    </div>
                )}
            </div>

            {selectedStudent ? (
                events.length > 0 ? (
                    <div style={{ position: 'relative', paddingLeft: 'var(--space-8)' }}>
                        {/* Vertical timeline line */}
                        <div style={{
                            position: 'absolute', left: '20px', top: 0, bottom: 0, width: '2px',
                            background: 'var(--color-border)'
                        }} />

                        {events.map((evt, i) => (
                            <div key={i} style={{
                                position: 'relative',
                                marginBottom: 'var(--space-4)',
                            }}>
                                {/* Timeline dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: '-22px',
                                    top: 'var(--space-3)',
                                    width: '14px', height: '14px',
                                    borderRadius: 'var(--radius-full)',
                                    background: evt.color,
                                    border: '3px solid var(--color-bg-app)',
                                    zIndex: 1,
                                }} />

                                <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                        <span style={{ color: evt.color }}>{evt.icon}</span>
                                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{evt.title}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            <Clock size={12} style={{ marginRight: '4px' }} />
                                            {format(evt.date, 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                        {evt.detail}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card">
                        <div className="empty-state">
                            <Clock size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }} />
                            <div className="empty-state-title">No events found</div>
                            <div className="empty-state-text">Try adjusting the filters or date range.</div>
                        </div>
                    </div>
                )
            ) : (
                <div className="card">
                    <div className="empty-state">
                        <User size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }} />
                        <div className="empty-state-title">No Student Selected</div>
                        <div className="empty-state-text">Choose a student from the filters above to view their timeline.</div>
                    </div>
                </div>
            )}
        </div>
    );
}
