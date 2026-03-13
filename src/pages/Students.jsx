import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
    Users, Plus, Edit2, Trash2, Search, X, Eye, Phone, Mail, School, MapPin,
} from 'lucide-react';

export default function Students() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [search, setSearch] = useState('');
    const [filterBatch, setFilterBatch] = useState('');
    const [form, setForm] = useState({
        name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
        school: '', grade: '', address: '', notes: '', batchIds: [],
    });

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const [studentSnap, batchSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading students:', err);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingStudent(null);
        setForm({
            name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
            school: '', grade: '', address: '', notes: '', batchIds: [],
        });
        setShowModal(true);
    }

    function openEdit(student) {
        setEditingStudent(student);
        setForm({
            name: student.name || '',
            email: student.email || '',
            phone: student.phone || '',
            guardianName: student.guardianName || '',
            guardianPhone: student.guardianPhone || '',
            school: student.school || '',
            grade: String(student.grade || ''),
            address: student.address || '',
            notes: student.notes || '',
            batchIds: student.batchIds || [],
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = { ...form, grade: parseInt(form.grade) || 0, teacherId: currentUser.uid };
            if (editingStudent) {
                await updateDoc(doc(db, 'students', editingStudent.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'students'), data);
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Error saving student:', err);
        }
    }

    async function handleDelete(studentId) {
        if (!confirm('Are you sure you want to remove this student?')) return;
        try {
            await deleteDoc(doc(db, 'students', studentId));
            loadData();
        } catch (err) {
            console.error('Error deleting student:', err);
        }
    }

    function toggleBatch(batchId) {
        setForm((prev) => ({
            ...prev,
            batchIds: prev.batchIds.includes(batchId)
                ? prev.batchIds.filter((id) => id !== batchId)
                : [...prev.batchIds, batchId],
        }));
    }

    const filteredStudents = students.filter((s) => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
        const matchesBatch = !filterBatch || (s.batchIds || []).includes(filterBatch);
        return matchesSearch && matchesBatch;
    });

    function getBatchName(batchId) {
        return batches.find((b) => b.id === batchId)?.name || batchId;
    }

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Students</h1>
                    <p className="page-subtitle">Manage your student profiles</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Add Student
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                    <Search className="search-icon" />
                    <input
                        className="form-input"
                        placeholder="Search students..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="form-select"
                    style={{ width: 200 }}
                    value={filterBatch}
                    onChange={(e) => setFilterBatch(e.target.value)}
                >
                    <option value="">All Batches</option>
                    {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Users size={48} className="empty-state-icon" />
                        <div className="empty-state-title">
                            {students.length === 0 ? 'No students yet' : 'No students match your filter'}
                        </div>
                        <div className="empty-state-text">
                            {students.length === 0
                                ? 'Add your first student to get started.'
                                : 'Try adjusting your search or filter.'}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Grade</th>
                                <th>School</th>
                                <th>Batches</th>
                                <th>Contact</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map((student) => (
                                <tr key={student.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <div className="attendance-student-avatar">
                                                {student.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{student.name}</div>
                                                {student.email && (
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                        {student.email}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>Class {student.grade}</td>
                                    <td>{student.school || '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                            {(student.batchIds || []).map((bid) => (
                                                <span key={bid} className="badge badge-teal">{getBatchName(bid)}</span>
                                            ))}
                                            {(!student.batchIds || student.batchIds.length === 0) && (
                                                <span className="badge badge-red">Unassigned</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {student.phone && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                                {student.phone}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                            <Link to={`/students/${student.id}`} className="btn btn-ghost btn-icon">
                                                <Eye size={16} />
                                            </Link>
                                            <button className="btn btn-ghost btn-icon" onClick={() => openEdit(student)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(student.id)}>
                                                <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Grade</label>
                                        <select className="form-select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                                            <option value="">Select</option>
                                            <option value="9">Class 9</option>
                                            <option value="10">Class 10</option>
                                            <option value="11">Class 11</option>
                                            <option value="12">Class 12</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Guardian Name</label>
                                        <input className="form-input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Guardian Phone</label>
                                        <input className="form-input" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">School</label>
                                    <input className="form-input" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address</label>
                                    <textarea className="form-textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any additional notes about the student..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assign to Batches</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {batches.map((b) => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                className={`btn btn-sm ${form.batchIds.includes(b.id) ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => toggleBatch(b.id)}
                                            >
                                                {b.name}
                                            </button>
                                        ))}
                                        {batches.length === 0 && (
                                            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                                Create batches first to assign students.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingStudent ? 'Save Changes' : 'Add Student'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
