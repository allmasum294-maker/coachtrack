import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    Users, Plus, Edit2, Trash2, Search, X, Eye, Phone, Mail, School, MapPin, BookOpen, User, Calendar, Upload, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Activity, Award, CheckCircle, Shield, Sparkles, Filter, Check
} from 'lucide-react';
import { format } from 'date-fns';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { studentService } from '../services/studentService';
import { batchService } from '../services/batchService';
import { schoolService } from '../services/schoolService';
import Modal from '../components/Modal';

export default function Students() {
    const { userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [viewingStudent, setViewingStudent] = useState(null);
    const [search, setSearch] = useState('');
    const [filterBatch, setFilterBatch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [studentsPerPage, setStudentsPerPage] = useState(10);
    const [showImportModal, setShowImportModal] = useState(false);
    const [csvPreview, setCsvPreview] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [viewMode, setViewMode] = useState('enrolled');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [filterSchoolId, setFilterSchoolId] = useState('');
    const [form, setForm] = useState({
        name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
        schoolId: '', grade: '', address: '', notes: '', batchIds: [], status: 'enrolled'
    });
    const [schools, setSchools] = useState([]);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [studentData, allBatches, attSnap, examSnap, hwSnap, schoolData] = await Promise.all([
                studentService.getStudentsByTeacher(uid),
                batchService.getBatches(uid, true),
                supabase.from('attendance_records').select('*').eq('teacher_id', uid),
                supabase.from('exams').select('*').eq('teacher_id', uid),
                supabase.from('homeworks').select('*').eq('teacher_id', uid),
                schoolService.getSchools(uid)
            ]);
            
            setStudents(studentData);
            setSchools(schoolData);
            setBatches(allBatches);
            setAttendance(attSnap.data || []);
            setExams(examSnap.data || []);
            setHomeworks(hwSnap.data || []);
        } catch (err) {
            console.error('Error loading data:', err);
            toast.error('Could not load student data');
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingStudent(null);
        const lastSchool = localStorage.getItem('last_used_school') || '';
        const lastGrade = localStorage.getItem('last_used_grade') || '';
        
        setForm({
            name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
            schoolId: lastSchool, grade: lastGrade, address: '', notes: '', batchIds: [], status: 'enrolled'
        });
        setShowModal(true);
    }

    function openEdit(student) {
        setEditingStudent(student);
        setForm({
            name: student.name || '',
            email: student.email || '',
            phone: student.phone || '',
            guardianName: student.guardian_name || '',
            guardianPhone: student.guardian_phone || '',
            schoolId: student.school_id || '',
            grade: String(student.grade || ''),
            address: student.address || '',
            notes: student.notes || '',
            batchIds: student.batchIds || [],
            status: student.status || 'enrolled'
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                name: form.name,
                email: form.email,
                phone: form.phone,
                guardian_name: form.guardianName,
                guardian_phone: form.guardianPhone,
                school_id: form.schoolId || null,
                grade: parseInt(form.grade) || 0,
                address: form.address,
                notes: form.notes,
                teacher_id: userProfile.id,
                status: form.status || 'enrolled'
            };
            
            let studentId;
            if (editingStudent) {
                studentId = editingStudent.id;
                const { error } = await supabase
                    .from('students')
                    .update(data)
                    .eq('id', studentId);
                if (error) throw error;
                toast.success('Student updated');
            } else {
                const { data: res, error } = await supabase
                    .from('students')
                    .insert(data)
                    .select()
                    .single();
                if (error) throw error;
                studentId = res.id;
                toast.success('Student added');
                
                if (form.schoolId) localStorage.setItem('last_used_school', form.schoolId);
                if (form.grade) localStorage.setItem('last_used_grade', form.grade);
            }

            // Sync batches
            const oldBatchIds = editingStudent?.batchIds || [];
            const newBatchIds = form.batchIds || [];
            
            const toEnroll = newBatchIds.filter(id => !oldBatchIds.includes(id));
            const toUnenroll = oldBatchIds.filter(id => !newBatchIds.includes(id));

            await Promise.all([
                ...toEnroll.map(bid => studentService.enrollStudentInBatch(studentId, bid)),
                ...toUnenroll.map(bid => studentService.unenrollStudentFromBatch(studentId, bid))
            ]);

            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Error saving student:', err);
            toast.error(err.message || 'Could not save student.');
        }
    }

    async function handleDelete(studentId) {
        if (!confirm('Are you sure you want to remove this student?')) return;
        try {
            const { error } = await supabase
                .from('students')
                .delete()
                .eq('id', studentId);
            if (error) throw error;
            loadData();
            toast.success('Student removed');
        } catch (err) {
            console.error('Error deleting student:', err);
        }
    }

    function toggleBatch(batchId) {
        setForm(prev => {
            const ids = prev.batchIds || [];
            if (ids.includes(batchId)) {
                return { ...prev, batchIds: ids.filter(id => id !== batchId) };
            } else {
                return { ...prev, batchIds: [...ids, batchId] };
            }
        });
    }

    function handleSort(key) {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    }

    function renderSortIcon(key) {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    }

    const filteredStudents = useMemo(() => {
        return students.filter((s) => {
            const matchesSearch = (s.name || '').toLowerCase().includes(search.toLowerCase());
            const matchesBatch = !filterBatch || (s.batchIds || []).includes(filterBatch);
            const matchesStatus = (s.status || 'enrolled') === viewMode;
            const matchesSchool = !filterSchoolId || s.school_id === filterSchoolId;
            return matchesSearch && matchesBatch && matchesStatus && matchesSchool;
        });
    }, [students, search, filterBatch, viewMode, filterSchoolId]);

    const sortedStudents = useMemo(() => {
        let sortable = [...filteredStudents];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                if (sortConfig.key === 'createdAt') {
                    const aTime = new Date(a.created_at || 0).getTime();
                    const bTime = new Date(b.created_at || 0).getTime();
                    return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
                }
                const aVal = String(a[sortConfig.key] || '').toLowerCase();
                const bVal = String(b[sortConfig.key] || '').toLowerCase();
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredStudents, sortConfig]);

    const totalPages = Math.ceil(sortedStudents.length / studentsPerPage);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * studentsPerPage;
        return sortedStudents.slice(start, start + studentsPerPage);
    }, [sortedStudents, currentPage, studentsPerPage]);

    function getBatchName(batchId) {
        return batches.find((b) => b.id === batchId)?.name || batchId;
    }

    const viewingStats = useMemo(() => {
        if (!viewingStudent) return null;

        let totalClasses = 0;
        let presentClasses = 0;
        attendance.forEach((a) => {
            if (viewingStudent.batchIds?.includes(a.batch_id)) {
                // Assuming attendance record logs are in a separate query or nested
                // This logic might need refinement based on exact attendance storage
            }
        });

        const attRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        let totalHomeworks = 0;
        let completedHomeworks = 0;
        homeworks.forEach(hw => {
            const isRelevantBatch = viewingStudent.batchIds?.includes(hw.batch_id);
            const isRelevantSchool = !hw.target_school_id || hw.target_school_id === viewingStudent.school_id;

            if (isRelevantBatch && isRelevantSchool) {
                totalHomeworks++;
                // Check submissions
                if (hw.submissions?.[viewingStudent.id]?.status === 'completed') {
                    completedHomeworks++;
                }
            }
        });

        const hwRate = totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0;

        return { attRate, hwRate, strengths: [], weaknesses: [] };
    }, [viewingStudent, attendance, homeworks]);

    async function handleImportCSV() {
        if (csvPreview.length === 0) return toast.error('No student data found');
        setIsImporting(true);
        try {
            for (const row of csvPreview) {
                if (!row.name) continue;
                const data = {
                    name: row.name || '',
                    email: row.email || '',
                    phone: row.phone || '',
                    guardian_name: row.guardianName || '',
                    guardian_phone: row.guardianPhone || '',
                    school_id: schools.find(sch => sch.name.toLowerCase() === row.school?.toLowerCase())?.id || null,
                    grade: parseInt(row.grade) || 0,
                    address: row.address || '',
                    notes: row.notes || '',
                    teacher_id: userProfile.id,
                    status: 'enrolled'
                };
                const { data: res, error } = await supabase
                    .from('students')
                    .insert(data)
                    .select()
                    .single();
                
                if (error) throw error;

                if (filterBatch) {
                    await studentService.enrollStudentInBatch(res.id, filterBatch);
                }
            }
            toast.success(`Success: ${csvPreview.length} students added.`);
            setShowImportModal(false);
            setCsvPreview([]);
            loadData();
        } catch (err) {
            console.error('Error importing students:', err);
            toast.error('Some students failed to import.');
        } finally {
            setIsImporting(false);
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    toast.error('Parse Interrupted: Invalid CSV');
                    return;
                }
                setCsvPreview(results.data);
            }
        });
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Student Management</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Student Registry</h1>
                    <p className="page-subtitle" style={{ fontWeight: 600 }}>Manage performance and affiliations for {students.length} students</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="tooltip-wrapper">
                        <button className="btn btn-secondary btn-comfort" onClick={() => { setShowImportModal(true); setCsvPreview([]); }} style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Upload size={20} />
                        </button>
                        <span className="tooltip">Import Students</span>
                    </div>
                    <div className="tooltip-wrapper">
                        <button className="btn btn-primary btn-comfort" onClick={openCreate} style={{ boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                            <Plus size={24} />
                        </button>
                        <span className="tooltip">Add Student</span>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: 'var(--space-8)', background: 'rgba(255, 255, 255, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                    <div style={{ display: 'flex', background: 'var(--color-bg-glass)', padding: '4px', borderRadius: '12px', border: '1px solid var(--color-border-glass)' }}>
                        <button
                            className={`tab ${viewMode === 'enrolled' ? 'active' : ''}`}
                            onClick={() => { setViewMode('enrolled'); setCurrentPage(1); }}
                            style={{ borderRadius: '10px', padding: '8px 20px', fontSize: '13px', fontWeight: 800 }}
                        >
                            Active Students
                        </button>
                        <button
                            className={`tab ${viewMode === 'unenrolled' ? 'active' : ''}`}
                            onClick={() => { setViewMode('unenrolled'); setCurrentPage(1); }}
                            style={{ borderRadius: '10px', padding: '8px 20px', fontSize: '13px', fontWeight: 800 }}
                        >
                            Inactive
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px', justifyContent: 'flex-end' }}>
                        <div className="search-bar" style={{ flex: 1, maxWidth: '300px' }}>
                            <Search className="search-icon" size={16} />
                            <input
                                className="form-input"
                                placeholder="Search students..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>
                        <select
                            className="form-select"
                            style={{ width: '160px', height: '44px', borderRadius: '12px' }}
                            value={filterBatch}
                            onChange={(e) => setFilterBatch(e.target.value)}
                        >
                            <option value="">All Batches</option>
                            {batches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <select
                            className="form-select"
                            style={{ width: '160px', height: '44px', borderRadius: '12px' }}
                            value={filterSchoolId}
                            onChange={(e) => setFilterSchoolId(e.target.value)}
                        >
                            <option value="">All Schools</option>
                            {schools.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {paginatedStudents.length === 0 ? (
                <div className="glass-card" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={32} opacity={0.3} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 900 }}>No students matching filters</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '300px', margin: '12px auto' }}>Try adjusting your search or filters to find the student you're looking for.</p>
                </div>
            ) : (
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Student {renderSortIcon('name')}</div>
                                    </th>
                                    <th onClick={() => handleSort('grade')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Grade {renderSortIcon('grade')}</div>
                                    </th>
                                    <th>Institutional Affiliation</th>
                                    <th>Batches</th>
                                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedStudents.map((student) => (
                                    <tr key={student.id} className="hover-lift">
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: '12px',
                                                    background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 900, border: '1px solid rgba(59, 130, 246, 0.2)'
                                                }}>
                                                    {student.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '14px' }}>{student.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{student.phone || 'No phone'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Grade">
                                            <span style={{ fontSize: '13px', fontWeight: 700 }}>Class {student.grade}</span>
                                        </td>
                                        <td data-label="School">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                                                <School size={14} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
                                                {student.schools?.name || student.school || <span style={{ opacity: 0.3 }}>Private</span>}
                                            </div>
                                        </td>
                                        <td data-label="Batches">
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {(student.batchIds || []).map((bid) => (
                                                    <span key={bid} style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>{getBatchName(bid)}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ paddingRight: '20px' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(student)} title="View Stats">
                                                    <Activity size={18} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(student)} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(student.id)} title="Delete">
                                                    <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-glass)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                {sortedStudents.length} Students Total
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: 900 }}>{currentPage} / {totalPages}</span>
                                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modals (Maintain Logic, Apply Style) */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingStudent ? 'Edit Student Profile' : 'Register New Student'}
            >
                <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Full Name</label>
                        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Grade / Class</label>
                            <select className="form-select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} required>
                                <option value="">Select Grade</option>
                                {[8,9,10,11,12].map(g => <option key={g} value={g}>Class {g}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Institution</label>
                            <select className="form-select" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                                <option value="">Select School (Optional)</option>
                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Phone</label>
                            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Email</label>
                            <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', color: 'var(--color-primary)' }}>Batch Enrollment</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {batches.map(b => (
                                <button
                                    key={b.id}
                                    type="button"
                                    className={`btn btn-sm ${form.batchIds.includes(b.id) ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => toggleBatch(b.id)}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-footer" style={{ border: 'none', padding: 0, marginTop: '12px' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px', fontWeight: 900 }}>
                            {editingStudent ? 'Update Records' : 'Register Student'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Student Profile Modal */}
            <Modal
                isOpen={!!viewingStudent}
                onClose={() => setViewingStudent(null)}
                title={null}
                maxWidth={700}
            >
                {viewingStudent && (
                    <div style={{ margin: '-24px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #020617 0%, #1e1b4b 100%)', padding: '40px', color: 'white', position: 'relative', overflow: 'hidden' }}>
                             <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', filter: 'blur(60px)' }} />
                             
                             <div style={{ display: 'flex', alignItems: 'center', gap: '24px', position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '24px',
                                    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '32px', fontWeight: 900, border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {viewingStudent.name?.charAt(0)}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '28px', fontWeight: 900, margin: 0 }}>{viewingStudent.name}</h2>
                                    <div style={{ opacity: 0.7, fontSize: '14px', marginTop: '4px', fontWeight: 600 }}>Class {viewingStudent.grade} • {viewingStudent.schools?.name || 'Private'}</div>
                                </div>
                             </div>
                        </div>
                        <div style={{ padding: '32px', background: 'var(--color-bg-primary)', borderRadius: '0 0 24px 24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Attendance</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-accent)' }}>{viewingStats?.attRate}%</div>
                                </div>
                                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Homework</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-primary)' }}>{viewingStats?.hwRate}%</div>
                                </div>
                                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Performance</div>
                                    <div style={{ fontSize: '20px', fontWeight: 900 }}>B+</div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                <div>
                                    <h4 style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Personal Info</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Phone size={14} opacity={0.5} /> {viewingStudent.phone || 'N/A'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><Mail size={14} opacity={0.5} /> {viewingStudent.email || 'N/A'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}><MapPin size={14} opacity={0.5} /> {viewingStudent.address || 'N/A'}</div>
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px' }}>Guardian Details</h4>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', fontSize: '13px' }}>
                                        <div style={{ fontWeight: 800 }}>{viewingStudent.guardian_name || 'Not Listed'}</div>
                                        <div style={{ opacity: 0.6, marginTop: '2px' }}>{viewingStudent.guardian_phone || ''}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <button className="btn btn-primary" onClick={() => setViewingStudent(null)} style={{ width: '100%', marginTop: '32px', height: '44px' }}>Close Profile</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Bulk Import Modal */}
            <Modal
                isOpen={showImportModal}
                onClose={() => !isImporting && setShowImportModal(false)}
                title="Bulk student Import"
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ 
                        padding: '40px', border: '2px dashed var(--color-border-glass)', 
                        borderRadius: '20px', background: 'rgba(255,255,255,0.01)',
                        marginBottom: '24px'
                    }}>
                        <Upload size={40} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
                        <h4 style={{ fontWeight: 800, marginBottom: '8px' }}>Upload Student List (CSV)</h4>
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ fontSize: '12px' }} />
                    </div>
                    {csvPreview.length > 0 && (
                        <div style={{ marginBottom: '24px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-success)', marginBottom: '8px' }}>✓ {csvPreview.length} Students Detected</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Top entries: {csvPreview.slice(0, 3).map(r => r.name).join(', ')}...</div>
                        </div>
                    )}
                    <button className="btn btn-primary" onClick={handleImportCSV} disabled={isImporting || csvPreview.length === 0} style={{ width: '100%', height: '48px' }}>
                        {isImporting ? 'Importing Data...' : 'Confirm Import'}
                    </button>
                </div>
            </Modal>
        </div>
    );
}
