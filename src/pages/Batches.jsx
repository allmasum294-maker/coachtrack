import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { GraduationCap, Plus, Edit2, Trash2, Users, BookOpen, X, CheckCircle, Sparkles, Filter, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';
import { closeBatch, reactivateBatch } from '../services/batchService';
import toast from 'react-hot-toast';

export default function Batches() {
    const { currentUser } = useAuth();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [form, setForm] = useState({ name: '', grade: '', subject: 'English', isClosed: false });
    const [viewMode, setViewMode] = useState('active'); // 'active' or 'closed'
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
            console.error('Core Telemetry Error:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingBatch(null);
        setForm({ name: '', grade: '', subject: 'English', isClosed: false });
        setShowModal(true);
    }

    function openEdit(batch) {
        setEditingBatch(batch);
        setForm({ name: batch.name, grade: String(batch.grade), subject: batch.subject, isClosed: !!batch.isClosed });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                name: form.name,
                grade: parseInt(form.grade),
                subject: form.subject,
                isClosed: form.isClosed,
                closedAt: form.isClosed ? (editingBatch?.closedAt || serverTimestamp()) : null,
                teacherId: currentUser.uid,
            };

            if (editingBatch) {
                await updateDoc(doc(db, 'batches', editingBatch.id), data);
            } else {
                data.createdAt = serverTimestamp();
                data.studentIds = [];
                data.isClosed = false;
                await addDoc(collection(db, 'batches'), data);
            }
            setShowModal(false);
            loadBatches();
            toast.success(editingBatch ? 'Registry Updated' : 'New Cluster Established');
        } catch (err) {
            console.error('Write Error:', err);
            toast.error('Initialization Failed');
        }
    }

    async function handleDelete(batchId) {
        if (!confirm('Are you sure you want to terminate this batch? All associated data will remain but student assignments will need manual cleanup.')) return;
        try {
            await deleteDoc(doc(db, 'batches', batchId));
            loadBatches();
            toast.success('Batch Terminated');
        } catch (err) {
            console.error('Deletion Error:', err);
        }
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    const filteredBatches = batches.filter(b => viewMode === 'closed' ? !!b.isClosed : !b.isClosed);

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cluster Management</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Batches</h1>
                    <p className="page-subtitle" style={{ fontWeight: 600 }}>Configure and monitor your pedagogical clusters</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 24px', height: '48px', fontWeight: 900, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                    <Plus size={18} /> ESTABLISH CLUSTER
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '6px', marginBottom: 'var(--space-8)', display: 'inline-flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)' }}>
                <button 
                    className={`tab ${viewMode === 'active' ? 'active' : ''}`} 
                    onClick={() => setViewMode('active')}
                    style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 800 }}
                >
                    Operational
                </button>
                <button 
                    className={`tab ${viewMode === 'closed' ? 'active' : ''}`} 
                    onClick={() => setViewMode('closed')}
                    style={{ padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 800 }}
                >
                    Archived
                </button>
            </div>

            {filteredBatches.length === 0 ? (
                <div className="glass-card" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={40} opacity={0.3} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>No Clusters Detected</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 32px', fontWeight: 500 }}>
                        {viewMode === 'active' 
                            ? 'The operational matrix is currently empty. Establish your first pedagogical cluster to begin telemetry.' 
                            : 'No archived clusters found in the historical data logs.'}
                    </p>
                    {viewMode === 'active' && (
                        <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 32px', height: '48px', fontWeight: 900 }}>
                            <Plus size={18} /> INITIALIZE FIRST CLUSTER
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid-3">
                    {filteredBatches.map((batch, i) => (
                        <div key={batch.id} className="glass-panel hover-lift animate-fade-in-up" style={{ 
                            padding: '32px', 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '24px',
                            position: 'relative',
                            overflow: 'hidden',
                            animationDelay: `${i * 0.05}s`,
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                             <div style={{
                                position: 'absolute',
                                top: '-20px',
                                right: '-20px',
                                width: '120px',
                                height: '120px',
                                background: batch.isClosed ? 'radial-gradient(circle, rgba(239, 68, 68, 0.05) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)',
                                zIndex: 0
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: '14px',
                                        background: batch.isClosed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: batch.isClosed ? '#ef4444' : 'var(--color-primary)',
                                    }}>
                                        <GraduationCap size={28} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                {batch.subject}
                                            </span>
                                            {batch.isClosed && <span className="badge badge-red" style={{ fontSize: '9px', fontWeight: 900 }}>ARCHIVED</span>}
                                        </div>
                                        <h3 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: 'var(--color-text-primary)' }}>{batch.name}</h3>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                        className="btn btn-ghost btn-icon" 
                                        onClick={async () => {
                                            const newStatus = !batch.isClosed;
                                            setEditingBatch(batch);
                                            setForm(prev => ({ ...prev, isClosed: newStatus }));
                                            setShowModal(true);
                                        }}
                                        style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                    >
                                        <CheckCircle size={18} style={{ color: batch.isClosed ? '#10b981' : 'var(--color-text-muted)', opacity: batch.isClosed ? 1 : 0.3 }} />
                                    </button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(batch)} style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                                        <Edit2 size={18} />
                                    </button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(batch.id)} style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                                        <Trash2 size={18} style={{ color: '#ef4444', opacity: 0.7 }} />
                                    </button>
                                </div>
                            </div>

                            <Link to={`/batches/${batch.id}`} style={{ textDecoration: 'none', color: 'inherit', position: 'relative', zIndex: 1, display: 'block' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Capacity</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <Users size={14} style={{ color: 'var(--color-primary)' }} />
                                            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{studentCounts[batch.id] || 0}</span>
                                        </div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Grade</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <BookOpen size={14} style={{ color: '#10b981' }} />
                                            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-text-primary)' }}>{batch.grade}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    <span>Detailed Telemetry</span>
                                    <ChevronRight size={16} />
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingBatch ? 'Adjust Cluster' : 'New Cluster Protocol'}
            >
                <form onSubmit={handleSave} style={{ display: 'grid', gap: '24px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Cluster Designation</label>
                        <input
                            className="form-input"
                            placeholder="e.g., Class 10 Alpha - Prime"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Level (Grade)</label>
                            <select
                                className="form-select"
                                value={form.grade}
                                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                                required
                                style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <option value="">Select Level</option>
                                <option value="9">Grade 9</option>
                                <option value="10">Grade 10</option>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Domain (Subject)</label>
                            <input
                                className="form-input"
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                required
                                style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>
                    </div>
                    {editingBatch && (
                        <div className="form-group" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={form.isClosed} 
                                    onChange={(e) => setForm({ ...form, isClosed: e.target.checked })}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <span style={{ fontSize: '13px', fontWeight: 700 }}>Archive this cluster (stops data collection)</span>
                            </label>
                        </div>
                    )}
                    <div className="modal-footer" style={{ padding: '0', marginTop: '12px', border: 'none', display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1, height: '48px', fontWeight: 800, borderRadius: '12px' }}>ABORT</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px', fontWeight: 900, borderRadius: '12px' }}>{editingBatch ? 'SAVE PROTOCOL' : 'INITIALIZE'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
