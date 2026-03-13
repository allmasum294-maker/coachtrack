import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { GraduationCap, Plus, Edit2, Trash2, Users, BookOpen, X } from 'lucide-react';

export default function Batches() {
    const { currentUser } = useAuth();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [form, setForm] = useState({ name: '', grade: '', subject: 'English' });
    const [studentCounts, setStudentCounts] = useState({});

    useEffect(() => {
        if (currentUser) loadBatches();
    }, [currentUser]);

    async function loadBatches() {
        try {
            const snap = await getDocs(
                query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))
            );
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setBatches(data);

            // Count students per batch
            const counts = {};
            const studentSnap = await getDocs(
                query(collection(db, 'students'), where('teacherId', '==', currentUser.uid))
            );
            studentSnap.docs.forEach((d) => {
                const s = d.data();
                (s.batchIds || []).forEach((bid) => {
                    counts[bid] = (counts[bid] || 0) + 1;
                });
            });
            setStudentCounts(counts);
        } catch (err) {
            console.error('Error loading batches:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingBatch(null);
        setForm({ name: '', grade: '', subject: 'English' });
        setShowModal(true);
    }

    function openEdit(batch) {
        setEditingBatch(batch);
        setForm({ name: batch.name, grade: String(batch.grade), subject: batch.subject });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                name: form.name,
                grade: parseInt(form.grade),
                subject: form.subject,
                teacherId: currentUser.uid,
            };

            if (editingBatch) {
                await updateDoc(doc(db, 'batches', editingBatch.id), data);
            } else {
                data.createdAt = serverTimestamp();
                data.studentIds = [];
                await addDoc(collection(db, 'batches'), data);
            }
            setShowModal(false);
            loadBatches();
        } catch (err) {
            console.error('Error saving batch:', err);
        }
    }

    async function handleDelete(batchId) {
        if (!confirm('Are you sure you want to delete this batch?')) return;
        try {
            await deleteDoc(doc(db, 'batches', batchId));
            loadBatches();
        } catch (err) {
            console.error('Error deleting batch:', err);
        }
    }

    if (loading) {
        return (
            <div className="loading-page">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Batches</h1>
                    <p className="page-subtitle">Manage your class batches</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Create Batch
                </button>
            </div>

            {batches.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <GraduationCap size={48} className="empty-state-icon" />
                        <div className="empty-state-title">No batches yet</div>
                        <div className="empty-state-text">
                            Create your first batch (e.g., "Class 9 English") to get started.
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={openCreate}
                            style={{ marginTop: 'var(--space-4)' }}
                        >
                            <Plus size={18} /> Create First Batch
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid-3">
                    {batches.map((batch) => (
                        <div key={batch.id} className="card card-interactive">
                            <div className="card-header">
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        background: 'var(--color-accent-soft)',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--color-accent)',
                                    }}
                                >
                                    <GraduationCap size={22} />
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(batch)}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(batch.id)}>
                                        <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                    </button>
                                </div>
                            </div>
                            <Link to={`/batches/${batch.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                                    {batch.name}
                                </h3>
                                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                        <Users size={16} />
                                        {studentCounts[batch.id] || 0} students
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                        <BookOpen size={16} />
                                        Grade {batch.grade}
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingBatch ? 'Edit Batch' : 'Create New Batch'}
                            </h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Batch Name</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., Class 9 English"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Grade</label>
                                        <select
                                            className="form-select"
                                            value={form.grade}
                                            onChange={(e) => setForm({ ...form, grade: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Grade</option>
                                            <option value="9">Class 9</option>
                                            <option value="10">Class 10</option>
                                            <option value="11">Class 11</option>
                                            <option value="12">Class 12</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Subject</label>
                                        <input
                                            className="form-input"
                                            value={form.subject}
                                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingBatch ? 'Save Changes' : 'Create Batch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
