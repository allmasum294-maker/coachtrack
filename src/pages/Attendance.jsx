import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { ClipboardCheck, Check, X as XIcon, Clock, Save } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Attendance() {
    const { currentUser } = useAuth();
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [records, setRecords] = useState({});
    const [existingAttendance, setExistingAttendance] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('mark');

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    useEffect(() => {
        if (selectedBatch && selectedDate) loadAttendanceForDate();
    }, [selectedBatch, selectedDate]);

    async function loadData() {
        try {
            const [batchSnap, studentSnap] = await Promise.all([
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', currentUser.uid))),
            ]);
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadAttendanceForDate() {
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'attendance'),
                    where('teacherId', '==', currentUser.uid),
                    where('batchId', '==', selectedBatch),
                )
            );
            const existing = snap.docs.find((d) => {
                const data = d.data();
                const dateVal = data.date?.toDate ? format(data.date.toDate(), 'yyyy-MM-dd') : data.date;
                return dateVal === selectedDate;
            });

            if (existing) {
                setExistingAttendance({ id: existing.id, ...existing.data() });
                const recs = {};
                (existing.data().records || []).forEach((r) => {
                    recs[r.studentId] = r.status;
                });
                setRecords(recs);
            } else {
                setExistingAttendance(null);
                const batchStudents = students.filter((s) =>
                    (s.batchIds || []).includes(selectedBatch)
                );
                const recs = {};
                batchStudents.forEach((s) => { recs[s.id] = 'present'; });
                setRecords(recs);
            }

            // Load history
            const allAttendance = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setHistory(allAttendance.sort((a, b) => {
                const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return db2 - da;
            }));
        } catch (err) {
            console.error('Error loading attendance:', err);
        }
    }

    function getBatchStudents() {
        return students.filter((s) => (s.batchIds || []).includes(selectedBatch));
    }

    function setStatus(studentId, status) {
        setRecords((prev) => ({ ...prev, [studentId]: status }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const recordsArray = Object.entries(records).map(([studentId, status]) => ({
                studentId, status,
            }));

            const data = {
                batchId: selectedBatch,
                teacherId: currentUser.uid,
                date: Timestamp.fromDate(new Date(selectedDate)),
                records: recordsArray,
            };

            if (existingAttendance) {
                await updateDoc(doc(db, 'attendance', existingAttendance.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'attendance'), data);
            }

            toast.success('Attendance saved!');
            loadAttendanceForDate();
        } catch (err) {
            console.error('Error saving attendance:', err);
            toast.error('Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    }

    const batchStudents = getBatchStudents();
    const presentCount = Object.values(records).filter((s) => s === 'present').length;
    const absentCount = Object.values(records).filter((s) => s === 'absent').length;
    const lateCount = Object.values(records).filter((s) => s === 'late').length;

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance</h1>
                    <p className="page-subtitle">Mark and review batch attendance</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${tab === 'mark' ? 'active' : ''}`} onClick={() => setTab('mark')}>Mark Attendance</button>
                <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <select className="form-select" style={{ width: 220 }} value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}>
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <input className="form-input" type="date" style={{ width: 180 }} value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)} />
            </div>

            {tab === 'mark' && (
                <>
                    {!selectedBatch ? (
                        <div className="card"><div className="empty-state">
                            <ClipboardCheck size={48} className="empty-state-icon" />
                            <div className="empty-state-title">Select a batch</div>
                            <div className="empty-state-text">Choose a batch and date to mark attendance.</div>
                        </div></div>
                    ) : batchStudents.length === 0 ? (
                        <div className="card"><div className="empty-state">
                            <ClipboardCheck size={48} className="empty-state-icon" />
                            <div className="empty-state-title">No students in this batch</div>
                            <div className="empty-state-text">Add students to this batch first.</div>
                        </div></div>
                    ) : (
                        <>
                            {/* Summary */}
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                <span className="badge badge-green">Present: {presentCount}</span>
                                <span className="badge badge-red">Absent: {absentCount}</span>
                                <span className="badge badge-gold">Late: {lateCount}</span>
                                {existingAttendance && <span className="badge badge-blue">Previously saved</span>}
                            </div>

                            <div className="attendance-grid">
                                {batchStudents.map((student) => (
                                    <div key={student.id} className="attendance-student-row">
                                        <div className="attendance-student-info">
                                            <div className="attendance-student-avatar">
                                                {student.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{student.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                    Class {student.grade}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="attendance-status-buttons">
                                            <button
                                                className={`attendance-status-btn ${records[student.id] === 'present' ? 'present' : ''}`}
                                                onClick={() => setStatus(student.id, 'present')}
                                            >
                                                <Check size={14} /> Present
                                            </button>
                                            <button
                                                className={`attendance-status-btn ${records[student.id] === 'absent' ? 'absent' : ''}`}
                                                onClick={() => setStatus(student.id, 'absent')}
                                            >
                                                <XIcon size={14} /> Absent
                                            </button>
                                            <button
                                                className={`attendance-status-btn ${records[student.id] === 'late' ? 'late' : ''}`}
                                                onClick={() => setStatus(student.id, 'late')}
                                            >
                                                <Clock size={14} /> Late
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                                    <Save size={18} /> {saving ? 'Saving...' : 'Save Attendance'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {tab === 'history' && (
                <div>
                    {history.length === 0 ? (
                        <div className="card"><div className="empty-state">
                            <ClipboardCheck size={48} className="empty-state-icon" />
                            <div className="empty-state-title">No attendance records</div>
                            <div className="empty-state-text">Attendance records will appear here once you start marking.</div>
                        </div></div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Present</th>
                                        <th>Absent</th>
                                        <th>Late</th>
                                        <th>Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((att) => {
                                        const dateVal = att.date?.toDate ? att.date.toDate() : new Date(att.date);
                                        const p = (att.records || []).filter((r) => r.status === 'present').length;
                                        const a = (att.records || []).filter((r) => r.status === 'absent').length;
                                        const l = (att.records || []).filter((r) => r.status === 'late').length;
                                        const total = att.records?.length || 0;
                                        const rate = total > 0 ? Math.round((p / total) * 100) : 0;
                                        return (
                                            <tr key={att.id}>
                                                <td>{format(dateVal, 'MMM d, yyyy')}</td>
                                                <td><span className="badge badge-green">{p}</span></td>
                                                <td><span className="badge badge-red">{a}</span></td>
                                                <td><span className="badge badge-gold">{l}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                        <div className="progress-bar" style={{ width: 80 }}>
                                                            <div className="progress-bar-fill" style={{ width: `${rate}%` }} />
                                                        </div>
                                                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{rate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
