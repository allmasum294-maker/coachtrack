import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { batchService } from '../services/batchService';
import { BookOpen, Plus, Edit2, Trash2, Check, X, CheckCircle2, Circle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Lessons() {
    const { userProfile } = useAuth();
    const [batches, setBatches] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLesson, setEditingLesson] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', order: 1, status: 'planned', coveredOn: '' });

    useEffect(() => {
        if (userProfile?.id) loadBatches();
    }, [userProfile]);

    useEffect(() => {
        if (selectedBatch) loadLessons();
    }, [selectedBatch]);

    async function loadBatches() {
        try {
            const data = await batchService.getBatches(userProfile.id, true);
            setBatches(data);
            if (data.length > 0 && !selectedBatch) setSelectedBatch(data[0].id);
        } catch (err) {
            console.error('Error loading batches:', err);
        } finally {
            setLoading(false);
        }
    }

    async function loadLessons() {
        try {
            const { data, error } = await supabase
                .from('lessons')
                .select('*')
                .eq('teacher_id', userProfile.id)
                .eq('batch_id', selectedBatch);
            
            if (error) throw error;
            setLessons(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
        } catch (err) {
            console.error('Error loading lessons:', err);
        }
    }

    function openCreate() {
        setEditingLesson(null);
        setForm({ title: '', description: '', order: lessons.length + 1, status: 'planned', coveredOn: '' });
        setShowModal(true);
    }

    function openEdit(lesson) {
        setEditingLesson(lesson);
        setForm({
            title: lesson.title, 
            description: lesson.description || '', 
            order: lesson.order || 1,
            status: lesson.status || 'planned', 
            coveredOn: lesson.covered_on || '',
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                title: form.title,
                description: form.description,
                order: parseInt(form.order) || 1,
                status: form.status,
                covered_on: form.coveredOn || null,
                batch_id: selectedBatch,
                teacher_id: userProfile.id,
            };

            if (editingLesson) {
                const { error } = await supabase
                    .from('lessons')
                    .update(data)
                    .eq('id', editingLesson.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('lessons')
                    .insert(data);
                if (error) throw error;
            }
            setShowModal(false);
            loadLessons();
            toast.success(editingLesson ? 'Topic updated' : 'Topic added');
        } catch (err) {
            console.error('Error saving lesson:', err);
            toast.error('Failed to save.');
        }
    }

    async function toggleCovered(lesson) {
        try {
            const newStatus = lesson.status === 'covered' ? 'planned' : 'covered';
            const { error } = await supabase
                .from('lessons')
                .update({
                    status: newStatus,
                    covered_on: newStatus === 'covered' ? format(new Date(), 'yyyy-MM-dd') : null,
                })
                .eq('id', lesson.id);
            if (error) throw error;
            loadLessons();
            toast.success(newStatus === 'covered' ? 'Topic marked as covered!' : 'Topic unmarked.');
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    }

    async function handleDelete(lessonId) {
        if (!confirm('Are you sure you want to delete this topic?')) return;
        try {
            const { error } = await supabase
                .from('lessons')
                .delete()
                .eq('id', lessonId);
            if (error) throw error;
            loadLessons();
            toast.success('Topic removed');
        } catch (err) {
            console.error('Error deleting lesson:', err);
        }
    }

    const coveredCount = lessons.filter((l) => l.status === 'covered').length;
    const coveragePercent = lessons.length > 0 ? Math.round((coveredCount / lessons.length) * 100) : 0;

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Topics</h1>
                    <p className="page-subtitle">Track your teaching progress for each batch</p>
                </div>
                <div className="tooltip-wrapper">
                    <button className="btn btn-primary btn-comfort" onClick={openCreate} disabled={!selectedBatch}>
                        <Plus size={24} />
                    </button>
                    <span className="tooltip">Add Topic</span>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '240px' }}>
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>Select Batch</label>
                        <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                            {batches.length === 0 && <option value="">No active batches</option>}
                            {batches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedBatch && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-6)', minWidth: '300px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Class Progress</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)' }}>{coveragePercent}%</span>
                                </div>
                                <div className="progress-bar" style={{ height: '8px', background: 'rgba(0,0,0,0.05)' }}>
                                    <div className="progress-bar-fill" style={{ width: `${coveragePercent}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
                                </div>
                            </div>
                            <div className="glass-card" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Stats</div>
                                <div style={{ fontSize: '16px', fontWeight: 800 }}>{coveredCount} / {lessons.length} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Topics</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!selectedBatch ? (
                <div className="glass-card">
                    <div className="empty-state">
                        <div style={{ padding: '24px', background: 'var(--color-bg-secondary)', borderRadius: '24px', marginBottom: '20px', color: 'var(--color-text-muted)' }}>
                            <BookOpen size={48} />
                        </div>
                        <div className="empty-state-title">No Active Batches</div>
                        <div className="empty-state-text">You need an active batch to start tracking topics.</div>
                    </div>
                </div>
            ) : lessons.length === 0 ? (
                <div className="glass-card">
                    <div className="empty-state">
                        <div style={{ padding: '24px', background: 'var(--color-bg-secondary)', borderRadius: '24px', marginBottom: '20px', color: 'var(--color-text-muted)' }}>
                            <BookOpen size={48} />
                        </div>
                        <div className="empty-state-title">No topics added yet</div>
                        <div className="empty-state-text">Start by adding your first topic for this batch.</div>
                        <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 'var(--space-4)' }}>
                            <Plus size={18} /> Add First Topic
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {lessons.map((lesson) => (
                        <div key={lesson.id} className="glass-card" style={{ 
                            padding: 'var(--space-4)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 'var(--space-4)',
                            background: lesson.status === 'covered' ? 'rgba(20, 184, 166, 0.02)' : 'rgba(255,255,255,0.1)',
                            border: lesson.status === 'covered' ? '1px solid rgba(20, 184, 166, 0.1)' : '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ 
                                width: 36, 
                                height: 36, 
                                borderRadius: '10px', 
                                background: lesson.status === 'covered' ? 'var(--color-success-light)' : 'var(--color-bg-secondary)',
                                color: lesson.status === 'covered' ? 'var(--color-success)' : 'var(--color-text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '14px',
                                flexShrink: 0
                            }}>
                                {lesson.order}
                            </div>
                            
                            <div style={{ flex: 1 }}>
                                <div style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 700, 
                                    color: lesson.status === 'covered' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                                    textDecoration: lesson.status === 'covered' ? 'line-through' : 'none',
                                    opacity: lesson.status === 'covered' ? 0.7 : 1,
                                    marginBottom: '2px'
                                }}>
                                    {lesson.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                                    {lesson.description && <span>{lesson.description}</span>}
                                    {lesson.status === 'covered' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontWeight: 600 }}>
                                            <Check size={12} /> Finished {lesson.coveredOn && `on ${lesson.coveredOn}`}
                                        </div>
                                    )}
                                    {lesson.status === 'planned' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> Planned
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                <button 
                                    className={`btn btn-sm btn-icon ${lesson.status === 'covered' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => toggleCovered(lesson)}
                                    title={lesson.status === 'covered' ? 'Unmark' : 'Mark as finished'}
                                    style={{ borderRadius: '8px' }}
                                >
                                    {lesson.status === 'covered' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                </button>
                                <button className="btn btn-sm btn-ghost btn-icon" onClick={() => openEdit(lesson)} style={{ borderRadius: '8px' }}>
                                    <Edit2 size={16} />
                                </button>
                                <button className="btn btn-sm btn-ghost btn-icon" onClick={() => handleDelete(lesson.id)} style={{ borderRadius: '8px' }}>
                                    <Trash2 size={16} style={{ color: 'var(--color-danger)', opacity: 0.7 }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingLesson ? 'Edit Topic' : 'Add New Topic'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Topic Title *</label>
                                    <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Introduction to Calculus" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Topic Description</label>
                                    <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Briefly explain what this topic is about..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Lesson Number</label>
                                        <input className="form-input" type="number" min="1" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Current Status</label>
                                        <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                            <option value="planned">Not Started</option>
                                            <option value="covered">Finished</option>
                                            <option value="skipped">Skipped</option>
                                        </select>
                                    </div>
                                </div>
                                {form.status === 'covered' && (
                                    <div className="form-group">
                                        <label className="form-label">Finished On</label>
                                        <input className="form-input" type="date" value={form.coveredOn} onChange={(e) => setForm({ ...form, coveredOn: e.target.value })} />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer" style={{ border: 'none' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingLesson ? 'Save Topic' : 'Add Topic'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
