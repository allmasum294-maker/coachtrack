import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { examService } from '../services/examService';
import { homeworkService } from '../services/homeworkService';
import { lessonPlanService } from '../services/lessonPlanService';
import { attendanceService } from '../services/attendanceService';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { scheduleService } from '../services/scheduleService';
import { 
    Plus, X, Calendar as CalIcon, Clock, AlertCircle, 
    RefreshCw, Info, CheckCircle2, UserCheck, CalendarDays, 
    Calendar as CalendarIcon, Filter, Layers, ChevronRight
} from 'lucide-react';
import { format, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import SmartTimePicker from '../components/common/SmartTimePicker';

export default function Schedule() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [schedules, setSchedules] = useState([]);
    const [exams, setExams] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterBatch, setFilterBatch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showQuickView, setShowQuickView] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState({});
    const [completeForm, setCompleteForm] = useState({ topicsCovered: '', notes: '', homeworkAssigned: '' });
    const [hierarchy, setHierarchy] = useState([]);
    const [selectedLessonIds, setSelectedLessonIds] = useState(new Set());
    const [form, setForm] = useState({
        title: '', batchId: '', date: '', startTime: '', endTime: '', status: 'scheduled', notes: '',
    });
    const [recurringForm, setRecurringForm] = useState({
        title: '', batchId: '', startDate: '', endDate: '', startTime: '', endTime: '', days: [], notes: ''
    });

    const daysOfWeek = [
        { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
        { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }
    ];

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            
            // Fetch batches first and separately to ensure UI stability
            try {
                const activeBatches = await batchService.getBatches(uid, true);
                setBatches(activeBatches);
            } catch (batchErr) {
                console.error('Error loading batches:', batchErr);
            }

            const [
                allSchedules,
                studentResult,
                examResult,
                logResult,
                hwResult,
                hierarchyResult
            ] = await Promise.all([
                scheduleService.getSchedules(uid).catch(() => []),
                studentService.getStudentsByTeacher(uid).catch(() => []),
                examService.getExams(uid).catch(() => []),
                lessonPlanService.getLessonsByTeacher(uid).catch(() => []),
                homeworkService.getHomeworkByTeacher(uid).catch(() => []),
                lessonPlanService.getFullHierarchy(uid).catch(() => [])
            ]);
            
            setSchedules(allSchedules);
            setStudents(studentResult || []);
            setExams(examResult);
            setSessionLogs(logResult);
            setHomeworks(hwResult);
            setHierarchy(hierarchyResult || []);
        } catch (err) {
            console.error('Error loading schedules data:', err);
        } finally {
            setLoading(false);
        }
    }

    const getCalendarEvents = () => {
        const events = [];

        // 1. Regular Classes (Schedules)
        schedules.forEach(s => {
            let color = '#3b82f6'; // Default Scheduled (Blue)
            if (s.status === 'completed') color = '#14b8a6'; // Completed (Teal)
            if (s.status === 'cancelled') color = '#ef4444'; // Cancelled (Red)
            if (s.status === 'rescheduled') color = '#f59e0b'; // Rescheduled (Amber)

            events.push({
                id: s.id,
                title: `${s.title}${s.batchName ? `: ${s.batchName}` : ''}`,
                start: `${s.date}T${s.startTime}`,
                end: `${s.date}T${s.endTime}`,
                backgroundColor: color,
                borderColor: color,
                extendedProps: { ...s, type: 'class' }
            });
        });

        // 2. Exams
        exams.forEach(e => {
            const color = '#8b5cf6'; // Exam (Purple)
            events.push({
                id: `exam-${e.id}`,
                title: `EXAM: ${e.title}`,
                start: `${e.date}T${e.start_time}`,
                end: `${e.date}T${e.end_time}`,
                backgroundColor: color,
                borderColor: color,
                extendedProps: { ...e, type: 'exam' }
            });
        });

        // 3. HW Due Dates (from session logs)
        sessionLogs.forEach(l => {
            if (l.homework_assigned && l.date) {
                const color = '#ec4899'; // HW Due (Pink)
                events.push({
                    id: `hw-${l.id}`,
                    title: `HW: ${l.batchName || l.batchId}`,
                    start: l.date,
                    allDay: true,
                    backgroundColor: 'transparent',
                    borderColor: color,
                    textColor: color,
                    display: 'list-item',
                    extendedProps: { ...l, type: 'homework' }
                });
            }
            
            // Session Log itself as an event (Orange)
            const logColor = '#f97316';
            events.push({
                id: `log-${l.id}`,
                title: `LOG: ${l.batchName || 'Class Log'}`,
                start: l.date,
                allDay: true,
                backgroundColor: `${logColor}20`,
                borderColor: logColor,
                textColor: logColor,
                display: 'block',
                extendedProps: { ...l, type: 'log' }
            });
        });

        return events;
    };

    function openRecurringCreate() {
        setRecurringForm({
            title: '', batchId: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '',
            startTime: '', endTime: '', days: [], notes: ''
        });
        setShowRecurringModal(true);
    }

    function toggleRecurringDay(dayValue) {
        setRecurringForm(prev => {
            const days = prev.days.includes(dayValue) ? prev.days.filter(d => d !== dayValue) : [...prev.days, dayValue];
            return { ...prev, days };
        });
    }

    async function handleSaveRecurring(e) {
        e.preventDefault();
        if (recurringForm.days.length === 0) return toast.error('Select at least one day.');
        try {
            const batch = batches.find((b) => b.id === recurringForm.batchId);
            const start = new Date(recurringForm.startDate);
            const end = new Date(recurringForm.endDate);
            if (start > end) return toast.error('End date must be after start date.');
            
            const allDays = eachDayOfInterval({ start, end });
            const matchDays = allDays.filter(d => recurringForm.days.includes(getDay(d)));

            const newSchedules = matchDays.map(date => ({
                title: recurringForm.title || batch?.name || 'Class',
                batch_id: recurringForm.batchId,
                batch_name: batch?.name || '',
                date: format(date, 'yyyy-MM-dd'),
                start_time: recurringForm.startTime,
                end_time: recurringForm.endTime,
                status: 'scheduled',
                notes: recurringForm.notes,
                teacher_id: userProfile.id
            }));

            const { error } = await supabase
                .from('schedules')
                .insert(newSchedules);

            if (error) throw error;

            setShowRecurringModal(false);
            loadData();
            toast.success(`Scheduled ${matchDays.length} classes!`);
        } catch (err) {
            console.error('Error saving recurring schedules:', err);
            toast.error('Failed to schedule classes.');
        }
    }

    function openCreate(dateStr) {
        setEditingSchedule(null);
        setForm({
            title: '', batchId: '', date: dateStr || format(new Date(), 'yyyy-MM-dd'),
            startTime: '', endTime: '', status: 'scheduled', notes: '',
        });
        setShowModal(true);
    }

    function openEdit(schedule) {
        setEditingSchedule(schedule);
        setForm({
            title: schedule.title || '',
            batchId: schedule.batchId || '',
            date: schedule.date,
            startTime: schedule.startTime || '',
            endTime: schedule.endTime || '',
            status: schedule.status || 'scheduled',
            notes: schedule.notes || '',
        });
        setShowModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                title: form.title || batch?.name || 'Class',
                batch_id: form.batchId,
                batch_name: batch?.name || '',
                date: form.date,
                start_time: form.startTime,
                end_time: form.endTime,
                status: form.status,
                notes: form.notes,
                teacher_id: userProfile.id,
            };

            if (editingSchedule) {
                const { error } = await supabase
                    .from('schedules')
                    .update(data)
                    .eq('id', editingSchedule.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('schedules')
                    .insert(data);
                if (error) throw error;
            }
            setShowModal(false);
            loadData();
            toast.success(editingSchedule ? 'Schedule updated' : 'Class scheduled');
        } catch (err) {
            console.error('Error saving schedule:', err);
            toast.error('Failed to save schedule');
        }
    }

    async function handleDelete() {
        if (!editingSchedule || !confirm('Delete this scheduled class?')) return;
        try {
            const { error } = await supabase
                .from('schedules')
                .delete()
                .eq('id', editingSchedule.id);
            if (error) throw error;
            setShowModal(false);
            loadData();
            toast.success('Schedule deleted');
        } catch (err) {
            console.error('Error deleting schedule:', err);
        }
    }

    function openCompleteSession() {
        if (!editingSchedule) return;
        setCompleteForm({ topicsCovered: '', notes: '', homeworkAssigned: '' });
        const recs = {};
        students.filter(s => (s.batchIds || []).includes(editingSchedule.batchId)).forEach(s => {
            recs[s.id] = 'present';
        });
        setAttendanceRecords(recs);
        setSelectedLessonIds(new Set());
        setShowModal(false);
        setShowCompleteModal(true);
    }

    async function handleSaveCompleteSession(e) {
        e.preventDefault();
        try {
            const batch = batches.find(b => b.id === editingSchedule.batchId);
            const dateVal = completeForm.date || editingSchedule.date;

            const sessionData = {
                batchId: editingSchedule.batchId,
                batchName: batch?.name || editingSchedule.batch_name || 'Individual Class',
                scheduleId: editingSchedule.id,
                classTitle: editingSchedule.title || 'Untitled Class',
                date: dateVal,
                topicsCovered: completeForm.topicsCovered,
                notes: completeForm.notes,
                homeworkAssigned: completeForm.homeworkAssigned,
                teacherId: userProfile.id
            };
            
            const logId = await lessonPlanService.logSession(sessionData);

            if (selectedLessonIds.size > 0) {
                await lessonPlanService.linkLessonsToSession(logId, Array.from(selectedLessonIds));
            }

            if (completeForm.homeworkAssigned && completeForm.homeworkAssigned.trim()) {
                const baseDate = new Date(dateVal);
                const dueDate = new Date(baseDate);
                dueDate.setDate(dueDate.getDate() + 3);
                
                await homeworkService.saveHomework({
                    title: completeForm.homeworkAssigned.substring(0, 80),
                    description: completeForm.homeworkAssigned,
                    batch_id: editingSchedule.batchId,
                    due_date: format(dueDate, 'yyyy-MM-dd'),
                    teacher_id: userProfile.id,
                    session_log_id: logId
                });
            }

            await attendanceService.saveAttendance(
                userProfile.id,
                editingSchedule.batchId,
                dateVal,
                attendanceRecords
            );

            await supabase
                .from('schedules')
                .update({ status: 'completed' })
                .eq('id', editingSchedule.id);

            setShowCompleteModal(false);
            loadData();
            toast.success('Session and Attendance logged successfully!');
        } catch (err) {
            console.error('Error saving complete session:', err);
            toast.error('Failed to log session.');
        }
    }

    async function handleEventDrop(info) {
        const { event } = info;
        const props = event.extendedProps;
        
        try {
            const newDate = event.start;
            let updateData = {
                date: format(newDate, 'yyyy-MM-dd')
            };
            
            if (!event.allDay) {
                updateData.start_time = format(newDate, 'HH:mm');
                if (event.end) {
                    updateData.end_time = format(event.end, 'HH:mm');
                }
            }
            
            if (props.type === 'class') {
                await supabase.from('schedules').update(updateData).eq('id', props.id);
                toast.success('Schedule updated!');
                loadData();
            } else if (props.type === 'exam') {
                await supabase.from('exams').update(updateData).eq('id', props.id);
                toast.success('Exam updated!');
                loadData();
            } else {
                info.revert();
            }
        } catch (error) {
            console.error('Error updating event:', error);
            toast.error('Failed to update event');
            info.revert();
        }
    }

    async function handleEventResize(info) {
        const { event } = info;
        const props = event.extendedProps;
        
        if (!event.end) return;

        try {
            if (props.type === 'class') {
                await supabase.from('schedules').update({
                    end_time: format(event.end, 'HH:mm')
                }).eq('id', props.id);
                toast.success('Schedule duration updated!');
                loadData();
            } else if (props.type === 'exam') {
                await supabase.from('exams').update({
                    end_time: format(event.end, 'HH:mm')
                }).eq('id', props.id);
                toast.success('Exam duration updated!');
                loadData();
            } else {
                info.revert();
            }
        } catch (error) {
            console.error('Error updating event:', error);
            toast.error('Failed to update event duration');
            info.revert();
        }
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    const calendarLegend = [
        { color: '#3b82f6', label: 'Scheduled' },
        { color: '#14b8a6', label: 'Completed' },
        { color: '#ef4444', label: 'Cancelled' },
        { color: '#f59e0b', label: 'Rescheduled' },
        { color: '#8b5cf6', label: 'Exam' },
        { color: '#f97316', label: 'Session Log' },
        { color: '#ec4899', label: 'HW Due' },
    ];

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-12)' }}>
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '12px' }}>
                            <CalendarIcon size={24} />
                        </div>
                        <h1 className="page-title" style={{ margin: 0 }}>Class Schedule</h1>
                    </div>
                    <p className="page-subtitle">View and manage your classes, exams, and deadlines</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="tooltip-wrapper">
                        <button className="btn btn-secondary btn-comfort" onClick={() => openRecurringCreate()} style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                            <RefreshCw size={20} />
                        </button>
                        <span className="tooltip">Recurring Classes</span>
                    </div>
                    <div className="tooltip-wrapper">
                        <button className="btn btn-primary btn-comfort" onClick={() => openCreate()} style={{ boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }}>
                            <Plus size={24} />
                        </button>
                        <span className="tooltip">New Class</span>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flex: 1, minWidth: '300px' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '280px' }}>
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 900, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Filter size={14} /> Filter by Batch
                        </label>
                        <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ height: '48px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', fontWeight: 700 }}>
                            <option value="">All Batches</option>
                            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                    </div>
                    <div style={{ width: '1px', height: '40px', background: 'rgba(255, 255, 255, 0.05)' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>Legend:</div>
                        {calendarLegend.map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '3px', background: item.color, boxShadow: `0 0 10px ${item.color}40` }} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 'var(--space-6)', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div className="calendar-styles-override">
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,timeGridWeek',
                        }}
                        events={getCalendarEvents()}
                        dateClick={(info) => openCreate(info.dateStr)}
                        eventClick={(info) => {
                            const props = info.event.extendedProps;
                            if (props.type === 'log') {
                                navigate(`/sessions?batchId=${props.batchId || ''}`);
                                return;
                            }
                            
                            setSelectedEvent({ 
                                ...props, 
                                displayType: props.type,
                                displayBatchName: props.batchName 
                            });
                            setShowQuickView(true);
                        }}
                        editable={true}
                        eventDrop={handleEventDrop}
                        eventResize={handleEventResize}
                        height="auto"
                        aspectRatio={1.8}
                        dayMaxEventRows={true}
                        moreLinkContent={(args) => `+${args.num} more`}
                    />
                </div>
            </div>

            {/* Main Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ backdropFilter: 'blur(10px)' }}>
                    <div className="modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <div className="modal-header" style={{ padding: '32px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '10px' }}>
                                    <Layers size={20} />
                                </div>
                                <h2 className="modal-title" style={{ fontSize: '22px', fontWeight: 900 }}>{editingSchedule ? 'Edit Class' : 'Add New Class'}</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} style={{ borderRadius: '12px' }}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body" style={{ padding: '32px', gap: '24px' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Batch *</label>
                                    <select className="form-select" value={form.batchId} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, batchId: e.target.value, title: batches.find(b => b.id === e.target.value)?.name || form.title })}>
                                        <option value="">Select Batch...</option>
                                        {batches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Class Title</label>
                                    <input className="form-input" placeholder="e.g., Weekly Math Session" value={form.title} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" type="date" value={form.date} style={{ height: '52px', borderRadius: '14px', fontWeight: 700, paddingLeft: '48px' }}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                        <CalendarDays size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <SmartTimePicker 
                                        label="Start Time"
                                        value={form.startTime}
                                        onChange={(val) => setForm({ ...form, startTime: val })}
                                    />
                                    <SmartTimePicker 
                                        label="End Time"
                                        value={form.endTime}
                                        onChange={(val) => setForm({ ...form, endTime: val })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Status</label>
                                    <select className="form-select" value={form.status} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="rescheduled">Rescheduled</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Notes</label>
                                    <textarea className="form-textarea" value={form.notes} style={{ borderRadius: '16px', padding: '16px', fontWeight: 600 }}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Add any specific class notes..." />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: '24px 32px 32px', border: 'none', background: 'rgba(255, 255, 255, 0.02)' }}>
                                {editingSchedule && (
                                    <div style={{ marginRight: 'auto', display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-danger" onClick={handleDelete} style={{ borderRadius: '12px', height: '48px', padding: '0 20px', fontWeight: 700 }}>
                                            Delete
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={openCompleteSession} style={{ borderRadius: '12px', height: '48px', padding: '0 20px', fontWeight: 700 }}>
                                            Finish & Mark Attendance
                                        </button>
                                    </div>
                                )}
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ height: '48px', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 32px', borderRadius: '14px', fontWeight: 800 }}>
                                    {editingSchedule ? 'Update Class' : 'Add Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Recurring Modal */}
            {showRecurringModal && (
                <div className="modal-overlay" onClick={() => setShowRecurringModal(false)} style={{ backdropFilter: 'blur(10px)' }}>
                    <div className="modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, borderRadius: '28px' }}>
                        <div className="modal-header" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '10px' }}>
                                    <RefreshCw size={20} />
                                </div>
                                <h2 className="modal-title" style={{ fontSize: '22px', fontWeight: 900 }}>Set Recurring Classes</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowRecurringModal(false)}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSaveRecurring}>
                            <div className="modal-body" style={{ padding: '32px', gap: '24px' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Batch *</label>
                                    <select className="form-select" value={recurringForm.batchId} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }} 
                                        onChange={(e) => setRecurringForm({...recurringForm, batchId: e.target.value})}>
                                        <option value="">Select Batch...</option>
                                        {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Select Days *</label>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {daysOfWeek.map(d => (
                                            <button 
                                                type="button" 
                                                key={d.value} 
                                                onClick={() => toggleRecurringDay(d.value)}
                                                style={{ 
                                                    cursor: 'pointer', 
                                                    padding: '12px 18px', 
                                                    borderRadius: '12px', 
                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                    background: recurringForm.days.includes(d.value) ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: recurringForm.days.includes(d.value) ? 'white' : 'var(--color-text-muted)',
                                                    fontWeight: 800,
                                                    fontSize: '11px',
                                                    textTransform: 'uppercase',
                                                    boxShadow: recurringForm.days.includes(d.value) ? '0 5px 15px rgba(59, 130, 246, 0.3)' : 'none',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Start From *</label>
                                        <input className="form-input" type="date" value={recurringForm.startDate} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, startDate: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>End On *</label>
                                        <input className="form-input" type="date" value={recurringForm.endDate} required min={recurringForm.startDate} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, endDate: e.target.value})} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <SmartTimePicker 
                                        label="Start Time *"
                                        value={recurringForm.startTime}
                                        onChange={(val) => setRecurringForm({...recurringForm, startTime: val})}
                                    />
                                    <SmartTimePicker 
                                        label="End Time"
                                        value={recurringForm.endTime}
                                        onChange={(val) => setRecurringForm({...recurringForm, endTime: val})}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: '24px 32px 32px', border: 'none' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowRecurringModal(false)} style={{ height: '48px', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 32px', borderRadius: '14px', fontWeight: 800 }}>Create Recurring Classes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Complete Session Modal */}
            {showCompleteModal && editingSchedule && (
                <div className="modal-overlay" onClick={() => setShowCompleteModal(false)} style={{ backdropFilter: 'blur(15px)' }}>
                    <div className="modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, borderRadius: '32px' }}>
                        <div className="modal-header" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ padding: '8px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-accent)', borderRadius: '10px' }}>
                                    <CheckCircle2 size={24} />
                                </div>
                                <h2 className="modal-title" style={{ fontSize: '24px', fontWeight: 950 }}>Finish Class & Take Attendance</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCompleteModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSaveCompleteSession}>
                            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '48px', padding: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-accent)' }}>
                                        <Info size={18} />
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class Summary</h3>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SELECT TOPICS FROM SYLLABUS</label>
                                        <div className="glass-panel" style={{ maxHeight: '200px', overflowY: 'auto', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                                            {(function renderHierarchy(parentId = null, depth = 0) {
                                                const items = hierarchy.filter(h => h.parent_id === parentId);
                                                if (items.length === 0) return null;
                                                return items.map(item => (
                                                    <div key={item.id} style={{ marginLeft: depth * 16 }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedLessonIds.has(item.id)}
                                                                onChange={(e) => {
                                                                    const next = new Set(selectedLessonIds);
                                                                    if (e.target.checked) next.add(item.id);
                                                                    else next.delete(item.id);
                                                                    setSelectedLessonIds(next);
                                                                    
                                                                    // Auto-update topicsCovered text if empty or just list
                                                                    if (!completeForm.topicsCovered || completeForm.topicsCovered.includes(item.title)) {
                                                                        const selectedTitles = hierarchy.filter(h => next.has(h.id)).map(h => h.title);
                                                                        setCompleteForm(prev => ({ ...prev, topicsCovered: selectedTitles.join(', ') }));
                                                                    }
                                                                }}
                                                                style={{ width: '16px', height: '16px', borderRadius: '4px' }}
                                                            />
                                                            <span style={{ 
                                                                color: item.level === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                                                fontWeight: item.level === 0 ? 800 : 500 
                                                            }}>{item.title}</span>
                                                        </label>
                                                        {renderHierarchy(item.id, depth + 1)}
                                                    </div>
                                                ));
                                            })()}
                                            {hierarchy.length === 0 && (
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>
                                                    No syllabus items created. Go to Lessons to add some.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>SUMMARY TEXT *</label>
                                        <input className="form-input" value={completeForm.topicsCovered} placeholder="Summarize what was taught..." style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setCompleteForm({...completeForm, topicsCovered: e.target.value})} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>HOMEWORK ASSIGNED</label>
                                        <textarea className="form-textarea" value={completeForm.homeworkAssigned} style={{ borderRadius: '18px', padding: '16px', fontWeight: 600 }}
                                            onChange={(e) => setCompleteForm({...completeForm, homeworkAssigned: e.target.value})} rows={3} placeholder="Tasks for next class..." />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>TEACHER NOTES</label>
                                        <textarea className="form-textarea" value={completeForm.notes} style={{ borderRadius: '18px', padding: '16px', fontWeight: 600 }}
                                            onChange={(e) => setCompleteForm({...completeForm, notes: e.target.value})} rows={2} placeholder="Class performance, behavior, etc." />
                                    </div>
                                </div>

                                <div className="glass-card" style={{ padding: '32px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', color: 'var(--color-accent)' }}>
                                        <UserCheck size={20} />
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Take Attendance</h3>
                                    </div>
                                    <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {students.filter(s => (s.batchIds || []).includes(editingSchedule.batchId)).map((student, idx) => (
                                            <div key={student.id} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between', 
                                                padding: '16px 0', 
                                                borderBottom: idx === students.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' 
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '14px' }}>{student.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{student.studentId}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {['present', 'absent', 'late'].map(status => (
                                                        <button 
                                                            key={status}
                                                            type="button" 
                                                            onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: status})} 
                                                            style={{ 
                                                                width: '32px', 
                                                                height: '32px', 
                                                                padding: 0, 
                                                                fontSize: '11px', 
                                                                fontWeight: 900,
                                                                textTransform: 'uppercase',
                                                                borderRadius: '10px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                background: attendanceRecords[student.id] === status 
                                                                    ? (status === 'absent' ? 'var(--color-danger)' : status === 'late' ? 'var(--color-warning)' : 'var(--color-primary)')
                                                                    : 'rgba(255, 255, 255, 0.04)',
                                                                color: attendanceRecords[student.id] === status ? 'white' : 'var(--color-text-muted)',
                                                                boxShadow: attendanceRecords[student.id] === status 
                                                                    ? `0 5px 12px ${status === 'absent' ? 'rgba(239, 68, 68, 0.3)' : status === 'late' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` 
                                                                    : 'none'
                                                            }}
                                                        >
                                                            {status.charAt(0)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: '24px 32px 32px', border: 'none', background: 'rgba(255, 255, 255, 0.02)' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCompleteModal(false)} style={{ height: '52px', fontWeight: 800 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '52px', padding: '0 40px', borderRadius: '16px', fontWeight: 900, boxShadow: '0 10px 30px -5px rgba(20, 184, 166, 0.4)' }}>
                                    Save and Finish
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick View Modal */}
            {showQuickView && selectedEvent && (
                <div className="modal-overlay" onClick={() => setShowQuickView(false)} style={{ backdropFilter: 'blur(8px)' }}>
                    <div className="modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, borderRadius: '28px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <div className="modal-header" style={{ padding: '28px 28px 12px', border: 'none' }}>
                            <div style={{ 
                                padding: '10px 14px', 
                                borderRadius: '12px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                fontSize: '11px', 
                                fontWeight: 900, 
                                color: 'var(--color-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {selectedEvent.displayType === 'exam' ? '📋 Exam Details' : 
                                 selectedEvent.displayType === 'homework' ? '📚 Homework' :
                                 '🕒 Class Details'}
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowQuickView(false)} style={{ borderRadius: '12px' }}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 28px 28px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'white', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{selectedEvent.title}</h3>
                                {(selectedEvent.batchName || selectedEvent.displayBatchName) && (
                                    <div style={{ display: 'inline-flex', marginTop: '12px', padding: '4px 12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 800 }}>
                                        Batch: {selectedEvent.batchName || selectedEvent.displayBatchName}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <CalIcon size={18} />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '15px' }}>
                                        {selectedEvent.displayType === 'homework' 
                                            ? (selectedEvent.dueDate ? format(new Date(selectedEvent.dueDate), 'PPP') : 'No Date')
                                            : (selectedEvent.date ? format(new Date(selectedEvent.date), 'PPP') : 'No Date')
                                        }
                                    </span>
                                </div>
                                {(selectedEvent.startTime || selectedEvent.endTime) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <Clock size={18} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '15px' }}>
                                            {selectedEvent.startTime ? format(new Date(`2000-01-01T${selectedEvent.startTime}`), 'h:mm a') : 'Start'} 
                                            <ChevronRight size={14} style={{ opacity: 0.3, margin: '0 4px' }} /> 
                                            {selectedEvent.endTime ? format(new Date(`2000-01-01T${selectedEvent.endTime}`), 'h:mm a') : 'End'}
                                        </span>
                                    </div>
                                )}
                                {selectedEvent.status && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '12px', 
                                            background: selectedEvent.status === 'completed' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(251, 191, 36, 0.1)', 
                                            color: selectedEvent.status === 'completed' ? 'var(--color-teal)' : 'var(--color-warning)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            border: '1px solid rgba(255, 255, 255, 0.05)' 
                                        }}>
                                            <AlertCircle size={18} />
                                        </div>
                                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '13px', fontWeight: 900, color: 
                                            selectedEvent.status === 'completed' ? 'var(--color-teal)' :
                                            selectedEvent.status === 'cancelled' ? 'var(--color-danger)' :
                                            selectedEvent.status === 'rescheduled' ? 'var(--color-warning)' : 'var(--color-primary)'
                                        }}>
                                            {selectedEvent.status}
                                        </span>
                                    </div>
                                )}
                                {(selectedEvent.notes || selectedEvent.description) && (
                                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', marginTop: '8px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>NOTES</div>
                                        <div style={{ fontSize: '14px', lineHeight: 1.6, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>{selectedEvent.notes || selectedEvent.description}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '0 28px 28px', border: 'none', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShowQuickView(false)} style={{ height: '48px', fontWeight: 700 }}>Close</button>
                            {selectedEvent.displayType === 'homework' && (
                                <button type="button" className="btn btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px', fontWeight: 800 }} onClick={() => { setShowQuickView(false); navigate('/homework'); }}>
                                    View Tracker
                                </button>
                            )}
                            {selectedEvent.displayType === 'class' && (
                                <button type="button" className="btn btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px', fontWeight: 800 }} onClick={() => { setShowQuickView(false); openEdit(selectedEvent); }}>
                                    Edit Schedule
                                </button>
                            )}
                            {selectedEvent.displayType === 'exam' && (
                                <button type="button" className="btn btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px', fontWeight: 800 }} onClick={() => { setShowQuickView(false); navigate('/exams'); }}>
                                    Open Exams
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
