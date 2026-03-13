import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { BookOpen, Plus, Edit2, Trash2, Check, X, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Lessons() {
    const { currentUser } = useAuth();
    const [batches, setBatches] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', order: 1, status: 'planned', coveredOn: '' });

    useEffect(() => {
        if (currentUser) loadBatches();
    }, [currentUser]);

    useEffect(() => {
        if (selectedBatch) loadLessons();
    }, [selectedBatch]);

    async function loadBatches() {
        try {
            const snap = await getDocs(
                query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))
            );
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setBatches(data);
            if (data.length > 0 && !selectedBatch) setSelectedBatch(data[0].id);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadLessons() {
        try {
            const snap = await getDocs(
                query(collection(db, 'lessons'), where('teacherId', '==', currentUser.uid), where('batchId', '==', selectedBatch))
            );
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setLessons(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
        } catch (err) {
            console.error('Error:', err);
        }
    }

    function openCreate() {
        setEditingLesson(null);
        setForm({ title: '', description: '', order: lessons.length + 1, status: 'planned', coveredOn: '' });
        setShowModal(true);
    }

    function openEdit(lesson) {
        setEditingLesson(lesson);
        const coveredDate = lesson.coveredOn?.toDate ? format(lesson.coveredOn.toDate(), 'yyyy-MM-dd') : lesson.coveredOn || '';
        setForm({
            title: lesson.title, description: lesson.description || '', order: lesson.order || 1,
            status: lesson.status || 'planned', coveredOn: coveredDate,
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                batchId: selectedBatch,
                teacherId: currentUser.uid,
                order: parseInt(form.order) || 1,
            };
            if (editingLesson) {
                await updateDoc(doc(db, 'lessons', editingLesson.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'lessons'), data);
            }
            setShowModal(false);
            loadLessons();
            toast.success('Lesson saved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to save.');
        }
    }

    async function toggleCovered(lesson) {
        try {
            const newStatus = lesson.status === 'covered' ? 'planned' : 'covered';
            await updateDoc(doc(db, 'lessons', lesson.id), {
                status: newStatus,
                coveredOn: newStatus === 'covered' ? format(new Date(), 'yyyy-MM-dd') : '',
            });
            loadLessons();
            toast.success(newStatus === 'covered' ? 'Topic marked as covered!' : 'Topic unmarked.');
        } catch (err) {
            console.error('Error:', err);
        }
    }

    async function handleDelete(lessonId) {
        if (!confirm('Delete this topic?')) return;
        try {
            await deleteDoc(doc(db, 'lessons', lessonId));
            loadLessons();
        } catch (err) {
            console.error('Error:', err);
        }
    }

    const coveredCount = lessons.filter((l) => l.status === 'covered').length;
    const coveragePercent = lessons.length > 0 ? Math.round((coveredCount / lessons.length) * 100) : 0;

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Lessons & Curriculum</h1>
                    <p className="page-subtitle">Track your syllabus coverage per batch</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} disabled={!selectedBatch}>
                    <Plus size={18} /> Add Topic
                </button>
            </div>

            {/* Batch selector */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-select" style={{ width: 220 }} value={selectedBatch}
                    onChange={(e) => setSelectedBatch(e.target.value)}>
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                {selectedBatch && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                        <div className="progress-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <div className="progress-bar-fill" style={{ width: `${coveragePercent}%` }} />
                        </div>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-accent)' }}>
                            {coveragePercent}% covered ({coveredCount}/{lessons.length})
                        </span>
                    </div>
                )}
            </div>

            {!selectedBatch ? (
                <div className="card"><div className="empty-state">
                    <BookOpen size={48} className="empty-state-icon" />
                    <div className="empty-state-title">Select a batch</div>
                    <div className="empty-state-text">Choose a batch to view and manage its curriculum.</div>
                </div></div>
            ) : lessons.length === 0 ? (
                <div className="card"><div className="empty-state">
                    <BookOpen size={48} className="empty-state-icon" />
                    <div className="empty-state-title">No topics yet</div>
                    <div className="empty-state-text">Add topics to start tracking your syllabus.</div>
                    <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 'var(--space-4)' }}>
                        <Plus size={18} /> Add First Topic
                    </button>
                </div></div>
            ) : (
                <div className="lesson-list">
                    {lessons.map((lesson) => (
                        <div key={lesson.id} className="lesson-item">
                            <div className={`lesson-item-order ${lesson.status === 'covered' ? 'covered' : ''}`}>
                                {lesson.order}
                            </div>
                            <div className="lesson-item-content">
                                <div className="lesson-item-title" style={{
                                    textDecoration: lesson.status === 'covered' ? 'line-through' : 'none',
                                    opacity: lesson.status === 'covered' ? 0.7 : 1,
                                }}>
                                    {lesson.title}
                                </div>
                                <div className="lesson-item-meta">
                                    {lesson.description && <span>{lesson.description} · </span>}
                                    {lesson.status === 'covered' && lesson.coveredOn && (
                                        <span>Covered on {lesson.coveredOn}</span>
                                    )}
                                    {lesson.status !== 'covered' && (
                                        <span className="badge badge-gold" style={{ fontSize: 'var(--font-size-xs)' }}>Pending</span>
                                    )}
                                </div>
                            </div>
                            <div className="lesson-item-actions">
                                <button className={`btn btn-sm ${lesson.status === 'covered' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => toggleCovered(lesson)} title={lesson.status === 'covered' ? 'Unmark' : 'Mark as covered'}>
                                    <Check size={14} />
                                </button>
                                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(lesson)}>
                                    <Edit2 size={14} />
                                </button>
                                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(lesson.id)}>
                                    <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingLesson ? 'Edit Topic' : 'Add Topic'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Topic Title *</label>
                                    <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Order</label>
                                        <input className="form-input" type="number" min="1" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                            <option value="planned">Planned</option>
                                            <option value="covered">Covered</option>
                                            <option value="skipped">Skipped</option>
                                        </select>
                                    </div>
                                </div>
                                {form.status === 'covered' && (
                                    <div className="form-group">
                                        <label className="form-label">Covered On</label>
                                        <input className="form-input" type="date" value={form.coveredOn} onChange={(e) => setForm({ ...form, coveredOn: e.target.value })} />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingLesson ? 'Save' : 'Add Topic'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
