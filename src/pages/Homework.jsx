import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BookOpen, Plus, Edit2, Trash2, X, CheckSquare, Square, Calendar } from 'lucide-react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import toast from 'react-hot-toast';

export default function Homework() {
    const { currentUser } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        batchId: '',
        dueDate: format(new Date(), 'yyyy-MM-dd')
    });

    const [trackingAssignment, setTrackingAssignment] = useState(null);

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [hwSnap, batchSnap, studentSnap] = await Promise.all([
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
            ]);
            setAssignments(hwSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingAssignment(null);
        setForm({
            title: '',
            description: '',
            batchId: filterBatch,
            dueDate: format(new Date(), 'yyyy-MM-dd')
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
            dueDate: dateVal
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
                teacherId: currentUser.uid,
            };

            if (editingAssignment) {
                await updateDoc(doc(db, 'homework', editingAssignment.id), data);
                toast.success('Assignment updated!');
            } else {
                data.createdAt = serverTimestamp();
                data.completedBy = [];
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

    async function toggleStudentCompletion(studentId) {
        if (!trackingAssignment) return;
        try {
            const currentCompleted = trackingAssignment.completedBy || [];
            const isCompleted = currentCompleted.includes(studentId);
            
            const newCompleted = isCompleted 
                ? currentCompleted.filter(id => id !== studentId) 
                : [...currentCompleted, studentId];
            
            await updateDoc(doc(db, 'homeworks', trackingAssignment.id), { completedBy: newCompleted });
            
            setTrackingAssignment({ ...trackingAssignment, completedBy: newCompleted });
            
            // update in state list as well without reloading all data
            setAssignments(assignments.map(a => 
                a.id === trackingAssignment.id ? { ...a, completedBy: newCompleted } : a
            ));
        } catch (err) {
            console.error(err);
            toast.error('Failed to update status');
        }
    }

    function getBatchName(id) {
        return batches.find(b => b.id === id)?.name || 'Unknown Batch';
    }

    function getDueDateStatus(date) {
        const d = date?.toDate ? date.toDate() : new Date(date);
        d.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (d < today) return { label: 'Overdue', color: 'var(--color-danger)' };
        if (d.getTime() === today.getTime()) return { label: 'Due Today', color: 'var(--color-warning)' };
        return { label: `Due ${format(d, 'MMM d')}`, color: 'var(--color-teal)' };
    }

    const filteredAssignments = assignments
        .filter(a => !filterBatch || a.batchId === filterBatch)
        .sort((a,b) => {
            const da = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
            const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
            return db2 - da; // newest first
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
                        const assignedStudents = students.filter(s => s.batchIds?.includes(hw.batchId));
                        const compCount = hw.completedBy?.length || 0;
                        const totalCount = assignedStudents.length;
                        const progPerc = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;

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
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                    Batch: {getBatchName(hw.batchId)}
                                </div>
                                
                                {hw.description && (
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)', flex: 1 }}>
                                        {hw.description}
                                    </p>
                                )}

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
                                        <span>Completion Rate</span>
                                        <span style={{ fontWeight: 600 }}>{compCount} / {totalCount} ({progPerc}%)</span>
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
                                    <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="e.g. Chapter 4 Exercises" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Batch *</label>
                                        <select className="form-select" value={form.batchId} onChange={e => setForm({...form, batchId: e.target.value})} required>
                                            <option value="">Select Batch</option>
                                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date *</label>
                                        <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description / Instructions</label>
                                    <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Any specific instructions..." />
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

            {/* Tracking Modal */}
            {trackingAssignment && (
                <div className="modal-overlay" onClick={() => setTrackingAssignment(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
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
                                if (assignedStudents.length === 0) {
                                    return <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students in this batch.</div>;
                                }
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {assignedStudents.map(student => {
                                            const isComplete = (trackingAssignment.completedBy || []).includes(student.id);
                                            return (
                                                <div 
                                                    key={student.id} 
                                                    onClick={() => toggleStudentCompletion(student.id)}
                                                    style={{ 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                                        padding: 'var(--space-3) var(--space-4)', 
                                                        borderBottom: '1px solid var(--color-border)',
                                                        cursor: 'pointer',
                                                    }}
                                                    className="hover-bg-light"
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{student.name}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ color: isComplete ? 'var(--color-teal)' : 'var(--color-text-muted)' }}>
                                                        {isComplete ? <CheckSquare size={22} className="animate-pop-in" /> : <Square size={22} />}
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
