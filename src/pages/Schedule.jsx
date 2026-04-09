import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { batchService } from '../services/batchService';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
    Plus, X, Calendar as CalIcon, Clock, AlertCircle, 
    RefreshCw, Info, CheckCircle2, UserCheck, CalendarDays, 
    Calendar as CalendarIcon, Filter, Layers, ChevronRight
} from 'lucide-react';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import toast from 'react-hot-toast';

export default function Schedule() {
    const { currentUser } = useAuth();
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
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            // Only load active batches for the calendar view
            const activeBatches = await batchService.getBatches(currentUser.uid, false);
            setBatches(activeBatches);

            const [schedSnap, studentSnap, examSnap, sessionLogSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'schedules'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', currentUser.uid), where('status', '==', 'enrolled'))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', currentUser.uid))),
            ]);

            setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setSessionLogs(sessionLogSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading schedules:', err);
        } finally {
            setLoading(false);
        }
    }

    function getCalendarEvents() {
        const loggedScheduleIds = new Set(sessionLogs.filter(l => l.scheduleId).map(l => l.scheduleId));

        const classEvents = schedules
            .filter(s => !filterBatch || s.batchId === filterBatch)
            .map((s) => {
                const dateStr = s.date?.toDate ? format(s.date.toDate(), 'yyyy-MM-dd') : s.date;
                let color = '#3b82f6'; 
                if (s.status === 'completed') color = '#14b8a6'; 
                if (s.status === 'cancelled') color = '#ef4444'; 
                if (s.status === 'rescheduled') color = '#f59e0b'; 

                return {
                    id: s.id,
                    title: `${s.batchName || ''}: ${s.title}`,
                    start: `${dateStr}T${s.startTime || '00:00:00'}`,
                    end: `${dateStr}T${s.endTime || '23:59:59'}`,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: { schedule: s, type: 'class' },
                };
            });

        const examEvents = exams
            .filter(e => !filterBatch || e.batchId === filterBatch)
            .map((e) => {
                const dateStr = e.date?.toDate ? format(e.date.toDate(), 'yyyy-MM-dd') : e.date;
                const color = '#8b5cf6'; 

                return {
                    id: `exam-${e.id}`,
                    title: `EXAM: ${e.title}`,
                    start: `${dateStr}T${e.startTime || '00:00:00'}`,
                    end: `${dateStr}T${e.endTime || '23:59:59'}`,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: { exam: e, type: 'exam' },
                };
            });

        const sessionLogEvents = sessionLogs
            .filter(l => !filterBatch || l.batchId === filterBatch)
            .filter(l => !l.scheduleId || !loggedScheduleIds.has(l.scheduleId))
            .map((l) => {
                const dateStr = l.date?.toDate ? format(l.date.toDate(), 'yyyy-MM-dd') : l.date;
                const color = '#f97316'; 
                return {
                    id: `log-${l.id}`,
                    title: `LOG: ${l.batchName || ''} — ${l.topicsCovered || 'Session'}`,
                    start: `${dateStr}T00:00:00`,
                    end: `${dateStr}T23:59:59`,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: { sessionLog: l, type: 'sessionLog' },
                };
            });

        const homeworkEvents = homeworks
            .filter(hw => !filterBatch || hw.batchId === filterBatch)
            .filter(hw => hw.dueDate)
            .map((hw) => {
                const dateStr = hw.dueDate?.toDate ? format(hw.dueDate.toDate(), 'yyyy-MM-dd') : hw.dueDate;
                const batchMsg = batches.find(b => b.id === hw.batchId)?.name || '';
                const color = '#ec4899'; 
                return {
                    id: `hw-${hw.id}`,
                    title: `HW DUE: ${hw.title}`,
                    start: `${dateStr}T23:59:59`,
                    allDay: true,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: { homework: hw, batchName: batchMsg, type: 'homework' },
                };
            });

        return [...classEvents, ...examEvents, ...sessionLogEvents, ...homeworkEvents];
    }

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

            const promises = matchDays.map(date => {
                const data = {
                    title: recurringForm.title || batch?.name || 'Class',
                    batchId: recurringForm.batchId,
                    batchName: batch?.name || '',
                    date: Timestamp.fromDate(date),
                    startTime: recurringForm.startTime,
                    endTime: recurringForm.endTime,
                    status: 'scheduled',
                    notes: recurringForm.notes,
                    teacherId: currentUser.uid,
                    createdAt: serverTimestamp(),
                };
                return addDoc(collection(db, 'schedules'), data);
            });

            await Promise.all(promises);
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
        const dateVal = schedule.date?.toDate ? schedule.date.toDate() : new Date(schedule.date);
        setEditingSchedule(schedule);
        setForm({
            title: schedule.title || '',
            batchId: schedule.batchId || '',
            date: format(dateVal, 'yyyy-MM-dd'),
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
            const batch = batches.find((b) => b.id === form.batchId);
            const data = {
                title: form.title || batch?.name || 'Class',
                batchId: form.batchId,
                batchName: batch?.name || '',
                date: Timestamp.fromDate(new Date(form.date)),
                startTime: form.startTime,
                endTime: form.endTime,
                status: form.status,
                notes: form.notes,
                teacherId: currentUser.uid,
            };

            if (editingSchedule) {
                await updateDoc(doc(db, 'schedules', editingSchedule.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'schedules'), data);
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
            await deleteDoc(doc(db, 'schedules', editingSchedule.id));
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
        setShowModal(false);
        setShowCompleteModal(true);
    }

    async function handleSaveCompleteSession(e) {
        e.preventDefault();
        try {
            const batch = batches.find(b => b.id === editingSchedule.batchId);
            const dateVal = editingSchedule.date;

            const sessionData = {
                batchId: editingSchedule.batchId,
                batchName: batch?.name || '',
                scheduleId: editingSchedule.id,
                date: dateVal,
                topicsCovered: completeForm.topicsCovered,
                notes: completeForm.notes,
                homeworkAssigned: completeForm.homeworkAssigned,
                teacherId: currentUser.uid,
                createdAt: serverTimestamp()
            };
            const logRef = await addDoc(collection(db, 'sessionLogs'), sessionData);

            if (completeForm.homeworkAssigned && completeForm.homeworkAssigned.trim()) {
                const baseDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
                const dueDate = new Date(baseDate);
                dueDate.setDate(dueDate.getDate() + 3);
                
                await addDoc(collection(db, 'homeworks'), {
                    title: completeForm.homeworkAssigned.substring(0, 80),
                    description: completeForm.homeworkAssigned,
                    batchId: editingSchedule.batchId,
                    dueDate: Timestamp.fromDate(dueDate),
                    teacherId: currentUser.uid,
                    completedBy: [],
                    submissions: {},
                    sessionLogId: logRef.id,
                    createdAt: serverTimestamp(),
                });
            }

            const recordsArray = Object.entries(attendanceRecords).map(([studentId, status]) => ({ studentId, status }));
            const attData = {
                batchId: editingSchedule.batchId,
                teacherId: currentUser.uid,
                date: dateVal,
                records: recordsArray,
                createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'attendance'), attData);

            await updateDoc(doc(db, 'schedules', editingSchedule.id), { status: 'completed' });

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
                date: Timestamp.fromDate(new Date(format(newDate, 'yyyy-MM-dd')))
            };
            
            if (!event.allDay) {
                updateData.startTime = format(newDate, 'HH:mm');
                if (event.end) {
                    updateData.endTime = format(event.end, 'HH:mm');
                }
            }
            
            if (props.type === 'class') {
                await updateDoc(doc(db, 'schedules', props.schedule.id), updateData);
                toast.success('Schedule updated!');
                loadData();
            } else if (props.type === 'exam') {
                await updateDoc(doc(db, 'exams', props.exam.id), updateData);
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
                await updateDoc(doc(db, 'schedules', props.schedule.id), {
                    endTime: format(event.end, 'HH:mm')
                });
                toast.success('Schedule duration updated!');
                loadData();
            } else if (props.type === 'exam') {
                await updateDoc(doc(db, 'exams', props.exam.id), {
                    endTime: format(event.end, 'HH:mm')
                });
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
                        <h1 className="page-title" style={{ margin: 0 }}>Operations Timeline</h1>
                    </div>
                    <p className="page-subtitle">Personalised view of classes, exams and deadlines</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <button className="btn btn-secondary" onClick={() => openRecurringCreate()} style={{ height: '48px', padding: '0 24px', borderRadius: '14px', fontWeight: 700 }}>
                        <RefreshCw size={18} /> Batch Recurring
                    </button>
                    <button className="btn btn-primary" onClick={() => openCreate()} style={{ height: '48px', padding: '0 24px', borderRadius: '14px', fontWeight: 800, boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)' }}>
                        <Plus size={20} /> New Segment
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flex: 1, minWidth: '300px' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '280px' }}>
                        <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 900, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Filter size={14} /> Batch Stream
                        </label>
                        <select className="form-select" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} style={{ height: '48px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', fontWeight: 700 }}>
                            <option value="">All Operational Streams</option>
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
                            if (props.type === 'sessionLog') {
                                navigate(`/sessions?batchId=${props.sessionLog.batchId || ''}`);
                                return;
                            }
                            
                            let eventData;
                            if (props.type === 'exam') eventData = props.exam;
                            else if (props.type === 'homework') eventData = props.homework;
                            else eventData = props.schedule;

                            setSelectedEvent({ 
                                ...eventData, 
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
                                <h2 className="modal-title" style={{ fontSize: '22px', fontWeight: 900 }}>{editingSchedule ? 'Edit Timeline Segment' : 'Schedule New Segment'}</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} style={{ borderRadius: '12px' }}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body" style={{ padding: '32px', gap: '24px' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Target Operational Stream *</label>
                                    <select className="form-select" value={form.batchId} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, batchId: e.target.value, title: batches.find(b => b.id === e.target.value)?.name || form.title })}>
                                        <option value="">Select Stream...</option>
                                        {batches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Segment Designation</label>
                                    <input className="form-input" placeholder="e.g., Weekly Math Session" value={form.title} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Execution Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" type="date" value={form.date} style={{ height: '52px', borderRadius: '14px', fontWeight: 700, paddingLeft: '48px' }}
                                            onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                        <CalendarDays size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Commencement</label>
                                        <input className="form-input" type="time" value={form.startTime} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Completion</label>
                                        <input className="form-input" type="time" value={form.endTime} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Clearance Status</label>
                                    <select className="form-select" value={form.status} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="rescheduled">Rescheduled</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Operational Intelligence</label>
                                    <textarea className="form-textarea" value={form.notes} style={{ borderRadius: '16px', padding: '16px', fontWeight: 600 }}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Add specific operational directives..." />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: '24px 32px 32px', border: 'none', background: 'rgba(255, 255, 255, 0.02)' }}>
                                {editingSchedule && (
                                    <div style={{ marginRight: 'auto', display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-danger" onClick={handleDelete} style={{ borderRadius: '12px', height: '48px', padding: '0 20px', fontWeight: 700 }}>
                                            Purge
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={openCompleteSession} style={{ borderRadius: '12px', height: '48px', padding: '0 20px', fontWeight: 700 }}>
                                            Finalize & Track
                                        </button>
                                    </div>
                                )}
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ height: '48px', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 32px', borderRadius: '14px', fontWeight: 800 }}>
                                    {editingSchedule ? 'Update Timeline' : 'Commit Schedule'}
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
                                <h2 className="modal-title" style={{ fontSize: '22px', fontWeight: 900 }}>Streaming Recursion Setup</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowRecurringModal(false)}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleSaveRecurring}>
                            <div className="modal-body" style={{ padding: '32px', gap: '24px' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Target Operational Stream *</label>
                                    <select className="form-select" value={recurringForm.batchId} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }} 
                                        onChange={(e) => setRecurringForm({...recurringForm, batchId: e.target.value})}>
                                        <option value="">Select Stream...</option>
                                        {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Operational Cycles *</label>
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
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Commencement Date *</label>
                                        <input className="form-input" type="date" value={recurringForm.startDate} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, startDate: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Termination Date *</label>
                                        <input className="form-input" type="date" value={recurringForm.endDate} required min={recurringForm.startDate} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, endDate: e.target.value})} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Sync Start *</label>
                                        <input className="form-input" type="time" value={recurringForm.startTime} required style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, startTime: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Sync End</label>
                                        <input className="form-input" type="time" value={recurringForm.endTime} style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setRecurringForm({...recurringForm, endTime: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: '24px 32px 32px', border: 'none' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowRecurringModal(false)} style={{ height: '48px', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 32px', borderRadius: '14px', fontWeight: 800 }}>Generate Continuous Stream</button>
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
                                <h2 className="modal-title" style={{ fontSize: '24px', fontWeight: 950 }}>Finalize Mission & Registry</h2>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCompleteModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSaveCompleteSession}>
                            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '48px', padding: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-accent)' }}>
                                        <Info size={18} />
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational Summary</h3>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', color: 'var(--color-text-muted)' }}>TOPICS EXPLORED *</label>
                                        <input className="form-input" value={completeForm.topicsCovered} placeholder="e.g., Quantum Entanglement Basics" style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }}
                                            onChange={(e) => setCompleteForm({...completeForm, topicsCovered: e.target.value})} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', color: 'var(--color-text-muted)' }}>INTELLIGENCE DIRECTIVES (HOMEWORK)</label>
                                        <textarea className="form-textarea" value={completeForm.homeworkAssigned} style={{ borderRadius: '18px', padding: '16px', fontWeight: 600 }}
                                            onChange={(e) => setCompleteForm({...completeForm, homeworkAssigned: e.target.value})} rows={4} placeholder="Deploy mission directives to students..." />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 800, fontSize: '12px', color: 'var(--color-text-muted)' }}>PRIVATE DEBRIEF NOTES</label>
                                        <textarea className="form-textarea" value={completeForm.notes} style={{ borderRadius: '18px', padding: '16px', fontWeight: 600 }}
                                            onChange={(e) => setCompleteForm({...completeForm, notes: e.target.value})} rows={3} placeholder="Confidential observations about the stream..." />
                                    </div>
                                </div>

                                <div className="glass-card" style={{ padding: '32px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', color: 'var(--color-accent)' }}>
                                        <UserCheck size={20} />
                                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Registry</h3>
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
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCompleteModal(false)} style={{ height: '52px', fontWeight: 800 }}>Abort Mission</button>
                                <button type="submit" className="btn btn-primary" style={{ height: '52px', padding: '0 40px', borderRadius: '16px', fontWeight: 900, boxShadow: '0 10px 30px -5px rgba(20, 184, 166, 0.4)' }}>
                                    Commit Mission Archive
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
                                {selectedEvent.displayType === 'exam' ? '📋 Protocol: Exam' : 
                                 selectedEvent.displayType === 'homework' ? '📚 Brief: Mission' :
                                 '🕒 Segment: Class'}
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowQuickView(false)} style={{ borderRadius: '12px' }}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 28px 28px' }}>
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '22px', fontWeight: 900, color: 'white', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{selectedEvent.title}</h3>
                                {(selectedEvent.batchName || selectedEvent.displayBatchName) && (
                                    <div style={{ display: 'inline-flex', marginTop: '12px', padding: '4px 12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 800 }}>
                                        Stream: {selectedEvent.batchName || selectedEvent.displayBatchName}
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
                                            ? (selectedEvent.dueDate?.toDate ? format(selectedEvent.dueDate.toDate(), 'PPP') : selectedEvent.dueDate)
                                            : (selectedEvent.date?.toDate ? format(selectedEvent.date.toDate(), 'PPP') : selectedEvent.date)
                                        }
                                    </span>
                                </div>
                                {(selectedEvent.startTime || selectedEvent.endTime) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                            <Clock size={18} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{selectedEvent.startTime ? format(new Date(`2000-01-01T${selectedEvent.startTime}`), 'h:mm a') : 'Start'} <ChevronRight size={14} style={{ opacity: 0.3 }} /> {selectedEvent.endTime ? format(new Date(`2000-01-01T${selectedEvent.endTime}`), 'h:mm a') : 'End'}</span>
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
                                        <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>INTELLIGENCE_REMARKS</div>
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
