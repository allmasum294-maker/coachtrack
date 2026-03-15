import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BookOpen, Plus, Edit2, Trash2, X, CheckSquare, Square, Calendar, Clock, AlertTriangle, FileEdit } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUSES = [
    { value: 'completed', label: '✅ Completed', color: 'var(--color-success)' },
    { value: 'late', label: '⏰ Late', color: 'var(--color-warning)' },
    { value: 'partial', label: '½ Partial', color: 'var(--color-primary)' },
    { value: 'not_submitted', label: '❌ Not Submitted', color: 'var(--color-danger)' },
];

export default function Homework() {
    const { currentUser } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        batchId: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        sessionLogId: '',
    });

    const [trackingAssignment, setTrackingAssignment] = useState(null);

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [hwSnap, batchSnap, studentSnap, sessionSnap] = await Promise.all([
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', uid))),
            ]);
            setAssignments(hwSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setSessionLogs(sessionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Get submissions map — supports both old completedBy array and new submissions object
    function getSubmissions(hw) {
        if (hw.submissions && typeof hw.submissions === 'object' && Object.keys(hw.submissions).length > 0) {
            return hw.submissions;
        }
        // Migrate old completedBy array
        const subs = {};
        if (hw.completedBy && Array.isArray(hw.completedBy)) {
            hw.completedBy.forEach(id => {
                subs[id] = { status: 'completed' };
            });
        }
        return subs;
    }

    function getSubmissionStats(hw) {
        const assignedStudents = students.filter(s => s.batchIds?.includes(hw.batchId));
        const total = assignedStudents.length;
        const subs = getSubmissions(hw);
        let completed = 0, late = 0, partial = 0, notSubmitted = 0;
        assignedStudents.forEach(s => {
            const sub = subs[s.id];
            if (!sub || !sub.status || sub.status === 'not_submitted') notSubmitted++;
            else if (sub.status === 'completed') completed++;
            else if (sub.status === 'late') late++;
            else if (sub.status === 'partial') partial++;
        });
        return { total, completed, late, partial, notSubmitted };
    }

    function openCreate() {
        setEditingAssignment(null);
        setForm({
            title: '', description: '', batchId: filterBatch,
            dueDate: format(new Date(), 'yyyy-MM-dd'), sessionLogId: '',
        });
        setShowModal(true);
    }

    function openEdit(hw) {
        setEditingAssignment(hw);
        const dateVal = hw.dueDate?.toDate ? format(hw.dueDate.toDate(), 'yyyy-MM-dd') : hw.dueDate || '';
        setForm({
            title: hw.title || '',
            description: hw.description || '',
            batchId: hw.batchId || '',
            dueDate: dateVal,
            sessionLogId: hw.sessionLogId || '',
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                title: form.title,
                description: form.description,
                batchId: form.batchId,
                dueDate: Timestamp.fromDate(new Date(form.dueDate)),
                sessionLogId: form.sessionLogId,
                teacherId: currentUser.uid,
            };

            if (editingAssignment) {
                await updateDoc(doc(db, 'homeworks', editingAssignment.id), data);
                toast.success('Assignment updated!');
            } else {
                data.createdAt = serverTimestamp();
                data.completedBy = [];
                data.submissions = {};
                await addDoc(collection(db, 'homeworks'), data);
                toast.success('Assignment created!');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save assignment');
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this assignment?')) return;
        try {
            await deleteDoc(doc(db, 'homeworks', id));
            loadData();
            toast.success('Deleted successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete');
        }
    }

    async function setStudentSubmissionStatus(studentId, status) {
        if (!trackingAssignment) return;
        try {
            const currentSubs = getSubmissions(trackingAssignment);
            const newSubs = {
                ...currentSubs,
                [studentId]: { status, date: new Date().toISOString() }
            };

            // Also update completedBy for backward compat
            const completedBy = Object.entries(newSubs)
                .filter(([_, v]) => v.status === 'completed')
                .map(([k]) => k);

            await updateDoc(doc(db, 'homeworks', trackingAssignment.id), {
                submissions: newSubs,
                completedBy,
            });

            const updatedHw = { ...trackingAssignment, submissions: newSubs, completedBy };
            setTrackingAssignment(updatedHw);
            setAssignments(assignments.map(a =>
                a.id === trackingAssignment.id ? updatedHw : a
            ));
        } catch (err) {
            console.error(err);
            toast.error('Failed to update status');
        }
    }

    function getBatchName(id) {
        return batches.find(b => b.id === id)?.name || 'Unknown Batch';
    }

    function getSessionLogInfo(sessionLogId) {
        if (!sessionLogId) return null;
        return sessionLogs.find(l => l.id === sessionLogId) || null;
    }

    function getDueDateStatus(date) {
        const d = date?.toDate ? date.toDate() : new Date(date);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (d < today) return { label: 'Overdue', color: 'var(--color-danger)' };
        if (d.getTime() === today.getTime()) return { label: 'Due Today', color: 'var(--color-warning)' };
        return { label: `Due ${format(d, 'MMM d')}`, color: 'var(--color-teal)' };
    }

    const filteredAssignments = assignments
        .filter(a => !filterBatch || a.batchId === filterBatch)
        .sort((a, b) => {
            const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
            const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
            return db2 - da;
        });

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Homework Tracker</h1>
                    <p className="page-subtitle">Assign and track student homework</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Assignment
                </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <select className="form-select" style={{ width: 220 }} value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
            </div>

            {filteredAssignments.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <BookOpen size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }} />
                        <div className="empty-state-title">No assignments found</div>
                        <div className="empty-state-text">Click "Add Assignment" to create some homework.</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                    {filteredAssignments.map(hw => {
                        const status = getDueDateStatus(hw.dueDate);
                        const stats = getSubmissionStats(hw);
                        const progPerc = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                        const linkedLog = getSessionLogInfo(hw.sessionLogId);

                        return (
                            <div key={hw.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                                    <span className="badge" style={{ backgroundColor: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                                        {status.label}
                                    </span>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(hw)}><Edit2 size={14} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(hw.id)}><Trash2 size={14} style={{ color: 'var(--color-danger)' }} /></button>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{hw.title}</h3>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                                    Batch: {getBatchName(hw.batchId)}
                                </div>

                                {/* Session Log Link */}
                                {linkedLog && (
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                        <FileEdit size={12} />
                                        From Session: {linkedLog.topicsCovered || 'N/A'} ({linkedLog.date?.toDate ? format(linkedLog.date.toDate(), 'MMM d') : ''})
                                    </div>
                                )}

                                {hw.description && (
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)', flex: 1 }}>
                                        {hw.description}
                                    </p>
                                )}

                                {/* Detailed Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-success)' }}>{stats.completed}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Done</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-warning)' }}>{stats.late}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Late</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-primary)' }}>{stats.partial}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Partial</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-danger)' }}>{stats.notSubmitted}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Missing</div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                                        <span>Completion</span>
                                        <span style={{ fontWeight: 600 }}>{stats.completed}/{stats.total} ({progPerc}%)</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 8, marginBottom: 'var(--space-4)' }}>
                                        <div className="progress-bar-fill" style={{ width: `${progPerc}%`, background: progPerc === 100 ? 'var(--color-teal)' : 'var(--color-primary)' }} />
                                    </div>
                                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setTrackingAssignment(hw)}>
                                        Check / Grade Submissions
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Assignment Title *</label>
                                    <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Chapter 4 Exercises" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Batch *</label>
                                        <select className="form-select" value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value, sessionLogId: '' })} required>
                                            <option value="">Select Batch</option>
                                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date *</label>
                                        <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
                                    </div>
                                </div>
                                {/* Link to Session Log */}
                                {form.batchId && (
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                            <FileEdit size={14} /> Link to Session Log (Optional)
                                        </label>
                                        <select className="form-select" value={form.sessionLogId} onChange={e => setForm({ ...form, sessionLogId: e.target.value })}>
                                            <option value="">— No link —</option>
                                            {sessionLogs
                                                .filter(l => l.batchId === form.batchId)
                                                .sort((a, b) => {
                                                    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                                                    const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                                                    return db2 - da;
                                                })
                                                .map(l => {
                                                    const dateVal = l.date?.toDate ? format(l.date.toDate(), 'MMM d') : l.date;
                                                    return (
                                                        <option key={l.id} value={l.id}>
                                                            {dateVal} — {l.topicsCovered || 'Session'}
                                                        </option>
                                                    );
                                                })}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Description / Instructions</label>
                                    <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Any specific instructions..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingAssignment ? 'Save Changes' : 'Create Assignment'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tracking Modal — 4-State Submission Statuses */}
            {trackingAssignment && (
                <div className="modal-overlay" onClick={() => setTrackingAssignment(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">{trackingAssignment.title}</h2>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                    Batch: {getBatchName(trackingAssignment.batchId)}
                                </p>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setTrackingAssignment(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
                            {(() => {
                                const assignedStudents = students.filter(s => s.batchIds?.includes(trackingAssignment.batchId));
                                const subs = getSubmissions(trackingAssignment);
                                if (assignedStudents.length === 0) {
                                    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students in this batch.</div>;
                                }
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {assignedStudents.map(student => {
                                            const sub = subs[student.id];
                                            const currentStatus = sub?.status || 'not_submitted';
                                            return (
                                                <div
                                                    key={student.id}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: 'var(--space-3) var(--space-4)',
                                                        borderBottom: '1px solid var(--color-border)',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div style={{ fontWeight: 500 }}>{student.name}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {STATUSES.map(st => (
                                                            <button
                                                                key={st.value}
                                                                type="button"
                                                                onClick={() => setStudentSubmissionStatus(student.id, st.value)}
                                                                className="btn btn-sm"
                                                                style={{
                                                                    padding: '3px 8px',
                                                                    fontSize: '11px',
                                                                    background: currentStatus === st.value ? `${st.color}20` : 'transparent',
                                                                    color: currentStatus === st.value ? st.color : 'var(--color-text-muted)',
                                                                    border: `1px solid ${currentStatus === st.value ? st.color : 'var(--color-border)'}`,
                                                                    fontWeight: currentStatus === st.value ? 700 : 400,
                                                                }}
                                                            >
                                                                {st.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setTrackingAssignment(null)}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
