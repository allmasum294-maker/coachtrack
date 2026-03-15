import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, X, Calendar as CalIcon, Clock, AlertCircle, RefreshCw, Info } from 'lucide-react';
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
            const [schedSnap, batchSnap, studentSnap, examSnap, sessionLogSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'schedules'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', currentUser.uid))),
            ]);
            setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
        // Build a set of schedule IDs that have session logs
        const loggedScheduleIds = new Set(sessionLogs.filter(l => l.scheduleId).map(l => l.scheduleId));

        const classEvents = schedules
            .filter(s => !filterBatch || s.batchId === filterBatch)
            .map((s) => {
                const dateStr = s.date?.toDate ? format(s.date.toDate(), 'yyyy-MM-dd') : s.date;
                let color = '#3b82f6'; // Blue for scheduled
                if (s.status === 'completed') color = '#10b981'; // Green
                if (s.status === 'cancelled') color = '#ef4444'; // Red
                if (s.status === 'rescheduled') color = '#f59e0b'; // Amber

                return {
                    id: s.id,
                    title: `${s.batchName || ''}: ${s.title}`,
                    start: `${dateStr}T${s.startTime || '00:00:00'}`,
                    end: `${dateStr}T${s.endTime || '23:59:59'}`,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: { schedule: s, type: 'class' },
                };
            });

        const examEvents = exams
            .filter(e => !filterBatch || e.batchId === filterBatch)
            .map((e) => {
                const dateStr = e.date?.toDate ? format(e.date.toDate(), 'yyyy-MM-dd') : e.date;
                const color = '#8b5cf6'; // Violet/Purple for Exams

                return {
                    id: `exam-${e.id}`,
                    title: `EXAM: ${e.title}`,
                    start: `${dateStr}T${e.startTime || '00:00:00'}`,
                    end: `${dateStr}T${e.endTime || '23:59:59'}`,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: { exam: e, type: 'exam' },
                };
            });

        // Session log events (only for logs NOT already linked to a schedule that is shown)
        const sessionLogEvents = sessionLogs
            .filter(l => !filterBatch || l.batchId === filterBatch)
            .filter(l => !l.scheduleId || !loggedScheduleIds.has(l.scheduleId))
            .map((l) => {
                const dateStr = l.date?.toDate ? format(l.date.toDate(), 'yyyy-MM-dd') : l.date;
                const color = '#f97316'; // Orange for session logs
                return {
                    id: `log-${l.id}`,
                    title: `LOG: ${l.batchName || ''} — ${l.topicsCovered || 'Session'}`,
                    start: `${dateStr}T00:00:00`,
                    end: `${dateStr}T23:59:59`,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: { sessionLog: l, type: 'sessionLog' },
                };
            });

        // Homework Events
        const homeworkEvents = homeworks
            .filter(hw => !filterBatch || hw.batchId === filterBatch)
            .filter(hw => hw.dueDate)
            .map((hw) => {
                const dateStr = hw.dueDate?.toDate ? format(hw.dueDate.toDate(), 'yyyy-MM-dd') : hw.dueDate;
                const batchMsg = batches.find(b => b.id === hw.batchId)?.name || '';
                const color = '#ec4899'; // Pink for Homework
                return {
                    id: `hw-${hw.id}`,
                    title: `HW DUE: ${hw.title}`,
                    start: `${dateStr}T23:59:59`, // Homework typically due end of day
                    allDay: true,
                    backgroundColor: color,
                    borderColor: color,
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
        } catch (err) {
            console.error('Error saving schedule:', err);
        }
    }

    async function handleDelete() {
        if (!editingSchedule || !confirm('Delete this scheduled class?')) return;
        try {
            await deleteDoc(doc(db, 'schedules', editingSchedule.id));
            setShowModal(false);
            loadData();
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
            
            // Only update time if it was dropped on a time slot
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

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    const calendarLegend = [
        { color: '#3b82f6', label: 'Scheduled' },
        { color: '#10b981', label: 'Completed' },
        { color: '#ef4444', label: 'Cancelled' },
        { color: '#f59e0b', label: 'Rescheduled' },
        { color: '#8b5cf6', label: 'Exam' },
        { color: '#f97316', label: 'Session Log' },
        { color: '#ec4899', label: 'HW Due' },
    ];

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Schedule</h1>
                    <p className="page-subtitle">Manage your class schedule and calendar</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-secondary" onClick={() => openRecurringCreate()}>
                        <RefreshCw size={18} /> Create Recurring
                    </button>
                    <button className="btn btn-primary" onClick={() => openCreate()}>
                        <Plus size={18} /> Schedule Class
                    </button>
                </div>
            </div>

            {/* Batch Filter + Color Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <select className="form-select" style={{ width: 240 }} value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                    {calendarLegend.map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: item.color }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)' }}>
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
                            displayBatchName: props.batchName // used for homework 
                        });
                        setShowQuickView(true);
                    }}
                    editable={true}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    height="auto"
                    aspectRatio={1.8}
                />
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingSchedule ? 'Edit Class' : 'Schedule New Class'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Class Title</label>
                                    <input className="form-input" placeholder="e.g., Class 9 English" value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Batch</label>
                                    <select className="form-select" value={form.batchId}
                                        onChange={(e) => setForm({ ...form, batchId: e.target.value, title: batches.find(b => b.id === e.target.value)?.name || form.title })}>
                                        <option value="">Select Batch</option>
                                        {batches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input className="form-input" type="date" value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start Time</label>
                                        <input className="form-input" type="time" value={form.startTime}
                                            onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Time</label>
                                        <input className="form-input" type="time" value={form.endTime}
                                            onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="rescheduled">Rescheduled</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-textarea" value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                {editingSchedule && (
                                    <div style={{ marginRight: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
                                        <button type="button" className="btn btn-danger" onClick={handleDelete}>
                                            Delete
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={openCompleteSession}>
                                            Complete Session & Attendance
                                        </button>
                                    </div>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingSchedule ? 'Save' : 'Schedule'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Recurring Modal */}
            {showRecurringModal && (
                <div className="modal-overlay" onClick={() => setShowRecurringModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Schedule Recurring Classes</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowRecurringModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRecurring}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Title (Optional)</label>
                                    <input className="form-input" placeholder="e.g., Weekly Math" value={recurringForm.title} onChange={(e) => setRecurringForm({...recurringForm, title: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Batch *</label>
                                    <select className="form-select" value={recurringForm.batchId} required onChange={(e) => setRecurringForm({...recurringForm, batchId: e.target.value})}>
                                        <option value="">Select Batch</option>
                                        {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Days of Week *</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {daysOfWeek.map(d => (
                                            <button 
                                                type="button" 
                                                key={d.value} 
                                                onClick={() => toggleRecurringDay(d.value)}
                                                className={`badge ${recurringForm.days.includes(d.value) ? 'badge-primary' : 'badge-neutral'}`}
                                                style={{ cursor: 'pointer', padding: 'var(--space-2) var(--space-4)' }}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start Date *</label>
                                        <input className="form-input" type="date" value={recurringForm.startDate} required onChange={(e) => setRecurringForm({...recurringForm, startDate: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Repeat Until Date *</label>
                                        <input className="form-input" type="date" value={recurringForm.endDate} required min={recurringForm.startDate} onChange={(e) => setRecurringForm({...recurringForm, endDate: e.target.value})} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start Time *</label>
                                        <input className="form-input" type="time" value={recurringForm.startTime} required onChange={(e) => setRecurringForm({...recurringForm, startTime: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Time</label>
                                        <input className="form-input" type="time" value={recurringForm.endTime} onChange={(e) => setRecurringForm({...recurringForm, endTime: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRecurringModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Generate Classes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Complete Session Modal */}
            {showCompleteModal && editingSchedule && (
                <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Log Session & Attendance</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCompleteModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveCompleteSession}>
                            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-6)' }}>
                                {/* Left Side: Session Log */}
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Session Details</h3>
                                    <div className="form-group">
                                        <label className="form-label">Topics Covered *</label>
                                        <input className="form-input" value={completeForm.topicsCovered} onChange={(e) => setCompleteForm({...completeForm, topicsCovered: e.target.value})} placeholder="e.g., Intro to Algebra" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Homework Assigned</label>
                                        <textarea className="form-textarea" value={completeForm.homeworkAssigned} onChange={(e) => setCompleteForm({...completeForm, homeworkAssigned: e.target.value})} rows={2} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Private Notes</label>
                                        <textarea className="form-textarea" value={completeForm.notes} onChange={(e) => setCompleteForm({...completeForm, notes: e.target.value})} rows={2} />
                                    </div>
                                </div>

                                {/* Right Side: Attendance */}
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Attendance</h3>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
                                        {students.filter(s => (s.batchIds || []).includes(editingSchedule.batchId)).map(student => (
                                            <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                                                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{student.name}</div>
                                                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                    <button type="button" onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'present'})} className={`btn btn-sm ${attendanceRecords[student.id] === 'present' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '4px 8px' }}>P</button>
                                                    <button type="button" onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'absent'})} className={`btn btn-sm ${attendanceRecords[student.id] === 'absent' ? 'btn-danger' : 'btn-ghost'}`} style={{ padding: '4px 8px' }}>A</button>
                                                    <button type="button" onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'late'})} className={`btn btn-sm ${attendanceRecords[student.id] === 'late' ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '4px 8px' }}>L</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Session & Attendance</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick View Modal */}
            {showQuickView && selectedEvent && (
                <div className="modal-overlay" onClick={() => setShowQuickView(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {selectedEvent.displayType === 'exam' ? 'Exam Details' : 
                                 selectedEvent.displayType === 'homework' ? 'Homework Due' :
                                 'Class Details'}
                            </h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowQuickView(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectedEvent.title}</h3>
                                {(selectedEvent.batchName || selectedEvent.displayBatchName) && (
                                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                        Batch: {selectedEvent.batchName || selectedEvent.displayBatchName}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <CalIcon size={18} style={{ color: 'var(--color-text-secondary)' }} />
                                    <span>
                                        {selectedEvent.displayType === 'homework' 
                                            ? (selectedEvent.dueDate?.toDate ? format(selectedEvent.dueDate.toDate(), 'PPP') : selectedEvent.dueDate)
                                            : (selectedEvent.date?.toDate ? format(selectedEvent.date.toDate(), 'PPP') : selectedEvent.date)
                                        }
                                    </span>
                                </div>
                                {(selectedEvent.startTime || selectedEvent.endTime) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <Clock size={18} style={{ color: 'var(--color-text-secondary)' }} />
                                        <span>{selectedEvent.startTime ? format(new Date(`2000-01-01T${selectedEvent.startTime}`), 'h:mm a') : 'Start'} - {selectedEvent.endTime ? format(new Date(`2000-01-01T${selectedEvent.endTime}`), 'h:mm a') : 'End'}</span>
                                    </div>
                                )}
                                {selectedEvent.notes && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                        <Info size={18} style={{ color: 'var(--color-text-secondary)', marginTop: 2 }} />
                                        <span>{selectedEvent.notes}</span>
                                    </div>
                                )}
                                {selectedEvent.description && selectedEvent.displayType === 'homework' && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                                        <Info size={18} style={{ color: 'var(--color-text-secondary)', marginTop: 2 }} />
                                        <span>{selectedEvent.description}</span>
                                    </div>
                                )}
                                {selectedEvent.status && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <AlertCircle size={18} style={{ color: 'var(--color-text-secondary)' }} />
                                        <span style={{ textTransform: 'capitalize', fontWeight: 500, color: 
                                            selectedEvent.status === 'completed' ? 'var(--color-success)' :
                                            selectedEvent.status === 'cancelled' ? 'var(--color-danger)' :
                                            selectedEvent.status === 'rescheduled' ? 'var(--color-warning)' : 'var(--color-primary)'
                                        }}>
                                            {selectedEvent.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                            {selectedEvent.displayType === 'homework' && (
                                <button type="button" className="btn btn-primary" onClick={() => {
                                    setShowQuickView(false);
                                    navigate('/homework');
                                }}>
                                    Go to Homework
                                </button>
                            )}
                            {selectedEvent.displayType === 'class' && (
                                <button type="button" className="btn btn-primary" onClick={() => {
                                    setShowQuickView(false);
                                    openEdit(selectedEvent);
                                }}>
                                    Edit Details
                                </button>
                            )}
                            {selectedEvent.displayType === 'exam' && (
                                <button type="button" className="btn btn-primary" onClick={() => {
                                    setShowQuickView(false);
                                    navigate('/exams');
                                }}>
                                    Go to Exams
                                </button>
                            )}
                            <button type="button" className="btn btn-secondary" onClick={() => setShowQuickView(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
