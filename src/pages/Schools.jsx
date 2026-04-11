import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    Layers, Plus, Edit2, Trash2, Search, X, 
    School, MapPin, Phone, Users, ChevronRight,
    ArrowRight, Activity, TrendingUp, Building2
} from 'lucide-react';
import { schoolService } from '../services/schoolService';
import { studentService } from '../services/studentService';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

export default function Schools() {
    const { userProfile } = useAuth();
    const [schools, setSchools] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSchool, setEditingSchool] = useState(null);
    const [viewingSchool, setViewingSchool] = useState(null);
    const [search, setSearch] = useState('');
    
    const [form, setForm] = useState({
        name: '', address: '', phone: ''
    });

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [schoolData, studentData] = await Promise.all([
                schoolService.getSchools(uid),
                studentService.getStudentsByTeacher(uid)
            ]);
            setSchools(schoolData);
            setStudents(studentData);
        } catch (err) {
            console.error('Error loading schools:', err);
            toast.error('Could not load school data');
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingSchool(null);
        setForm({ name: '', address: '', phone: '' });
        setShowModal(true);
    }

    function openEdit(school) {
        setEditingSchool(school);
        setForm({
            name: school.name || '',
            address: school.address || '',
            phone: school.phone || ''
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                teacher_id: userProfile.id
            };
            if (editingSchool) data.id = editingSchool.id;

            await schoolService.saveSchool(data);
            toast.success(editingSchool ? 'School updated' : 'School added');
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Error saving school:', err);
            toast.error('Failed to save school');
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure? This will unlink students from this school (but won\'t delete the students).')) return;
        try {
            await schoolService.deleteSchool(id);
            toast.success('School removed');
            loadData();
        } catch (err) {
            console.error('Error deleting school:', err);
        }
    }

    const filteredSchools = useMemo(() => {
        return schools.filter(s => 
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.address?.toLowerCase().includes(search.toLowerCase())
        );
    }, [schools, search]);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div className="badge-premium" style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-teal)' }}>Registry</div>
                    </div>
                    <h1 className="page-title">Schools & Colleges</h1>
                    <p className="page-subtitle">Manage your student's institutions and school-based targeting</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 24px', height: '48px', fontWeight: 900 }}>
                    <Plus size={18} /> ADD INSTITUTION
                </button>
            </div>

            {/* School Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900 }}>{schools.length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Schools</div>
                </div>
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900 }}>{students.filter(s => s.school_id).length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mapped Students</div>
                </div>
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Activity size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 900 }}>{students.filter(s => !s.school_id).length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unlinked Students</div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
                        <Search className="search-icon" size={16} />
                        <input
                            className="form-input"
                            placeholder="Find institution by name or location..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ height: '44px' }}
                        />
                    </div>
                </div>
            </div>

            {filteredSchools.length === 0 ? (
                <div className="glass-panel" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <Building2 size={60} style={{ opacity: 0.1, margin: '0 auto 24px' }} />
                    <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>No Institutions Connected</h3>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Add your first school to start targeting homework by institution.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                    {filteredSchools.map(school => (
                        <div key={school.id} className="glass-card hover-lift" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div style={{ 
                                    width: '56px', height: '56px', borderRadius: '18px', 
                                    background: 'rgba(255,255,255,0.03)', color: 'var(--color-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '24px', fontWeight: 900, border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {school.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(school)}><Edit2 size={16} /></button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(school.id)} style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>{school.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '4px' }}>
                                <MapPin size={14} /> {school.address || 'Location not set'}
                            </div>
                            {school.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                                    <Phone size={14} /> {school.phone}
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Users size={16} color="var(--color-primary)" />
                                        <span style={{ fontWeight: 800, fontSize: '15px' }}>{school.studentCount}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Students</span>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setViewingSchool(school)} style={{ padding: '4px 8px' }}>
                                        VIEW LIST <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Save School Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingSchool ? 'Edit Institution' : 'Add New Institution'}
            >
                <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">School/College Name</label>
                        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Dhaka College" style={{ height: '48px' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Location/Address</label>
                        <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Dhanmondi, Dhaka" style={{ height: '48px' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contact Number (Optional)</label>
                        <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Institutional phone" style={{ height: '48px' }} />
                    </div>
                    <div className="modal-footer" style={{ border: 'none', padding: 0, marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1, height: '48px' }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px' }}>{editingSchool ? 'Update Details' : 'Save Institution'}</button>
                    </div>
                </form>
            </Modal>

            {/* School Student List Sidebar-style Modal */}
            <Modal
                isOpen={!!viewingSchool}
                onClose={() => setViewingSchool(null)}
                title={viewingSchool?.name}
                maxWidth={500}
            >
                {viewingSchool && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>Quick Stats</div>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '20px', fontWeight: 900 }}>{viewingSchool.studentCount}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800 }}>TOTAL STUDENTS</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '20px', fontWeight: 900 }}>{new Set(students.filter(s => s.school_id === viewingSchool.id).flatMap(s => s.batch_ids || [])).size}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800 }}>ACTIVE BATCHES</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Enrolled Students</div>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {students.filter(s => s.school_id === viewingSchool.id).length === 0 ? (
                                <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No students mapped yet.</p>
                            ) : students.filter(s => s.school_id === viewingSchool.id).map(student => (
                                <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                                        {student.name.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: '14px' }}>{student.name}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Grade {student.grade}</div>
                                    </div>
                                    <ChevronRight size={14} opacity={0.3} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
