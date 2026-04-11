import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { BookOpen, Plus, Edit2, Trash2, X, CheckSquare, Square, Calendar, Clock, AlertTriangle, FileEdit, Filter, ChevronRight, Info, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { homeworkService } from '../services/homeworkService';
import { lessonPlanService } from '../services/lessonPlanService';
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
    const [students, setStudents] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [form, setForm] = useState({
        title: '',
        description: '',
        batchId: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        sessionLogId: '',
    });

    const [trackingAssignment, setTrackingAssignment] = useState(null);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [hwList, activeBatches, allStudents, logs] = await Promise.all([
                homeworkService.getHomeworkByTeacher(uid),
                batchService.getBatches(uid, true),
                studentService.getStudentsByTeacher(uid),
                lessonPlanService.getLessonsByTeacher(uid)
            ]);
            setAssignments(hwList);
            setBatches(activeBatches);
            setStudents(allStudents.filter(s => s.status === 'enrolled'));
            setSessionLogs(logs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Get submissions map — already transformed by the service to { student_id: { status } }
    function getSubmissions(hw) {
        return hw.submissions || {};
    }

    function getSubmissionStats(hw) {
        const assignedStudents = students.filter(s => (s.batchIds || []).includes(hw.batch_id));
        const total = assignedStudents.length;
        const subs = getSubmissions(hw);
        let completed = 0, late = 0, partial = 0, notSubmitted = 0;
        assignedStudents.forEach(s => {
            const sub = subs[s.id];
            if (!sub || !sub.status || sub.status === 'not_submitted') notSubmitted++;
            else if (sub.status === 'completed') completed++;
            else if (sub.status === 'late') late++;
            else if (sub.status === 'partial') partial++;
        });
        return { total, completed, late, partial, notSubmitted };
    }

    function openCreate() {
        setEditingAssignment(null);
        setForm({
            title: '', description: '', batchId: filterBatch,
            dueDate: format(new Date(), 'yyyy-MM-dd'), sessionLogId: '',
        });
        setShowModal(true);
    }

    function openEdit(hw) {
        setEditingAssignment(hw);
        setForm({
            title: hw.title || '',
            description: hw.description || '',
            batchId: hw.batch_id || '',
            dueDate: hw.due_date || '',
            sessionLogId: hw.session_log_id || '',
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                title: form.title,
                description: form.description,
                batch_id: form.batchId,
                due_date: form.dueDate,
                session_log_id: form.sessionLogId || null,
                teacher_id: userProfile.id,
            };

            if (editingAssignment) {
                data.id = editingAssignment.id;
                await homeworkService.saveHomework(data);
                toast.success('Assignment updated!');
            } else {
                await homeworkService.saveHomework(data);
                toast.success('Assignment created!');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save assignment');
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this assignment?')) return;
        try {
            await homeworkService.deleteHomework(id);
            loadData();
            toast.success('Deleted successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete');
        }
    }

    async function setStudentSubmissionStatus(studentId, status) {
        if (!trackingAssignment) return;
        try {
            await homeworkService.setHomeworkStatus(trackingAssignment.id, studentId, status);
            
            // Re-load list to get updated submissions
            const hwList = await homeworkService.getHomeworkByTeacher(userProfile.id);
            setAssignments(hwList);

            // Update tracking assignment in modal
            const updated = hwList.find(a => a.id === trackingAssignment.id);
            if (updated) setTrackingAssignment(updated);
            
        } catch (err) {
            console.error(err);
            toast.error('Failed to update status');
        }
    }

    function getBatchName(id) {
        return batches.find(b => b.id === id)?.name || 'Unknown Batch';
    }

    function getSessionLogInfo(sessionLogId) {
        if (!sessionLogId) return null;
        return sessionLogs.find(l => l.id === sessionLogId) || null;
    }

    function getDueDateStatus(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (d < today) return { label: 'Overdue', color: 'var(--color-danger)' };
        if (d.getTime() === today.getTime()) return { label: 'Due Today', color: 'var(--color-warning)' };
        return { label: `Due ${format(d, 'MMM d')}`, color: 'var(--color-teal)' };
    }

    const filteredAssignments = assignments
        .filter(a => !filterBatch || a.batch_id === filterBatch)
        .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <h1 className="page-title">Homework & Assignments</h1>
                    <p className="page-subtitle">Give work to students and track their progress</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ boxShadow: 'var(--shadow-primary)' }}>
                    <Plus size={18} /> New Assignment
                </button>
            </div>

            <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-8)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <div style={{ padding: '8px', background: 'var(--color-primary-light)', borderRadius: '10px', color: 'var(--color-primary)' }}>
                    <Filter size={18} />
                </div>
                <div style={{ flex: 1, maxWidth: '300px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Filter by Batch</label>
                    <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                        <option value="">All Active Batches</option>
                        {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                </div>
            </div>

            {filteredAssignments.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                        <BookOpen size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No Homework Found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Create an assignment for your batches to see them here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
                    {filteredAssignments.map(hw => {
                        const status = getDueDateStatus(hw.dueDate);
                        const stats = getSubmissionStats(hw);
                        const progPerc = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                        const linkedLog = getSessionLogInfo(hw.sessionLogId);

                        return (
                            <div key={hw.id} className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: `${status.color}15`, borderRadius: '20px', border: `1px solid ${status.color}30` }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.color }} />
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: status.color }}>{status.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(hw)} title="Edit Assignment"><Edit2 size={16} /></button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(hw.id)} title="Delete Assignment" style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text)' }}>{hw.title}</h3>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontWeight: 500 }}>
                                    {getBatchName(hw.batchId)}
                                </div>

                                {linkedLog && (
                                    <div style={{ fontSize: '12px', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '8px 12px', borderRadius: '8px', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <FileEdit size={14} style={{ marginTop: '1px' }} />
                                        <span>
                                            Linked to class: <strong>{linkedLog.topicsCovered}</strong>
                                        </span>
                                    </div>
                                )}

                                {hw.description && (
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)', flex: 1, lineHeight: 1.5 }}>
                                        {hw.description}
                                    </p>
                                )}

                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 'var(--space-4)', borderRadius: '12px', marginBottom: 'var(--space-6)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-success)' }}>{stats.completed}</div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Done</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-warning)' }}>{stats.late}</div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Late</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>{stats.partial}</div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Part</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-danger)' }}>{stats.notSubmitted}</div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Miss</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Class Progress</span>
                                        <span style={{ color: 'var(--color-text)' }}>{stats.completed}/{stats.total} students</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 10, background: 'rgba(255,255,255,0.05)', marginBottom: 'var(--space-6)' }}>
                                        <div className="progress-bar-fill" style={{ 
                                            width: `${progPerc}%`, 
                                            background: progPerc === 100 ? 'var(--color-success)' : 'var(--color-primary)',
                                            boxShadow: progPerc > 0 ? '0 0 10px rgba(20, 184, 166, 0.3)' : 'none'
                                        }} />
                                    </div>
                                    <button className="btn btn-secondary" style={{ width: '100%', borderRadius: '12px', fontWeight: 700 }} onClick={() => setTrackingAssignment(hw)}>
                                        Check Student Progress
                                    </button>
                                </div>
                            </div>
                        );
                    })}
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

                    {form.batchId && (
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileEdit size={14} className="text-primary" /> 
                                Link to Class Session
                                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Optional</span>
                            </label>
                            <select className="form-select" value={form.sessionLogId} onChange={e => setForm({ ...form, sessionLogId: e.target.value })} style={{ borderStyle: 'dashed' }}>
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

                    <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                        <label className="form-label">Description / Instructions</label>
                        <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Write down what exactly needs to be done..." />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>
                            {editingAssignment ? 'Update Assignment' : 'Create Assignment'}
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
                            <div style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                                <Users size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 700 }}>{getBatchName(trackingAssignment.batchId)}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Work status for students in this batch</div>
                            </div>
                        </div>

                        <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {(() => {
                                const assignedStudents = students.filter(s => s.batchIds?.includes(trackingAssignment.batchId));
                                const subs = getSubmissions(trackingAssignment);
                                
                                if (assignedStudents.length === 0) {
                                    return (
                                        <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
                                            <Info size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '8px', opacity: 0.3 }} />
                                            <p style={{ color: 'var(--color-text-muted)' }}>No enrolled students in this batch.</p>
                                        </div>
                                    );
                                }

                                return assignedStudents.map(student => {
                                    const sub = subs[student.id];
                                    const currentStatus = sub?.status || 'not_submitted';
                                    return (
                                        <div key={student.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-accent)' }}>
                                                    {student.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{student.name}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {STATUSES.map(st => (
                                                    <button
                                                        key={st.value}
                                                        type="button"
                                                        onClick={() => setStudentSubmissionStatus(student.id, st.value)}
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
