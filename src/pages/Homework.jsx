import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { BookOpen, Plus, Edit2, Trash2, X, CheckSquare, Square, Calendar, Clock, AlertTriangle, FileEdit, Filter, ChevronRight, Info, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { homeworkService } from '../services/homeworkService';
import { lessonPlanService } from '../services/lessonPlanService';
import { schoolService } from '../services/schoolService';
import Modal from '../components/Modal';

const STATUSES = [
    { value: 'completed', label: '✅ Completed', color: 'var(--color-success)' },
    { value: 'late', label: '⏰ Late', color: 'var(--color-warning)' },
    { value: 'partial', label: '½ Partial', color: 'var(--color-primary)' },
    { value: 'not_submitted', label: '❌ Not Submitted', color: 'var(--color-danger)' },
];

export default function Homework() {
    const { userProfile } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [schools, setSchools] = useState([]);
    const [students, setStudents] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, pending, overdue, completed
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [showModal, setShowModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [form, setForm] = useState({
        title: '',
        batchId: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        sessionLogId: '',
        variants: [{ schoolId: '', description: '' }]
    });

    const [trackingAssignment, setTrackingAssignment] = useState(null);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            setLoading(true);
            const uid = userProfile.id;

            const [hwRes, btRes, stRes, lgRes, schRes] = await Promise.allSettled([
                homeworkService.getHomeworkByTeacher(uid),
                batchService.getBatches(uid, true),
                studentService.getStudentsByTeacher(uid),
                lessonPlanService.getLessonsByTeacher(uid),
                schoolService.getSchools(uid)
            ]);

            if (hwRes.status === 'fulfilled') setAssignments(hwRes.value || []);
            if (btRes.status === 'fulfilled') setBatches(btRes.value || []);
            if (stRes.status === 'fulfilled') setStudents(stRes.value || []);
            if (lgRes.status === 'fulfilled') setSessionLogs(lgRes.value || []);
            if (schRes.status === 'fulfilled') setSchools(schRes.value || []);

        } catch (err) {
            console.error('Error loading data:', err);
            toast.error('Could not load homework data');
        } finally {
            setLoading(false);
        }
    }

    // Consolidated Assignments (Grouped by group_id)
    const groupedAssignments = useMemo(() => {
            const groups = {};

            assignments.forEach(hw => {
                const gid = hw.group_id || hw.id; // Fallback for old records
                if (!groups[gid]) {
                    groups[gid] = {
                        id: gid,
                        title: hw.title,
                        batchId: hw.batch_id,
                        dueDate: hw.due_date,
                        sessionLogId: hw.session_log_id,
                        isFinished: hw.is_finished,
                        variants: [],
                        allSubmissions: {}
                    };
                }
                groups[gid].variants.push({
                    id: hw.id,
                    schoolId: hw.target_school_id,
                    description: hw.description
                });
                // Merge submissions
                Object.assign(groups[gid].allSubmissions, hw.submissions || {});
            });

            const list = Object.values(groups).map(g => {
                // Calculate aggregate stats
                const assignedStudents = students.filter(s => {
                    const inBatch = (s.batchIds || []).includes(g.batchId);
                    const targetedSchools = g.variants.map(v => v.schoolId).filter(Boolean);
                    const matchesSchool = targetedSchools.length === 0 || targetedSchools.includes(s.school_id);
                    return inBatch && matchesSchool;
                });

                let completed = 0, late = 0, partial = 0, notSubmitted = 0;
                assignedStudents.forEach(s => {
                    const sub = g.allSubmissions[s.id];
                    if (!sub || !sub.status || sub.status === 'not_submitted') notSubmitted++;
                    else if (sub.status === 'completed') completed++;
                    else if (sub.status === 'late') late++;
                    else if (sub.status === 'partial') partial++;
                });

                const total = assignedStudents.length;
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                // Determine Status
                const d = new Date(g.dueDate);
                d.setHours(23, 59, 59, 999);
                const isOverdue = !g.isFinished && d < new Date();

                let status = 'pending';
                if (g.isFinished) status = 'completed';
                else if (isOverdue) status = 'overdue';

                return { ...g, stats: { total, completed, late, partial, notSubmitted, progress }, status };
            });

            // Filter
            return list
                .filter(g => !filterBatch || g.batchId === filterBatch)
                .filter(g => filterStatus === 'all' || g.status === filterStatus)
                .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
        }, [assignments, students, filterBatch, filterStatus]);

        const paginatedAssignments = useMemo(() => {
            const start = (currentPage - 1) * pageSize;
            return groupedAssignments.slice(start, start + pageSize);
        }, [groupedAssignments, currentPage]);

        const totalPages = Math.ceil(groupedAssignments.length / pageSize);

        async function handleSave(e) {
            e.preventDefault();
            try {
                const gid = editingAssignment ? editingAssignment.id : crypto.randomUUID();

                if (editingAssignment) {
                    // For editing, we update all variants in the group
                    // In this simple version, we'll delete and re-insert to keep it clean
                    await homeworkService.deleteHomeworkGroup(gid);
                }

                const baseData = {
                    group_id: gid,
                    title: form.title,
                    batch_id: form.batchId,
                    due_date: form.dueDate,
                    session_log_id: form.sessionLogId || null,
                    teacher_id: userProfile.id,
                    is_finished: editingAssignment?.isFinished || false
                };

                const promises = form.variants.map(v =>
                    homeworkService.saveHomework({
                        ...baseData,
                        description: v.description,
                        target_school_id: v.schoolId || null
                    })
                );

                await Promise.all(promises);
                toast.success(editingAssignment ? 'Assignment updated!' : 'Assignment created!');
                setShowModal(false);
                loadData();
            } catch (err) {
                console.error(err);
                toast.error('Failed to save assignment');
            }
        }

        async function handleDelete(groupId) {
            if (!confirm('Delete this entire assignment group?')) return;
            try {
                await homeworkService.deleteHomeworkGroup(groupId);
                loadData();
                toast.success('Deleted successfully');
            } catch (err) {
                console.error(err);
                toast.error('Failed to delete');
        }
    }

    function openCreate() {
        setEditingAssignment(null);
        setForm({
            title: '',
            batchId: '',
            dueDate: format(new Date(), 'yyyy-MM-dd'),
            sessionLogId: '',
            variants: [{ schoolId: '', description: '' }]
        });
        setShowModal(true);
    }

    async function toggleFinished(group) {
            try {
                const next = !group.isFinished;
                await homeworkService.setFinishedStatus(group.id, next);
                toast.success(next ? 'Marked as finished!' : 'Moved back to pending');
                loadData();
            } catch (err) {
                console.error(err);
                toast.error('Failed to update status');
            }
        }

        function openEdit(group) {
            setEditingAssignment(group);
            setForm({
                title: group.title,
                batchId: group.batchId,
                dueDate: group.dueDate,
                sessionLogId: group.sessionLogId || '',
                variants: group.variants.map(v => ({ schoolId: v.schoolId || '', description: v.description }))
            });
            setShowModal(true);
        }

        async function setStudentSubmissionStatus(studentId, variantId, status) {
            try {
                await homeworkService.setHomeworkStatus(variantId, studentId, status);
                loadData();
            } catch (err) {
                console.error(err);
                toast.error('Failed to update status');
            }
        }

        function getBatchName(id) {
            return batches.find(b => b.id === id)?.name || 'Unknown Batch';
        }

        function getSchoolName(id) {
            return schools.find(s => s.id === id)?.name || 'All Institutions';
        }

        if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

        return (
            <div className="animate-fade-in">
                <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                    <div>
                        <h1 className="page-title">Homework Workspace</h1>
                        <p className="page-subtitle">Unified assignment management and progress tracking</p>
                    </div>
                    <button className="btn btn-primary btn-comfort" onClick={openCreate} style={{ boxShadow: 'var(--shadow-primary)' }}>
                        <Plus size={24} />
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="glass-card" style={{ padding: '20px', marginBottom: 'var(--space-8)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <label className="form-label-compact">Status Filter</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['all', 'pending', 'overdue', 'completed'].map(s => (
                                <button
                                    key={s}
                                    className={`btn-chip ${filterStatus === s ? 'active' : ''}`}
                                    onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                                >
                                    {s.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ width: '250px' }}>
                        <label className="form-label-compact">Batch Filter</label>
                        <select className="form-select" value={filterBatch} onChange={(e) => { setFilterBatch(e.target.value); setCurrentPage(1); }}>
                            <option value="">All Batches</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {paginatedAssignments.length === 0 ? (
                    <div className="glass-card" style={{ padding: '80px', textAlign: 'center' }}>
                        <BookOpen size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                        <h3>No assignments found</h3>
                        <p className="text-muted">Try adjusting your filters or create a new assignment.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                        {paginatedAssignments.map(group => {
                            const isOverdue = group.status === 'overdue';
                            return (
                                <div key={group.id} className={`glass-card homework-card ${group.isFinished ? 'finished' : ''}`} style={{ borderColor: isOverdue ? 'rgba(239, 68, 68, 0.3)' : '' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {group.isFinished ? (
                                                <span className="badge badge-success">COMPLETED</span>
                                            ) : isOverdue ? (
                                                <span className="badge badge-danger heartbeat">OVERDUE</span>
                                            ) : (
                                                <span className="badge badge-warning">DUE {format(new Date(group.dueDate), 'MMM d')}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn-icon-sm" onClick={() => toggleFinished(group)} title={group.isFinished ? "Unmark" : "Mark as Finished"}>
                                                <CheckSquare size={16} color={group.isFinished ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                                            </button>
                                            <button className="btn-icon-sm" onClick={() => openEdit(group)}><Edit2 size={14} /></button>
                                            <button className="btn-icon-sm delete" onClick={() => handleDelete(group.id)}><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>{group.title}</h3>
                                    <div style={{ fontSize: '12px', color: 'var(--color-accent)', marginBottom: '16px', fontWeight: 700 }}>{getBatchName(group.batchId)}</div>

                                    {/* Variants List */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {group.variants.map((v, i) => (
                                            <div key={v.id} style={{ marginBottom: i < group.variants.length - 1 ? '12px' : 0, paddingBottom: i < group.variants.length - 1 ? '12px' : 0, borderBottom: i < group.variants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                                <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '4px' }}>{getSchoolName(v.schoolId).toUpperCase()}</div>
                                                <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{v.description}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Progress */}
                                    <div style={{ marginTop: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '6px' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>SESSION PROGRESS</span>
                                            <span>{group.stats.completed}/{group.stats.total} STUDENTS</span>
                                        </div>
                                        <div className="progress-mini" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                                            <div style={{ width: `${group.stats.progress}%`, height: '100%', background: group.isFinished ? 'var(--color-success)' : 'var(--color-accent)', boxShadow: '0 0 10px rgba(0,0,0,0.5)' }} />
                                        </div>
                                        <button className="btn btn-secondary btn-comfort" style={{ width: '100%' }} onClick={() => setTrackingAssignment(group)}>
                                            Check Student Progress
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', gap: '8px' }}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                className={`btn-pagination ${currentPage === i + 1 ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}

                {/* Redesigned Modal */}
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title={editingAssignment ? 'Edit Assignment' : 'New Assignment'}
                    maxWidth="600px"
                >
                    <form onSubmit={handleSave} style={{ padding: '4px' }}>
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Assignment Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Chapter 4 Exercises" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Batch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                <select className="form-select" value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value, sessionLogId: '' })} required>
                                    <option value="">Select Batch</option>
                                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Due Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                <input type="date" className="form-input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
                            </div>
                        </div>

                        {/* Unified Multi-Target Variant List */}
                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>School Tasks & Targeting</label>
                                {!editingAssignment && (
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, variants: [...f.variants, { schoolId: '', description: '' }] }))}
                                        style={{ fontSize: '11px', color: 'var(--color-accent)', background: 'rgba(20, 184, 166, 0.1)', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                        + ADD SCHOOL VARIANT
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {form.variants.map((v, idx) => (
                                    <div key={idx} className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderStyle: 'dashed' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '10px' }}>Target School</label>
                                                <select
                                                    className="form-select"
                                                    value={v.schoolId}
                                                    onChange={e => {
                                                        const next = [...form.variants];
                                                        next[idx].schoolId = e.target.value;
                                                        setForm({ ...form, variants: next });
                                                    }}
                                                    style={{ height: '38px', fontSize: '12px' }}
                                                >
                                                    <option value="">{form.variants.length > 1 ? 'Select School' : 'All Schools'}</option>
                                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            {!editingAssignment && form.variants.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-icon"
                                                    onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))}
                                                    style={{ marginTop: '20px', color: 'var(--color-danger)' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '10px' }}>Instructions for this target</label>
                                            <textarea
                                                className="form-textarea"
                                                rows={2}
                                                value={v.description}
                                                onChange={e => {
                                                    const next = [...form.variants];
                                                    next[idx].description = e.target.value;
                                                    setForm({ ...form, variants: next });
                                                }}
                                                placeholder="What should this specific group do?"
                                                style={{ fontSize: '13px' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {form.batchId && (
                            <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileEdit size={14} className="text-primary" />
                                    Link to Class Session
                                </label>
                                <select className="form-select" value={form.sessionLogId} onChange={e => setForm({ ...form, sessionLogId: e.target.value })} style={{ borderStyle: 'dashed', fontSize: '13px' }}>
                                    <option value="">— No session link —</option>
                                    {sessionLogs
                                        .filter(l => l.batchId === form.batchId)
                                        .sort((a, b) => {
                                            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                                            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                                            return db2 - da;
                                        })
                                        .map(l => {
                                            const dateVal = l.date?.toDate ? format(l.date.toDate(), 'MMM d') : l.date;
                                            return (
                                                <option key={l.id} value={l.id}>
                                                    {dateVal} — {l.topicsCovered || 'Session'}
                                                </option>
                                            );
                                        })}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>
                                {editingAssignment ? 'Update Details' : 'Deploy Multi-Target Assignment'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Tracking Modal */}
                <Modal
                    isOpen={!!trackingAssignment}
                    onClose={() => setTrackingAssignment(null)}
                    title={trackingAssignment?.title || 'Check Progress'}
                    maxWidth="650px"
                >
                    {trackingAssignment && (
                        <div style={{ padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-6)', padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: '12px' }}>
                                <div style={{ width: '40px', height: '40px', background: 'var(--color-accent-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                                    <Users size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{getBatchName(trackingAssignment.batchId)}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Status tracking for all students in this batch</div>
                                </div>
                            </div>

                            <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                {(() => {
                                    const assignedStudents = students.filter(s => (s.batchIds || []).includes(trackingAssignment.batchId));

                                    if (assignedStudents.length === 0) {
                                        return (
                                            <div style={{ padding: '80px', textAlign: 'center' }}>
                                                <Info size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '8px', opacity: 0.3 }} />
                                                <p style={{ color: 'var(--color-text-muted)' }}>No enrolled students in this batch.</p>
                                            </div>
                                        );
                                    }

                                    return assignedStudents.map(student => {
                                        // Find which variant applies to this student
                                        const variant = trackingAssignment.variants.find(v => !v.schoolId || v.schoolId === student.school_id) || trackingAssignment.variants[0];
                                        const sub = trackingAssignment.allSubmissions[student.id];
                                        const currentStatus = sub?.status || 'not_submitted';

                                        return (
                                            <div key={student.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-accent)' }}>
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{student.name}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{getSchoolName(student.school_id)}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {STATUSES.map(st => (
                                                        <button
                                                            key={st.value}
                                                            type="button"
                                                            onClick={() => setStudentSubmissionStatus(student.id, variant.id, st.value)}
                                                            className={`btn-status-chip ${currentStatus === st.value ? 'active' : ''}`}
                                                            style={{
                                                                padding: '6px 10px',
                                                                fontSize: '11px',
                                                                borderRadius: '8px',
                                                                background: currentStatus === st.value ? `${st.color}20` : 'rgba(255,255,255,0.03)',
                                                                color: currentStatus === st.value ? st.color : 'var(--color-text-muted)',
                                                                border: `1px solid ${currentStatus === st.value ? `${st.color}40` : 'rgba(255,255,255,0.05)'}`,
                                                                fontWeight: currentStatus === st.value ? 700 : 500,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            {st.label.split(' ')[1] || st.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-6)', borderRadius: '12px', boxShadow: 'var(--shadow-primary)' }} onClick={() => setTrackingAssignment(null)}>
                                Done
                            </button>
                        </div>
                    )}
                </Modal>
            </div>
    );
}