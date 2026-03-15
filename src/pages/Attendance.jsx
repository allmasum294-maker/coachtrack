import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import React from 'react';
import { db } from '../services/firebase';
import { ClipboardCheck, Check, X as XIcon, Clock, Save, Eye, Trash2, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [expandedId, setExpandedId] = useState(null);

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
        const enrolled = students.filter((s) => (s.batchIds || []).includes(selectedBatch));
        if (existingAttendance && existingAttendance.records) {
            const historicalIds = existingAttendance.records.map((r) => r.studentId);
            const historicalStudents = students.filter(
                (s) => historicalIds.includes(s.id) && !enrolled.some((e) => e.id === s.id)
            );
            return [...enrolled, ...historicalStudents];
        }
        return enrolled;
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

            // Sync with Class Schedule: Mark corresponding scheduled class as completed
            const schedSnap = await getDocs(
                query(
                    collection(db, 'schedules'),
                    where('teacherId', '==', currentUser.uid),
                    where('batchId', '==', selectedBatch)
                )
            );
            
            const updatePromises = [];
            schedSnap.docs.forEach((d) => {
                const sData = d.data();
                const sDateVal = sData.date?.toDate ? format(sData.date.toDate(), 'yyyy-MM-dd') : sData.date;
                if (sDateVal === selectedDate && sData.status === 'scheduled') {
                    updatePromises.push(updateDoc(doc(db, 'schedules', d.id), { status: 'completed' }));
                }
            });
            await Promise.all(updatePromises);

            toast.success('Attendance saved!');
            loadAttendanceForDate();
        } catch (err) {
            console.error('Error saving attendance:', err);
            toast.error('Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    }
    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this attendance record?')) return;
        try {
            await deleteDoc(doc(db, 'attendance', id));
            toast.success('Record deleted');
            loadAttendanceForDate();
        } catch (err) {
            console.error('Error deleting:', err);
            toast.error('Failed to delete record');
        }
    }

    function handleEdit(att) {
        setSelectedBatch(att.batchId);
        const dateVal = att.date?.toDate ? format(att.date.toDate(), 'yyyy-MM-dd') : att.date;
        setSelectedDate(dateVal);
        setTab('mark');
        toast.info('Loaded record for editing');
    }

    function getStudentName(id) {
        return students.find(s => s.id === id)?.name || 'Unknown Student';
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
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((att) => {
                                        const isExpanded = expandedId === att.id;
                                        const dateVal = att.date?.toDate ? att.date.toDate() : new Date(att.date);
                                        const attRecords = att.records || [];
                                        const p = attRecords.filter((r) => r.status === 'present').length;
                                        const a = attRecords.filter((r) => r.status === 'absent').length;
                                        const l = attRecords.filter((r) => r.status === 'late').length;
                                        const total = attRecords.length;
                                        const rate = total > 0 ? Math.round((p / total) * 100) : 0;
                                        
                                        return (
                                            <React.Fragment key={att.id}>
                                                <tr>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {format(dateVal, 'MMM d, yyyy')}
                                                            {att.batchId !== selectedBatch && (
                                                                <span className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                                    {batches.find(b => b.id === att.batchId)?.name || 'Other'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td><span className="badge badge-green">{p}</span></td>
                                                    <td><span className="badge badge-red">{a}</span></td>
                                                    <td><span className="badge badge-gold">{l}</span></td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                            <div className="progress-bar" style={{ width: 60 }}>
                                                                <div className="progress-bar-fill" style={{ width: `${rate}%` }} />
                                                            </div>
                                                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{rate}%</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                                                            <button 
                                                                className="btn btn-ghost btn-icon" 
                                                                title="View Details"
                                                                onClick={() => setExpandedId(isExpanded ? null : att.id)}
                                                            >
                                                                {isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-icon" 
                                                                title="Edit"
                                                                onClick={() => handleEdit(att)}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-icon" 
                                                                title="Delete"
                                                                onClick={() => handleDelete(att.id)}
                                                            >
                                                                <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="expanded-row">
                                                        <td colSpan="6" style={{ padding: '0' }}>
                                                            <div style={{ 
                                                                padding: 'var(--space-4)', 
                                                                background: 'var(--color-bg-elevated)',
                                                                borderBottom: '1px solid var(--color-border)',
                                                                animation: 'slideDown 0.2s ease-out'
                                                            }}>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
                                                                    <div>
                                                                        <div style={{ color: 'var(--color-teal)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <Check size={12} /> Present ({p})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            {attRecords.filter(r => r.status === 'present').length === 0 ? <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>None</span> : 
                                                                                attRecords.filter(r => r.status === 'present').map(r => (
                                                                                    <span key={r.studentId} style={{ fontSize: '13px' }}>{getStudentName(r.studentId)}</span>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <XIcon size={12} /> Absent ({a})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            {attRecords.filter(r => r.status === 'absent').length === 0 ? <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>None</span> : 
                                                                                attRecords.filter(r => r.status === 'absent').map(r => (
                                                                                    <span key={r.studentId} style={{ fontSize: '13px' }}>{getStudentName(r.studentId)}</span>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <Clock size={12} /> Late ({l})
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            {attRecords.filter(r => r.status === 'late').length === 0 ? <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>None</span> : 
                                                                                attRecords.filter(r => r.status === 'late').map(r => (
                                                                                    <span key={r.studentId} style={{ fontSize: '13px' }}>{getStudentName(r.studentId)}</span>
                                                                                ))
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
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
