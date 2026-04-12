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
        classTitle: '',
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
            classTitle: '', topicsCovered: '', notes: '', homeworkAssigned: ''
        });
        setShowModal(true);
    }

    function openEdit(log) {
        setEditingLog(log);
        setForm({
            batchId: log.batch_id || '',
            scheduleId: log.schedule_id || '',
            date: log.date,
            classTitle: log.classTitle || '',
            topicsCovered: log.topicsCovered || '',
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
                classTitle: form.classTitle,
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
                <div className="tooltip-wrapper">
                    <button className="btn btn-primary btn-comfort" onClick={openCreate} style={{ boxShadow: 'var(--shadow-primary)' }}>
                        <Plus size={24} />
                    </button>
                    <span className="tooltip">Add Class Record</span>
                </div>
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
                <div className="glass-panel" style={{ padding: '80px var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-8)' }}>
                        <BookOpen size={40} style={{ color: 'var(--color-primary)', opacity: 0.5 }} />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>Journal is Empty</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Once you finish a scheduled class, the details will appear here automatically.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
                    {filteredLogs.map((log) => {
                        const dateVal = new Date(log.date);
                        return (
                            <div key={log.id} className="glass-panel session-log-card" style={{ 
                                padding: 'var(--space-6)', 
                                border: '1px solid rgba(255,255,255,0.03)',
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                                    <div style={{ flex: 1 }}>
                                        {/* Top Meta Row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                            <div style={{ 
                                                fontSize: '11px', fontWeight: 900, color: 'white', 
                                                background: 'var(--color-primary)', 
                                                padding: '4px 10px', borderRadius: '8px',
                                                textTransform: 'uppercase'
                                            }}>
                                                {log.batchName || 'Individual'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                <Calendar size={14} />
                                                {format(dateVal, 'MMMM d, yyyy')}
                                            </div>
                                            {log.schedule_id && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-teal)', fontWeight: 800, textTransform: 'uppercase' }}>
                                                    <Link2 size={12} /> Linked to Schedule
                                                </div>
                                            )}
                                        </div>

                                        {/* Title & Content */}
                                        <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                                            {log.classTitle || log.topicsCovered || 'Untitled Class'}
                                        </h3>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                                            <div>
                                                <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>Topics Covered</span>
                                                <p style={{ fontSize: '14px', color: 'rgba(255,100,2014, 0.8)', margin: 0, lineHeight: 1.5 }}>
                                                    {log.topicsCovered || 'No topics specified'}
                                                </p>
                                            </div>

                                            {log.homeworkAssigned && (
                                                <div style={{ padding: '12px', background: 'rgba(236, 72, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(236, 72, 153, 0.1)' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                        <Star size={12} fill="#ec4899" /> Homework Assigned
                                                    </span>
                                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>{log.homeworkAssigned}</p>
                                                </div>
                                            )}
                                        </div>

                                        {log.notes && (
                                            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Teacher Observations</span>
                                                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0, fontStyle: 'italic' }}>"{log.notes}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <button onClick={() => openEdit(log)} className="btn btn-ghost btn-icon" style={{ width: '40px', height: '40px' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(log.id)} className="btn btn-ghost btn-icon" style={{ width: '40px', height: '40px', color: 'var(--color-danger)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .session-log-card:hover {
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--color-primary-faded) !important;
                    transform: translateX(4px);
                }
            `}</style>

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
                                    const dateVal = s.date;
                                    const formattedDate = dateVal ? format(new Date(dateVal), 'MMM d') : '';
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {formattedDate} | {s.start_time}-{s.end_time} | {s.title}
                                        </option>
                                    );
                                })}
                                {editingLog && editingLog.schedule_id && !getAvailableSchedules(form.batchId).find(s => s.id === editingLog.schedule_id) && (
                                    <option value={editingLog.schedule_id}>(Current Link)</option>
                                )}
                            </select>
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Class Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <FileEdit size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: '40px' }} value={form.classTitle} onChange={(e) => setForm({ ...form, classTitle: e.target.value })} placeholder="e.g., Intro to Algebra" required />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Topics Covered <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                            <BookOpen size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input className="form-input" style={{ paddingLeft: '40px' }} value={form.topicsCovered} onChange={(e) => setForm({ ...form, topicsCovered: e.target.value })} placeholder="What specific sections were taught?" required />
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
