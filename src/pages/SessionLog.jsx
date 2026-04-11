import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { FileEdit, Plus, Edit2, Trash2, X, Clock, Link2, Filter, BookOpen, Calendar, ChevronRight, Info } from 'lucide-react';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';
import { lessonPlanService } from '../services/lessonPlanService';
import { homeworkService } from '../services/homeworkService';
import Modal from '../components/Modal';

export default function SessionLog() {
    const { userProfile } = useAuth();
    const [searchParams] = useSearchParams();
    const defaultBatchId = searchParams.get('batchId') || '';
    const defaultScheduleId = searchParams.get('scheduleId') || '';

    const [logs, setLogs] = useState([]);
    const [batches, setBatches] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState(defaultBatchId);
    
    const [showModal, setShowModal] = useState(defaultScheduleId ? true : false);
    const [editingLog, setEditingLog] = useState(null);
    const [form, setForm] = useState({
        batchId: defaultBatchId,
        scheduleId: defaultScheduleId,
        date: format(new Date(), 'yyyy-MM-dd'),
        topicsCovered: '',
        notes: '',
        homeworkAssigned: ''
    });

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [logList, activeBatches, schedResult] = await Promise.all([
                lessonPlanService.getLessonsByTeacher(uid),
                batchService.getBatches(uid, true),
                supabase.from('schedules').select('*').eq('teacher_id', uid),
            ]);
            setLogs(logList || []);
            setBatches(activeBatches);
            setSchedules(schedResult.data || []);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    // Get unlinked schedules for a batch (status != completed, and no session log already linked)
    function getAvailableSchedules(batchId) {
        if (!batchId) return [];
        const linkedScheduleIds = new Set(logs.filter(l => l.schedule_id).map(l => l.schedule_id));
        return schedules
            .filter(s => s.batch_id === batchId && s.status !== 'completed' && s.status !== 'cancelled' && !linkedScheduleIds.has(s.id))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Get schedule info for a log
    function getScheduleForLog(scheduleId) {
        if (!scheduleId) return null;
        return schedules.find(s => s.id === scheduleId) || null;
    }

    function openCreate() {
        setEditingLog(null);
        setForm({
            batchId: filterBatch, scheduleId: '', date: format(new Date(), 'yyyy-MM-dd'),
            topicsCovered: '', notes: '', homeworkAssigned: ''
        });
        setShowModal(true);
    }

    function openEdit(log) {
        setEditingLog(log);
        setForm({
            batchId: log.batch_id || '',
            scheduleId: log.schedule_id || '',
            date: log.date,
            topicsCovered: log.topics_covered || '',
            notes: log.notes || '',
            homeworkAssigned: log.homework_assigned || ''
        });
        setShowModal(true);
    }

    // When user selects a schedule from the dropdown, auto-fill date
    function handleScheduleSelect(scheduleId) {
        const schedule = schedules.find(s => s.id === scheduleId);
        if (schedule) {
            setForm(prev => ({ ...prev, scheduleId, date: schedule.date }));
        } else {
            setForm(prev => ({ ...prev, scheduleId }));
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                batchId: form.batchId,
                batchName: batches.find((b) => b.id === form.batchId)?.name || '',
                scheduleId: form.scheduleId || null,
                date: form.date,
                topicsCovered: form.topicsCovered,
                notes: form.notes,
                homeworkAssigned: form.homeworkAssigned,
                teacherId: userProfile.id,
            };

            if (editingLog) {
                const { error } = await supabase
                    .from('session_logs')
                    .update({
                        batch_id: data.batchId,
                        batch_name: data.batchName,
                        schedule_id: data.scheduleId,
                        date: data.date,
                        topics_covered: data.topicsCovered,
                        notes: data.notes,
                        homework_assigned: data.homeworkAssigned
                    })
                    .eq('id', editingLog.id);
                if (error) throw error;
            } else {
                const logId = await lessonPlanService.logSession(data);
                
                // Mark the schedule as completed
                if (form.scheduleId) {
                    await supabase
                        .from('schedules')
                        .update({ status: 'completed' })
                        .eq('id', form.scheduleId);
                }
                
                // Auto-create homework if homeworkAssigned is filled
                if (form.homeworkAssigned && form.homeworkAssigned.trim()) {
                    const dueDate = addDays(new Date(form.date), 3);
                    await homeworkService.saveHomework({
                        title: form.homeworkAssigned.substring(0, 80),
                        description: form.homeworkAssigned,
                        batch_id: form.batchId,
                        due_date: format(dueDate, 'yyyy-MM-dd'),
                        teacher_id: userProfile.id,
                        session_log_id: logId
                    });
                }
            }
            setShowModal(false);
            loadData();
            toast.success('Session log saved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to save log.');
        }
    }

    async function handleDelete(logId) {
        if (!confirm('Delete this session log?')) return;
        try {
            const { error } = await supabase
                .from('session_logs')
                .delete()
                .eq('id', logId);
            if (error) throw error;
            loadData();
            toast.success('Log deleted');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to delete.');
        }
    }

    const filteredLogs = logs
        .filter((l) => !filterBatch || l.batch_id === filterBatch)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <h1 className="page-title">Class Records</h1>
                    <p className="page-subtitle">A simple history of what you've taught in each class</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ boxShadow: 'var(--shadow-primary)' }}>
                    <Plus size={18} /> Add Class Record
                </button>
            </div>

            <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-8)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <div style={{ padding: '8px', background: 'var(--color-primary-light)', borderRadius: '10px', color: 'var(--color-primary)' }}>
                    <Filter size={18} />
                </div>
                <div style={{ flex: 1, maxWidth: '300px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Filter by Batch</label>
                    <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                        <option value="">All Batches</option>
                        {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                        <FileEdit size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No Records Found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>You haven't added any class records yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {filteredLogs.map((log) => {
                        const dateVal = log.date?.toDate ? log.date.toDate() : new Date(log.date);
                        const linkedSchedule = getScheduleForLog(log.scheduleId);
                        return (
                            <div key={log.id} className="glass-card list-item-hover" style={{ padding: 'var(--space-6)', transition: 'all 0.3s ease' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-6)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', background: 'var(--color-primary-light)', padding: '4px 12px', borderRadius: '20px' }}>
                                                <Calendar size={14} />
                                                {format(dateVal, 'MMM d, yyyy')}
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                                {log.batchName}
                                            </div>
                                            {linkedSchedule && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-teal)', background: 'var(--color-teal-light)', padding: '4px 12px', borderRadius: '20px' }}>
                                                    <Clock size={14} />
                                                    {linkedSchedule.startTime} – {linkedSchedule.endTime}
                                                </div>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--color-text)' }}>
                                            {log.topicsCovered || 'Topics not recorded'}
                                        </h3>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {log.homeworkAssigned && (
                                                <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid var(--color-warning)', padding: '12px 16px', borderRadius: '0 8px 8px 0' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-warning)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Homework Assigned</span>
                                                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{log.homeworkAssigned}</p>
                                                </div>
                                            )}
                                            
                                            {log.notes && (
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Class Notes</span>
                                                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{log.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(log)} title="Edit Entry">
                                            <Edit2 size={18} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(log.id)} title="Delete Entry" style={{ color: 'var(--color-danger)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
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
                title={editingLog ? 'Edit Class Record' : 'Add Class Record'}
                maxWidth="650px"
            >
                <form onSubmit={handleSave} style={{ padding: 'var(--space-2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Batch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <select className="form-select" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value, scheduleId: '' })} required>
                                <option value="">Select Batch</option>
                                {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                        </div>
                    </div>

                    {form.batchId && (
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Link2 size={14} className="text-primary" /> 
                                Link to Scheduled Class
                                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Optional</span>
                            </label>
                            <select className="form-select" value={form.scheduleId} onChange={(e) => handleScheduleSelect(e.target.value)} style={{ borderStyle: 'dashed' }}>
                                <option value="">— No scheduled link —</option>
                                {getAvailableSchedules(form.batchId).map(s => {
                                    const dateVal = s.date?.toDate ? format(s.date.toDate(), 'MMM d') : s.date;
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {dateVal} | {s.startTime}-{s.endTime} | {s.title}
                                        </option>
                                    );
                                })}
                                {editingLog && editingLog.scheduleId && !getAvailableSchedules(form.batchId).find(s => s.id === editingLog.scheduleId) && (
                                    <option value={editingLog.scheduleId}>(Current Link)</option>
                                )}
                            </select>
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Topics Covered <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <BookOpen size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: '40px' }} value={form.topicsCovered} onChange={(e) => setForm({ ...form, topicsCovered: e.target.value })} placeholder="What was taught today?" required />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Class Notes</label>
                        <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Add any details about class experience, student behavior, etc." />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Homework Assigned</label>
                        <textarea className="form-textarea" value={form.homeworkAssigned} onChange={(e) => setForm({ ...form, homeworkAssigned: e.target.value })} rows={2} placeholder="Describe tasks for next class — this will auto-create a homework entry" />
                        {form.homeworkAssigned && !editingLog && (
                            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', fontSize: '11px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Info size={14} />
                                A homework entry will be automatically created with a 3-day deadline.
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-8)' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>
                            {editingLog ? 'Update Record' : 'Save Record'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
