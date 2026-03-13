import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileEdit, Plus, Edit2, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function SessionLog() {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const defaultBatchId = searchParams.get('batchId') || '';
    const defaultScheduleId = searchParams.get('scheduleId') || '';

    const [logs, setLogs] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState(defaultBatchId);
    
    const [showModal, setShowModal] = useState(defaultScheduleId ? true : false);
    const [editingLog, setEditingLog] = useState(null);
    const [form, setForm] = useState({
        batchId: defaultBatchId,
        scheduleId: defaultScheduleId, // reference to schedule item
        date: format(new Date(), 'yyyy-MM-dd'),
        topicsCovered: '',
        notes: '',
        homeworkAssigned: ''
    });

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const [logSnap, batchSnap] = await Promise.all([
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
            ]);
            setLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingLog(null);
        setForm({
            batchId: filterBatch, scheduleId: '', date: format(new Date(), 'yyyy-MM-dd'),
            topicsCovered: '', notes: '', homeworkAssigned: ''
        });
        setShowModal(true);
    }

    function openEdit(log) {
        setEditingLog(log);
        const dateVal = log.date?.toDate ? format(log.date.toDate(), 'yyyy-MM-dd') : log.date || '';
        setForm({
            batchId: log.batchId || '',
            scheduleId: log.scheduleId || '',
            date: dateVal,
            topicsCovered: log.topicsCovered || '',
            notes: log.notes || '',
            homeworkAssigned: log.homeworkAssigned || ''
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                batchId: form.batchId,
                batchName: batches.find((b) => b.id === form.batchId)?.name || '',
                scheduleId: form.scheduleId,
                date: Timestamp.fromDate(new Date(form.date)),
                topicsCovered: form.topicsCovered,
                notes: form.notes,
                homeworkAssigned: form.homeworkAssigned,
                teacherId: currentUser.uid,
            };

            if (editingLog) {
                await updateDoc(doc(db, 'sessionLogs', editingLog.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'sessionLogs'), data);
                // Optionally update the schedule's status to 'completed'
                if (form.scheduleId) {
                    await updateDoc(doc(db, 'schedules', form.scheduleId), { status: 'completed' });
                }
            }
            setShowModal(false);
            loadData();
            toast.success('Session log saved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to save log.');
        }
    }

    async function handleDelete(logId) {
        if (!confirm('Delete this session log?')) return;
        try {
            await deleteDoc(doc(db, 'sessionLogs', logId));
            loadData();
            toast.success('Log deleted');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to delete.');
        }
    }

    const filteredLogs = logs
        .filter((l) => !filterBatch || l.batchId === filterBatch)
        .sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return db2 - da;
        });

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Session Logs</h1>
                    <p className="page-subtitle">Track topics taught and homework assigned</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Session Log
                </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <select className="form-select" style={{ width: 220 }} value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <FileEdit size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }} />
                        <div className="empty-state-title">No session logs found</div>
                        <div className="empty-state-text">Start by logging your first class session.</div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {filteredLogs.map((log) => {
                        const dateVal = log.date?.toDate ? log.date.toDate() : new Date(log.date);
                        return (
                            <div key={log.id} className="card" style={{ padding: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                                            {format(dateVal, 'EEEE, MMM d, yyyy')} • {log.batchName}
                                        </div>
                                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                                            {log.topicsCovered || 'No topics listed'}
                                        </h3>
                                        
                                        {log.homeworkAssigned && (
                                            <div style={{ background: 'var(--color-bg-elevated)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)' }}>
                                                <strong style={{ color: 'var(--color-accent)' }}>Homework:</strong> {log.homeworkAssigned}
                                            </div>
                                        )}
                                        
                                        {log.notes && (
                                            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.5 }}>
                                                {log.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(log)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(log.id)}>
                                            <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingLog ? 'Edit Session Log' : 'Create Session Log'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Batch *</label>
                                        <select className="form-select" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} required>
                                            <option value="">Select Batch</option>
                                            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Date *</label>
                                        <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Topics Covered *</label>
                                    <input className="form-input" value={form.topicsCovered} onChange={(e) => setForm({ ...form, topicsCovered: e.target.value })} placeholder="e.g., Intro to Algebra" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes (Optional)</label>
                                    <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="How did the class go?" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Homework Assigned (Optional)</label>
                                    <textarea className="form-textarea" value={form.homeworkAssigned} onChange={(e) => setForm({ ...form, homeworkAssigned: e.target.value })} rows={2} placeholder="e.g., Read page 14-20" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingLog ? 'Save' : 'Create Log'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
