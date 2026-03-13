import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
    Users, Plus, Edit2, Trash2, Search, X, Eye, Phone, Mail, School, MapPin, BookOpen, User, Calendar, Upload, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Activity, Award, CheckCircle
} from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export default function Students() {
    const { currentUser } = useAuth();
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
    const [form, setForm] = useState({
        name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
        school: '', grade: '', address: '', notes: '', batchIds: [],
    });

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [studentSnap, batchSnap, attSnap, examSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
            const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
            const matchesBatch = !filterBatch || (s.batchIds || []).includes(filterBatch);
            return matchesSearch && matchesBatch;
        });
    }, [students, search, filterBatch]);

    const sortedStudents = useMemo(() => {
        let sortable = [...filteredStudents];
        if (sortConfig !== null) {
            sortable.sort((a, b) => {
                if (sortConfig.key === 'createdAt') {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
                }
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
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

    // Collect unique school/college names for autocomplete
    const schoolSuggestions = useMemo(() => {
        const names = students.map((s) => s.school).filter(Boolean);
        return [...new Set(names)];
    }, [students]);

    const viewingStats = useMemo(() => {
        if (!viewingStudent) return null;

        let totalClasses = 0;
        let presentClasses = 0;
        
        attendance.forEach((a) => {
            if (viewingStudent.batchIds?.includes(a.batchId)) {
                (a.records || []).forEach(r => {
                    if (r.studentId === viewingStudent.id) {
                        totalClasses++;
                        if (r.status === 'present') presentClasses++;
                    }
                });
            }
        });

        const attRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

        let totalExamMarks = 0;
        let totalMarksEarned = 0;

        exams.forEach(e => {
            if (viewingStudent.batchIds?.includes(e.batchId)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === viewingStudent.id);
                if (sScore) {
                    totalExamMarks += e.totalMarks;
                    totalMarksEarned += sScore.marksObtained;
                }
            }
        });

        const avgScore = totalExamMarks > 0 ? Math.round((totalMarksEarned / totalExamMarks) * 100) : 0;

        let totalHomeworks = 0;
        let completedHomeworks = 0;

        homeworks.forEach(hw => {
            if (viewingStudent.batchIds?.includes(hw.batchId)) {
                totalHomeworks++;
                if ((hw.completedBy || []).includes(viewingStudent.id)) {
                    completedHomeworks++;
                }
            }
        });

        const hwRate = totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : 0;

        const topicsPerformance = {};
        exams.forEach(e => {
            if (viewingStudent.batchIds?.includes(e.batchId)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === viewingStudent.id);
                if (sScore && sScore.topicMarks) {
                    const batchTopicSums = {};
                    const batchTopicCounts = {};
                    e.scores.forEach(score => {
                        if (score.topicMarks) {
                            Object.entries(score.topicMarks).forEach(([topic, mark]) => {
                                const val = parseFloat(mark) || 0;
                                batchTopicSums[topic] = (batchTopicSums[topic] || 0) + val;
                                batchTopicCounts[topic] = (batchTopicCounts[topic] || 0) + 1;
                            });
                        }
                    });

                    Object.entries(sScore.topicMarks).forEach(([topic, mark]) => {
                        const studentVal = parseFloat(mark) || 0;
                        const batchAvg = batchTopicSums[topic] / (batchTopicCounts[topic] || 1); 
                        const diff = studentVal - batchAvg;
                        
                        if (!topicsPerformance[topic]) {
                            topicsPerformance[topic] = { count: 0, diffSum: 0 };
                        }
                        topicsPerformance[topic].diffSum += diff;
                        topicsPerformance[topic].count += 1;
                    });
                }
            }
        });

        const analyzedTopics = Object.entries(topicsPerformance).map(([topic, data]) => {
            return { topic, avgDiff: data.diffSum / data.count };
        });
        analyzedTopics.sort((a, b) => b.avgDiff - a.avgDiff);

        return {
            attRate,
            avgScore,
            hwRate,
            strengths: analyzedTopics.filter(t => t.avgDiff >= 0).slice(0, 3).map(t => t.topic),
            weaknesses: [...analyzedTopics].reverse().filter(t => t.avgDiff < 0).slice(0, 3).map(t => t.topic)
        };
    }, [viewingStudent, attendance, exams, homeworks]);

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    toast.error('Error parsing CSV');
                    return;
                }
                setCsvPreview(results.data);
            }
        });
    }

    function downloadDemoCSV() {
        const csvContent = "data:text/csv;charset=utf-8,name,email,phone,guardianName,guardianPhone,school,grade,address,notes\nJohn Doe,john@example.com,1234567890,Jane Doe,0987654321,XYZ School,10,123 Main St,Needs extra help in math";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "students_demo.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function handleImportCSV() {
        if (csvPreview.length === 0) return toast.error('No valid data to import');
        setIsImporting(true);
        try {
            const promises = csvPreview.map(row => {
                if (!row.name) return Promise.resolve(); // Skip rows without name
                const data = {
                    name: row.name || '',
                    email: row.email || '',
                    phone: row.phone || '',
                    guardianName: row.guardianName || '',
                    guardianPhone: row.guardianPhone || '',
                    school: row.school || '',
                    grade: parseInt(row.grade) || 0,
                    address: row.address || '',
                    notes: row.notes || '',
                    batchIds: filterBatch ? [filterBatch] : [],
                    teacherId: currentUser.uid,
                    createdAt: serverTimestamp(),
                };
                return addDoc(collection(db, 'students'), data);
            });
            await Promise.all(promises);
            toast.success(`Imported ${csvPreview.length} students successfully!`);
            setShowImportModal(false);
            setCsvPreview([]);
            loadData();
        } catch (err) {
            console.error('Error importing:', err);
            toast.error('Failed to import some students');
        } finally {
            setIsImporting(false);
        }
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
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-secondary" onClick={() => { setShowImportModal(true); setCsvPreview([]); }}>
                        <Upload size={18} /> Import CSV
                    </button>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={18} /> Add Student
                    </button>
                </div>
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
                <div>
                    <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>Name {renderSortIcon('name')}</th>
                                <th onClick={() => handleSort('grade')} style={{ cursor: 'pointer', userSelect: 'none' }}>Grade {renderSortIcon('grade')}</th>
                                <th onClick={() => handleSort('school')} style={{ cursor: 'pointer', userSelect: 'none' }}>School {renderSortIcon('school')}</th>
                                <th>Batches</th>
                                <th>Contact</th>
                                <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>Added {renderSortIcon('createdAt')}</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStudents.map((student) => (
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
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                            {student.createdAt?.toDate ? student.createdAt.toDate().toLocaleDateString() : '—'}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                            <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(student)} title="View details">
                                                <Eye size={16} />
                                            </button>
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
                    
                    {/* Pagination Controls */}
                    {sortedStudents.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Show</span>
                                <select 
                                    className="form-select" 
                                    style={{ width: 70, padding: 'var(--space-1) var(--space-2)' }}
                                    value={studentsPerPage} 
                                    onChange={(e) => { setStudentsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-2)' }}>
                                    Showing {(currentPage - 1) * studentsPerPage + 1} to {Math.min(currentPage * studentsPerPage, sortedStudents.length)} of {sortedStudents.length} entries
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                <button className="btn btn-secondary btn-icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    <ChevronLeft size={16} />
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button className="btn btn-secondary btn-icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
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
                                    <label className="form-label">School/College</label>
                                    <input className="form-input" list="school-suggestions" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="Start typing to see suggestions..." />
                                    <datalist id="school-suggestions">
                                        {schoolSuggestions.map((name, i) => (
                                            <option key={i} value={name} />
                                        ))}
                                    </datalist>
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

            {/* View Student Detail Modal */}
            {viewingStudent && (
                <div className="modal-overlay" onClick={() => setViewingStudent(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, padding: 0, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', padding: 'var(--space-6)', color: 'white', position: 'relative' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(null)} style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', color: 'white' }}>
                                <X size={20} />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div style={{
                                    width: 72, height: 72, borderRadius: 'var(--radius-full)',
                                    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '28px', fontWeight: 800, color: '#fff', border: '2px solid rgba(255,255,255,0.4)'
                                }}>
                                    {viewingStudent.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{viewingStudent.name}</h2>
                                    <div style={{ opacity: 0.9, fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>Class {viewingStudent.grade} | {viewingStudent.school || 'No School specified'}</div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                                        {(viewingStudent.batchIds || []).map((bid) => (
                                            <span key={bid} style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{getBatchName(bid)}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: 'var(--space-6)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 'var(--space-6)' }}>
                                
                                {/* Left Column: System Stats */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                                    
                                    {/* Performance Overview */}
                                    <div>
                                        <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Activity size={16} /> Performance Overview
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--color-teal)', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><Calendar size={20} /></div>
                                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{viewingStats?.attRate}%</div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Attendance</div>
                                            </div>
                                            <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--color-blue)', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><Award size={20} /></div>
                                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{viewingStats?.avgScore}%</div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Avg Score</div>
                                            </div>
                                            <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--color-purple)', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}><CheckCircle size={20} /></div>
                                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{viewingStats?.hwRate}%</div>
                                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Homework</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Strengths & Weaknesses */}
                                    <div>
                                        <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>Topic Analysis</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                            <div style={{ background: 'var(--color-success-soft)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                                                    <TrendingUp size={16} /> Top Strengths
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {viewingStats?.strengths?.length > 0 ? viewingStats.strengths.map(t => (
                                                        <span key={t} style={{ background: '#fff', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{t}</span>
                                                    )) : <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>Not enough data</span>}
                                                </div>
                                            </div>
                                            <div style={{ background: 'var(--color-danger-soft)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                                                    <TrendingDown size={16} /> Areas to Improve
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                    {viewingStats?.weaknesses?.length > 0 ? viewingStats.weaknesses.map(t => (
                                                        <span key={t} style={{ background: '#fff', color: 'var(--color-danger)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{t}</span>
                                                    )) : <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>Not enough data</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Contact & Personal Info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--space-5)' }}>
                                    
                                    <div>
                                        <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <User size={16} /> Contact Details
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                            {viewingStudent.email && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                                    <Mail size={15} style={{ color: 'var(--color-text-muted)', marginTop: '2px' }} />
                                                    <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{viewingStudent.email}</div>
                                                </div>
                                            )}
                                            {viewingStudent.phone && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                                    <Phone size={15} style={{ color: 'var(--color-text-muted)', marginTop: '2px' }} />
                                                    <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{viewingStudent.phone}</div>
                                                </div>
                                            )}
                                            {viewingStudent.address && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                                    <MapPin size={15} style={{ color: 'var(--color-text-muted)', marginTop: '2px' }} />
                                                    <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{viewingStudent.address}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {(viewingStudent.guardianName || viewingStudent.guardianPhone) && (
                                        <div>
                                            <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Guardian</h3>
                                            <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{viewingStudent.guardianName || '—'}</div>
                                                {viewingStudent.guardianPhone && (
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{viewingStudent.guardianPhone}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {viewingStudent.notes && (
                                        <div>
                                            <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Notes</h3>
                                            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                                                {viewingStudent.notes}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-footer" style={{ background: 'var(--color-surface-2)', borderTop: '1px solid var(--color-border)', margin: 0 }}>
                            <button className="btn btn-secondary" onClick={() => { setViewingStudent(null); openEdit(viewingStudent); }}>Edit Profile</button>
                            <button className="btn btn-primary" onClick={() => setViewingStudent(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Import Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => !isImporting && setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Bulk Import Students</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => !isImporting && setShowImportModal(false)} disabled={isImporting}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    Upload a CSV file containing your student records.
                                </p>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadDemoCSV} disabled={isImporting}>
                                    <Download size={14} style={{ marginRight: '4px' }} /> Demo Template
                                </button>
                            </div>
                            
                            <div className="form-group">
                                <input type="file" accept=".csv" className="form-input" onChange={handleFileUpload} disabled={isImporting} />
                            </div>

                            {csvPreview.length > 0 && (
                                <div style={{ marginTop: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <h4 style={{ fontWeight: 600 }}>Preview ({csvPreview.length} rows)</h4>
                                    </div>
                                    <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        <table className="table" style={{ fontSize: 'var(--font-size-xs)' }}>
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Phone</th>
                                                    <th>Grade</th>
                                                    <th>School</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {csvPreview.slice(0, 50).map((row, i) => (
                                                    <tr key={i}>
                                                        <td>{row.name || '—'}</td>
                                                        <td>{row.email || '—'}</td>
                                                        <td>{row.phone || '—'}</td>
                                                        <td>{row.grade || '—'}</td>
                                                        <td>{row.school || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {csvPreview.length > 50 && (
                                            <div style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                                Showing first 50 rows...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleImportCSV} disabled={isImporting || csvPreview.length === 0}>
                                {isImporting ? 'Importing...' : 'Import Students'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
