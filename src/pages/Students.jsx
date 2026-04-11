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
    const [filterSchool, setFilterSchool] = useState('');
    const [schoolList, setSchoolList] = useState([]);
    const [form, setForm] = useState({
        name: '', email: '', phone: '', guardianName: '', guardianPhone: '',
        school: '', grade: '', address: '', notes: '', batchIds: [], unenrolledBatchIds: [],
    });

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [studentData, allBatches, attSnap, examSnap, hwSnap] = await Promise.all([
                studentService.getStudentsByTeacher(uid),
                batchService.getBatches(uid),
                supabase.from('attendance_records').select('*').eq('teacher_id', uid),
                supabase.from('exams').select('*').eq('teacher_id', uid),
                supabase.from('homeworks').select('*').eq('teacher_id', uid),
            ]);
            
            setStudents(studentData);

            const schools = [...new Set(studentData.map(s => s.school).filter(Boolean))];
            setSchoolList(schools);

            setBatches(allBatches);
            setAttendance(attSnap.data || []);
            setExams(examSnap.data || []);
            setHomeworks(hwSnap.data || []);
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
            school: '', grade: '', address: '', notes: '', batchIds: [], unenrolledBatchIds: [],
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
            unenrolledBatchIds: student.unenrolledBatchIds || [],
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
                school: form.school,
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
            } else {
                const { data: res, error } = await supabase
                    .from('students')
                    .insert(data)
                    .select()
                    .single();
                if (error) throw error;
                studentId = res.id;
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
            setShowSuccessModal(true);
        } catch (err) {
            console.error('Error saving student:', err);
            toast.error('Could not save student.');
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

    function setBatchStatus(batchId, status) {
        setForm((prev) => {
            const newBatchIds = (prev.batchIds || []).filter(id => id !== batchId);
            const newUnenrolled = (prev.unenrolledBatchIds || []).filter(id => id !== batchId);
            if (status === 'enrolled') newBatchIds.push(batchId);
            if (status === 'unenrolled') newUnenrolled.push(batchId);
            return { ...prev, batchIds: newBatchIds, unenrolledBatchIds: newUnenrolled };
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
            const matchesSchool = !filterSchool || s.school === filterSchool;
            return matchesSearch && matchesBatch && matchesStatus && matchesSchool;
        });
    }, [students, search, filterBatch, viewMode, filterSchool]);

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
                        if (!topicsPerformance[topic]) topicsPerformance[topic] = { count: 0, diffSum: 0 };
                        topicsPerformance[topic].diffSum += diff;
                        topicsPerformance[topic].count += 1;
                    });
                }
            }
        });

        const analyzedTopics = Object.entries(topicsPerformance).map(([topic, data]) => ({ topic, avgDiff: data.diffSum / data.count }));
        analyzedTopics.sort((a, b) => b.avgDiff - a.avgDiff);

        return {
            attRate, avgScore, hwRate,
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
                    toast.error('Parse Interrupted: Invalid CSV Structure');
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
        link.setAttribute("download", "students_template.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

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
                    school: row.school || '',
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

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Student Management</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Student List</h1>
                    <p className="page-subtitle" style={{ fontWeight: 600 }}>View and manage your student details</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => { setShowImportModal(true); setCsvPreview([]); }} style={{ padding: '0 20px', height: '48px', fontWeight: 800 }}>
                        <Upload size={18} /> IMPORT LIST
                    </button>
                    <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 24px', height: '48px', fontWeight: 900, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                        <Plus size={18} /> ADD STUDENT
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', marginBottom: 'var(--space-8)', background: 'rgba(255, 255, 255, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '12px' }}>
                        <button
                            className={`tab ${viewMode === 'enrolled' ? 'active' : ''}`}
                            onClick={() => { setViewMode('enrolled'); setCurrentPage(1); }}
                            style={{ borderRadius: '10px', padding: '8px 20px', fontSize: '13px', fontWeight: 800 }}
                        >
                            Active
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
                                placeholder="Find student..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                        </div>
                        <select
                            className="form-select"
                            style={{ width: '160px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
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
                            style={{ width: '160px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
                            value={filterSchool}
                            onChange={(e) => setFilterSchool(e.target.value)}
                        >
                            <option value="">All Schools</option>
                            {schoolList.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="glass-card" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={40} opacity={0.3} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>No students found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 32px', fontWeight: 500 }}>
                        Your student list is empty. Add your first student or import a file to get started.
                    </p>
                    {students.length === 0 && (
                        <button className="btn btn-primary" onClick={openCreate} style={{ padding: '0 32px', height: '48px', fontWeight: 900 }}>
                            <Plus size={18} /> ADD STUDENT
                        </button>
                    )}
                </div>
            ) : (
                <div className="glass-panel animate-fade-in-up" style={{ padding: '0', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.02)' }}>
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
                                    <th>Batches</th>
                                    <th>Contact Info</th>
                                    <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Joined {renderSortIcon('createdAt')}</div>
                                    </th>
                                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {paginatedStudents.map((student) => (
                                    <tr key={student.id} className="hover-lift" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: '14px',
                                                    background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 900, fontSize: '18px', border: '1px solid rgba(59, 130, 246, 0.2)'
                                                }}>
                                                    {student.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '15px' }}>{student.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{student.school || 'Private Student'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Grade">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Shield size={14} style={{ color: '#10b981' }} />
                                                <span style={{ fontSize: '13px', fontWeight: 700 }}>Grade {student.grade}</span>
                                            </div>
                                        </td>
                                        <td data-label="Batches">
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                {(student.batchIds || []).map((bid) => (
                                                    <span key={bid} style={{ padding: '3px 8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>{getBatchName(bid)}</span>
                                                ))}
                                                {(!student.batchIds || student.batchIds.length === 0) && (
                                                    <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 900 }}>NO BATCH</span>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Contact">
                                            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                                                <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{student.phone || '—'}</span>
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{student.email || ''}</span>
                                            </div>
                                        </td>
                                        <td data-label="Joined">
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'right' }}>
                                                {student.created_at ? format(new Date(student.created_at), 'MMM d, yyyy') : '—'}
                                            </div>
                                        </td>
                                        <td style={{ paddingRight: '20px' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(student)} title="View Stats" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                                                    <Eye size={18} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon" onClick={() => openEdit(student)} title="Edit Student" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                                                    <Edit2 size={18} />
                                                </button>
                                                <button 
                                                    className="btn btn-ghost btn-icon"
                                                    onClick={async () => {
                                                        const newStatus = (student.status || 'enrolled') === 'enrolled' ? 'unenrolled' : 'enrolled';
                                                        if (confirm(`Are you sure you want to ${newStatus === 'unenrolled' ? 'deactivate' : 'reactivate'} ${student.name}?`)) {
                                                            try {
                                                                const { error } = await supabase
                                                                    .from('students')
                                                                    .update({ status: newStatus })
                                                                    .eq('id', student.id);
                                                                if (error) throw error;
                                                                toast.success(`Status updated to ${newStatus}`);
                                                                loadData();
                                                            } catch (err) {
                                                                toast.error('Error updating status');
                                                            }
                                                        }
                                                    }}
                                                    title={student.status === 'unenrolled' ? 'Reactivate Student' : 'Deactivate Student'}
                                                    style={{ width: '36px', height: '36px', borderRadius: '10px', color: student.status === 'unenrolled' ? '#10b981' : '#f59e0b' }}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(student.id)} title="Delete Student" style={{ width: '36px', height: '36px', borderRadius: '10px' }}>
                                                    <Trash2 size={18} style={{ color: '#ef4444', opacity: 0.7 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {totalPages > 1 && (
                        <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                Displaying {(currentPage - 1) * studentsPerPage + 1}-{Math.min(currentPage * studentsPerPage, sortedStudents.length)} / {sortedStudents.length} students
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: 32, height: 32, borderRadius: 8 }}>
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: 900, padding: '0 8px' }}>{currentPage} <span style={{ opacity: 0.3, fontWeight: 400 }}>OF</span> {totalPages}</span>
                                <button className="btn btn-ghost btn-icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ width: 32, height: 32, borderRadius: 8 }}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Student Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingStudent ? 'Edit Student' : 'Add New Student'}
            >
                <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Full Name</label>
                            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Grade</label>
                            <select className="form-select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <option value="">Select</option>
                                <option value="9">Class 9</option>
                                <option value="10">Class 10</option>
                                <option value="11">Class 11</option>
                                <option value="12">Class 12</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Email Address</label>
                            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Phone Number</label>
                            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Enter phone" style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Guardian Name</label>
                            <input className="form-input" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Guardian Phone</label>
                            <input className="form-input" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: 'var(--color-text-muted)' }}>School Name</label>
                        <input className="form-input" list="school-suggestions" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="School/College name" style={{ height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                    
                    <div style={{ marginTop: '12px', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label className="form-label" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                            Batch Assignments
                        </label>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {batches.length === 0 ? (
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Create batches first to assign students.</p>
                            ) : batches.filter(b => !b.isClosed).map((b) => {
                                const isEnrolled = (form.batchIds || []).includes(b.id);
                                const isUnenrolled = (form.unenrolledBatchIds || []).includes(b.id);
                                return (
                                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ fontWeight: 800, fontSize: '13px' }}>{b.name}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button type="button" onClick={() => setBatchStatus(b.id, 'none')} className={`btn btn-sm ${!isEnrolled && !isUnenrolled ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '4px 12px', fontSize: '10px', height: '28px' }}>NONE</button>
                                            <button type="button" onClick={() => setBatchStatus(b.id, 'enrolled')} className={`btn btn-sm ${isEnrolled ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '4px 12px', fontSize: '10px', height: '28px', color: isEnrolled ? '#fff' : '#10b981' }}>ENROLL</button>
                                            <button type="button" onClick={() => setBatchStatus(b.id, 'unenrolled')} className={`btn btn-sm ${isUnenrolled ? 'btn-danger' : 'btn-ghost'}`} style={{ padding: '4px 12px', fontSize: '10px', height: '28px' }}>UNENROLL</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '0', marginTop: '12px', border: 'none', display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ flex: 1, height: '48px', fontWeight: 800 }}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: '48px', fontWeight: 900 }}>{editingStudent ? 'Save Changes' : 'Add Student'}</button>
                    </div>
                </form>
            </Modal>

            {/* Student Profile Modal */}
            <Modal
                isOpen={!!viewingStudent}
                onClose={() => setViewingStudent(null)}
                title={null}
                maxWidth={720}
            >
                {viewingStudent && viewingStats && (
                    <div style={{ margin: '-24px', position: 'relative' }}>
                        <div style={{ 
                            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)', 
                            padding: '60px 40px', 
                            color: 'white', 
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '24px 24px 0 0'
                        }}>
                             <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', filter: 'blur(60px)' }} />
                             <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, background: 'rgba(139, 92, 246, 0.2)', borderRadius: '50%', filter: 'blur(40px)' }} />
                            
                            <button className="btn btn-ghost btn-icon" onClick={() => setViewingStudent(null)} style={{ position: 'absolute', top: '24px', right: '24px', color: 'white', zIndex: 2, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
                                <X size={20} />
                            </button>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: 100, height: 100, borderRadius: '30px',
                                    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '44px', fontWeight: 900, color: '#fff', border: '2px solid rgba(255,255,255,0.15)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                                }}>
                                    {viewingStudent.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '36px', fontWeight: 900, margin: 0, letterSpacing: '-0.04em', color: 'white' }}>{viewingStudent.name}</h2>
                                    <div style={{ opacity: 0.8, fontSize: '15px', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Shield size={16} /> Class {viewingStudent.grade} | {viewingStudent.school || 'No school listed'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px' }}>
                                        {viewingStudent.batchIds?.map((bid) => (
                                            <span key={bid} style={{ background: 'rgba(59, 130, 246, 0.3)', padding: '4px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, border: '1px solid rgba(255,255,255,0.1)' }}>{getBatchName(bid)}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: '40px', background: 'var(--color-bg-primary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                                <div>
                                    <h3 style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.15em' }}>
                                        <Activity size={16} style={{ color: 'var(--color-primary)' }} /> STUDENT PROGRESS
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                        <div className="glass-panel" style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(20, 184, 166, 0.03)' }}>
                                            <div style={{ color: '#10b981', marginBottom: '12px' }}><Calendar size={24} style={{ margin: '0 auto' }} /></div>
                                            <div style={{ fontSize: '28px', fontWeight: 900 }}>{viewingStats.attRate}%</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendance</div>
                                        </div>
                                        <div className="glass-panel" style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.03)' }}>
                                            <div style={{ color: 'var(--color-primary)', marginBottom: '12px' }}><Award size={24} style={{ margin: '0 auto' }} /></div>
                                            <div style={{ fontSize: '28px', fontWeight: 900 }}>{viewingStats.avgScore}%</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exam Avg</div>
                                        </div>
                                        <div className="glass-panel" style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(139, 92, 246, 0.03)' }}>
                                            <div style={{ color: '#8b5cf6', marginBottom: '12px' }}><CheckCircle size={24} style={{ margin: '0 auto' }} /></div>
                                            <div style={{ fontSize: '28px', fontWeight: 900 }}>{viewingStats.hwRate}%</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completion</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="glass-panel" style={{ padding: '24px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontWeight: 900, fontSize: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            <TrendingUp size={16} /> STRENGTHS
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {viewingStats.strengths.length > 0 ? viewingStats.strengths.map(t => (
                                                <span key={t} style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>{t}</span>
                                            )) : <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Checking data...</span>}
                                        </div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', fontWeight: 900, fontSize: '12px', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            <TrendingDown size={16} /> WEAK AREAS
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {viewingStats.weaknesses.length > 0 ? viewingStats.weaknesses.map(t => (
                                                <span key={t} style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>{t}</span>
                                            )) : <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Doing well in all areas</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <div>
                                    <h3 style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.12em' }}>CONTACT INFO</h3>
                                    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)' }}>
                                        {viewingStudent.email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                                                <Mail size={18} style={{ color: 'var(--color-primary)', opacity: 0.6 }} /> 
                                                <span style={{ fontWeight: 600 }}>{viewingStudent.email}</span>
                                            </div>
                                        )}
                                        {viewingStudent.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                                                <Phone size={18} style={{ color: 'var(--color-primary)', opacity: 0.6 }} /> 
                                                <span style={{ fontWeight: 600 }}>{viewingStudent.phone}</span>
                                            </div>
                                        )}
                                        {viewingStudent.address && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px' }}>
                                                <MapPin size={18} style={{ color: 'var(--color-primary)', opacity: 0.6, marginTop: '2px' }} /> 
                                                <span style={{ color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{viewingStudent.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {viewingStudent.notes && (
                                    <div>
                                        <h3 style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.12em' }}>STUDENT NOTES</h3>
                                        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '14px', lineHeight: 1.6, borderLeft: '4px solid var(--color-primary)' }}>
                                            {viewingStudent.notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div style={{ padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--color-bg-primary)', borderRadius: '0 0 24px 24px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setViewingStudent(null); openEdit(viewingStudent); }} style={{ height: '40px', padding: '0 20px', fontWeight: 800 }}>EDIT STUDENT</button>
                            <button className="btn btn-primary btn-sm" onClick={() => setViewingStudent(null)} style={{ height: '40px', padding: '0 20px', fontWeight: 900 }}>CLOSE</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Bulk Import Modal */}
            <Modal
                isOpen={showImportModal}
                onClose={() => !isImporting && setShowImportModal(false)}
                title="Bulk Import Students"
            >
                <div>
                    <div style={{ padding: '40px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', marginBottom: '24px' }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '18px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={32} />
                        </div>
                        <h4 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>Select CSV File</h4>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>Import your student list from a standardized CSV file.</p>
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ color: 'var(--color-text-muted)', fontSize: '13px', display: 'block', margin: '0 auto' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                        <button className="btn btn-ghost btn-sm" onClick={downloadDemoCSV} style={{ fontWeight: 800 }}>
                            <Download size={14} /> DEMO TEMPLATE
                        </button>
                        {csvPreview.length > 0 && (
                            <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={14} /> {csvPreview.length} students found
                            </div>
                        )}
                    </div>

                    {csvPreview.length > 0 && (
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)' }}>
                            <table className="table table-compact" style={{ fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px' }}>Name</th>
                                        <th>Class</th>
                                        <th>School/College</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvPreview.slice(0, 5).map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px', fontWeight: 700 }}>{row.name}</td>
                                            <td>{row.grade}</td>
                                            <td>{row.school}</td>
                                        </tr>
                                    ))}
                                    {csvPreview.length > 5 && (
                                        <tr>
                                            <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>+ {csvPreview.length - 5} more students...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="modal-footer" style={{ padding: '0', border: 'none', display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" onClick={() => setShowImportModal(false)} style={{ flex: 1, height: '48px', fontWeight: 800 }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleImportCSV} disabled={isImporting || csvPreview.length === 0} style={{ flex: 2, height: '48px', fontWeight: 900 }}>
                            {isImporting ? 'Adding...' : 'Import Students'}
                        </button>
                    </div>
                </div>
            </Modal>
            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title=""
                hideClose
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ 
                        width: '80px', height: '80px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', 
                        borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        <Check size={40} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>Student Saved!</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px', fontSize: '16px', fontWeight: 500 }}>
                        The student's details have been updated and are now live in your list.
                    </p>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowSuccessModal(false)}
                        style={{ width: '100%', height: '48px', fontWeight: 900, borderRadius: '14px' }}
                    >
                        Got it!
                    </button>
                </div>
            </Modal>
        </div>
    );
}

function Box({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    );
}
