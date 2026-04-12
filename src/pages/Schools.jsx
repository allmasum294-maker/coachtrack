import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    Layers, Plus, Edit2, Trash2, Search, X, 
    School as SchoolIcon, MapPin, Phone, Users, ChevronRight,
    ArrowRight, Activity, TrendingUp, Building2, Map, Sparkles
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
            {/* Header Area */}
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ 
                            padding: '4px 10px', 
                            background: 'rgba(20, 184, 166, 0.1)', 
                            color: 'var(--color-accent)', 
                            borderRadius: '8px', 
                            fontSize: '10px', 
                            fontWeight: 900, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em' 
                        }}>Institutional Registry</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Schools & Colleges</h1>
                    <p className="page-subtitle" style={{ fontWeight: 600 }}>Manage institutional targeting and student affiliations</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="tooltip-wrapper">
                        <button className="btn btn-primary btn-comfort" onClick={openCreate} style={{ boxShadow: '0 8px 20px rgba(20, 184, 166, 0.2)' }}>
                            <Plus size={24} />
                        </button>
                        <span className="tooltip">Add Institution</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="glass-panel" style={{ padding: '20px', marginBottom: 'var(--space-8)', background: 'rgba(255, 255, 255, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
                        <Search className="search-icon" size={16} />
                        <input
                            className="form-input"
                            placeholder="Find institution by name or address..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={16} /> {schools.length} Total
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            {filteredSchools.length === 0 ? (
                <div className="glass-card" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SchoolIcon size={40} opacity={0.3} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>No institutions found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 32px', fontWeight: 500 }}>
                        Add your first school or college to start organizing your students and assignments.
                    </p>
                    <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 32px', height: '48px', fontWeight: 900 }}>
                        <Plus size={18} /> ADD INSTITUTION
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                    {filteredSchools.map((school) => (
                        <div key={school.id} className="glass-card hover-lift" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div style={{ 
                                        width: '48px', height: '48px', borderRadius: '14px', 
                                        background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-accent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid rgba(20, 184, 166, 0.2)'
                                    }}>
                                        <SchoolIcon size={24} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(school)} style={{ width: '32px', height: '32px' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(school.id)} style={{ width: '32px', height: '32px', color: '#ef4444' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px', color: 'var(--color-text-primary)' }}>{school.name}</h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                        <MapPin size={14} style={{ opacity: 0.6 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school.address || 'No address listed'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                        <Phone size={14} style={{ opacity: 0.6 }} />
                                        <span>{school.phone || 'No phone provided'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ 
                                padding: '16px 24px', 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 800, color: 'var(--color-accent)' }}>
                                        <Users size={14} /> {school.studentCount || 0} Students
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Target Active <Sparkles size={12} style={{ color: 'var(--color-gold)' }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* School Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingSchool ? 'Edit Institution' : 'Add New Institution'}
            >
                <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Institution Name</label>
                        <input 
                            className="form-input" 
                            value={form.name} 
                            onChange={(e) => setForm({ ...form, name: e.target.value })} 
                            required 
                            placeholder="e.g. Dhaka Residential Model College"
                            style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Location / Address</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={16} style={{ position: 'absolute', left: '14px', top: '16px', opacity: 0.4 }} />
                            <input 
                                className="form-input" 
                                value={form.address} 
                                onChange={(e) => setForm({ ...form, address: e.target.value })} 
                                placeholder="Enter full address"
                                style={{ height: '48px', paddingLeft: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} 
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Contact Information</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} style={{ position: 'absolute', left: '14px', top: '16px', opacity: 0.4 }} />
                            <input 
                                className="form-input" 
                                value={form.phone} 
                                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                                placeholder="Phone, Email, or Website"
                                style={{ height: '48px', paddingLeft: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} 
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '0', marginTop: '12px', border: 'none', display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1, height: '48px', fontWeight: 800 }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px', fontWeight: 900, background: 'var(--color-accent)' }}>{editingSchool ? 'Update Institution' : 'Register Institution'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
