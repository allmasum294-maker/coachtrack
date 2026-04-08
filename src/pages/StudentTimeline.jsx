import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
    Clock, User, Calendar, FileText, BookOpen, 
    CheckSquare, Filter, XCircle, AlertTriangle,
    History, Search, Layers, ChevronRight, Activity
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { batchService } from '../services/batchService';

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
            const [studentSnap, activeBatches, attSnap, examSnap, sessionSnap, hwSnap] = await Promise.all([
                getDocs(query(
                    collection(db, 'students'), 
                    where('teacherId', '==', uid),
                    where('status', '==', 'enrolled')
                )),
                batchService.getBatches(uid, true),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setBatches(activeBatches);
            setAttendance(attSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setSessionLogs(sessionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading chronological metadata:', err);
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

    const filteredStudents = useMemo(() => {
        let list = students.filter(s => s.status === 'enrolled');
        if (filterBatch) {
            list = list.filter(s => s.batchIds?.includes(filterBatch));
        }
        return list;
    }, [students, filterBatch]);

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
        }
    }, [filterBatch, filteredStudents, selectedStudentId]);

    const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

    const events = useMemo(() => {
        if (!selectedStudent) return [];
        const evts = [];

        // Profile initiation
        if (selectedStudent.createdAt) {
            const d = toDate(selectedStudent.createdAt);
            if (isInDateRange(d)) {
                evts.push({
                    date: d,
                    type: 'profile',
                    icon: <User size={16} />,
                    color: '#6366f1',
                    title: 'Account Initialized',
                    detail: `${selectedStudent.name} was successfully integrated into the system.`,
                    category: 'Administrative'
                });
            }
        }

        // Attendance records
        attendance.forEach(a => {
            if (!selectedStudent.batchIds?.includes(a.batchId)) return;
            const rec = (a.records || []).find(r => r.studentId === selectedStudent.id);
            if (!rec) return;
            const d = toDate(a.date);
            if (!isInDateRange(d)) return;
            const batchName = batches.find(b => b.id === a.batchId)?.name || 'Standard Batch';
            
            let statusColor = '#10b981'; // Present
            if (rec.status === 'late') statusColor = '#f59e0b'; // Late
            if (rec.status === 'absent') statusColor = '#ef4444'; // Absent

            evts.push({
                date: d,
                type: 'attendance',
                icon: <Calendar size={16} />,
                color: statusColor,
                title: `Session Presence: ${rec.status.toUpperCase()}`,
                detail: `Active participation record in ${batchName}.`,
                category: 'Engagement'
            });
        });

        // Exam evaluation logs
        exams.forEach(e => {
            if (!selectedStudent.batchIds?.includes(e.batchId)) return;
            const d = toDate(e.date);
            if (!isInDateRange(d)) return;
            const s = (e.scores || []).find(sc => sc.studentId === selectedStudent.id);
            const detail = s
                ? `Secured ${s.marksObtained}/${e.totalMarks} points (${e.totalMarks > 0 ? Math.round((s.marksObtained / e.totalMarks) * 100) : 0}%)`
                : 'Performance data not yet recorded for this assessment.';
            evts.push({
                date: d,
                type: 'exam',
                icon: <FileText size={16} />,
                color: '#8b5cf6',
                title: `Assessment: ${e.title}`,
                detail,
                category: 'Mastery'
            });
        });

        // Curricula assigned
        sessionLogs.forEach(l => {
            if (!selectedStudent.batchIds?.includes(l.batchId)) return;
            const d = toDate(l.date);
            if (!isInDateRange(d)) return;
            if (l.homeworkAssigned) {
                evts.push({
                    date: d,
                    type: 'homework_assigned',
                    icon: <Layers size={16} />,
                    color: '#f59e0b',
                    title: 'Task Assignment Issued',
                    detail: l.homeworkAssigned.substring(0, 100) + (l.homeworkAssigned.length > 100 ? '...' : ''),
                    category: 'Curriculum'
                });
            }
        });

        // Workload completion tracking
        homeworks.forEach(hw => {
            if (!selectedStudent.batchIds?.includes(hw.batchId)) return;
            const dueDate = hw.dueDate ? toDate(hw.dueDate) : null;
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
                        color: '#10b981',
                        title: `Task Finalized: ${hw.title}`,
                        detail: 'Diligence verified: Submitted within schedule.',
                        category: 'Curriculum'
                    });
                } else if (sub.status === 'late') {
                    evts.push({
                        date: d,
                        type: 'homework_completed',
                        icon: <AlertTriangle size={16} />,
                        color: '#f59e0b',
                        title: `Late Submission: ${hw.title}`,
                        detail: 'Task finalized beyond standard deadline.',
                        category: 'Curriculum'
                    });
                } else if (sub.status === 'not_submitted' && dueDate && dueDate < new Date()) {
                    evts.push({
                        date: dueDate,
                        type: 'homework_missing',
                        icon: <XCircle size={16} />,
                        color: '#ef4444',
                        title: `Compliance Deficit: ${hw.title}`,
                        detail: `Deadline exceeded on ${format(dueDate, 'MMM d')}. Missing documentation.`,
                        category: 'Risk'
                    });
                }
            } else if (completedByOld) {
                const d = dueDate || toDate(hw.createdAt);
                if (isInDateRange(d)) {
                    evts.push({
                        date: d,
                        type: 'homework_completed',
                        icon: <CheckSquare size={16} />,
                        color: '#10b981',
                        title: `Task Finalized: ${hw.title}`,
                        detail: 'Completed.',
                        category: 'Curriculum'
                    });
                }
            } else if (dueDate && dueDate < new Date()) {
                if (isInDateRange(dueDate)) {
                    evts.push({
                        date: dueDate,
                        type: 'homework_missing',
                        icon: <XCircle size={16} />,
                        color: '#ef4444',
                        title: `Compliance Deficit: ${hw.title}`,
                        detail: `Deadline exceeded on ${format(dueDate, 'MMM d')}. Missing documentation.`,
                        category: 'Risk'
                    });
                }
            }
        });

        const filteredEvts = filterType === 'all'
            ? evts
            : evts.filter(e => {
                if (filterType === 'attendance') return e.type === 'attendance';
                if (filterType === 'exam') return e.type === 'exam';
                if (filterType === 'homework') return e.type.startsWith('homework');
                return true;
            });

        return filteredEvts.sort((a, b) => b.date - a.date);
    }, [selectedStudent, attendance, exams, sessionLogs, homeworks, batches, filterType, dateFrom, dateTo]);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Chronicle Ledger</h1>
                    <p className="page-subtitle">A linear audit of student interaction and academic progression</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="glass-card" style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 800 }}>
                        <Activity size={16} /> DATA SYNCHRONIZED
                    </div>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Source Batch</label>
                        <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ height: '44px', fontWeight: 700 }}>
                            <option value="">Across All Archives</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Identify Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} style={{ height: '44px', fontWeight: 700 }}>
                            <option value="">Locate Profile...</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Event Filter</label>
                        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ height: '44px', fontWeight: 700 }}>
                            <option value="all">Comprehensive Audit</option>
                            <option value="attendance">Presence Records</option>
                            <option value="exam">Academic Mastery</option>
                            <option value="homework">Workload Compliance</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Date From</label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ height: '44px' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Date To</label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ height: '44px' }} />
                    </div>
                </div>
                {(dateFrom || dateTo) && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontWeight: 800 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                            RESET TEMPORAL FILTER
                        </button>
                    </div>
                )}
            </div>

            {selectedStudent ? (
                <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
                    {events.length > 0 ? (
                        <div style={{ position: 'relative', paddingLeft: '40px' }}>
                            {/* Visual Timeline Spine */}
                            <div style={{
                                position: 'absolute', left: '16px', top: 0, bottom: 0, width: '4px',
                                background: 'linear-gradient(to bottom, var(--color-primary), var(--color-accent), transparent)',
                                borderRadius: '2px', opacity: 0.2
                            }} />

                            {events.map((evt, i) => (
                                <div key={i} className="animate-fade-in-up" style={{
                                    position: 'relative',
                                    marginBottom: '32px',
                                    animationDelay: `${i * 0.05}s`
                                }}>
                                    {/* Event Node */}
                                    <div style={{
                                        position: 'absolute',
                                        left: '-32px',
                                        top: '12px',
                                        width: '20px', height: '20px',
                                        borderRadius: '50%',
                                        background: evt.color,
                                        border: '4px solid var(--color-bg-main)',
                                        boxShadow: `0 0 15px ${evt.color}60`,
                                        zIndex: 1,
                                    }} />

                                    <div className="glass-card hover-lift" style={{ padding: '24px', borderLeft: `6px solid ${evt.color}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ 
                                                    width: '36px', height: '36px', borderRadius: '10px', 
                                                    background: `${evt.color}15`, color: evt.color,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {evt.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{evt.title}</div>
                                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{evt.category} Analysis</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                                                    <Clock size={12} />
                                                    {format(evt.date, 'MMM d, yyyy')}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
                                            {evt.detail}
                                        </div>
                                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button style={{ background: 'transparent', border: 'none', color: evt.color, fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                                VIEW METRICS <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: '80px 24px', textAlign: 'center' }}>
                            <History size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.3, marginBottom: '20px' }} />
                            <h2 style={{ fontSize: '22px', fontWeight: 900 }}>Empty Historical Buffer</h2>
                            <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>No chronological events match the current temporal range or filter criteria for this profile.</p>
                        </div>
                    )
                    }
                </div>
            ) : (
                <div className="glass-panel" style={{ padding: '100px 24px', textAlign: 'center' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '40px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                        <Search size={54} style={{ color: 'var(--color-border)', opacity: 0.5 }} />
                    </div>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px' }}>Select Ledger Account</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', margin: '0 auto' }}>Choose a student profile from the index to stream their historical activity ledger directly into the terminal.</p>
                </div>
            )}
        </div>
    );
}
