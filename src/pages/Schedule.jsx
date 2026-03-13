import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, X, Calendar as CalIcon, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function Schedule() {
    const { currentUser } = useAuth();
    const [schedules, setSchedules] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [form, setForm] = useState({
        title: '', batchId: '', date: '', startTime: '', endTime: '', status: 'scheduled', notes: '',
    });

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const [schedSnap, batchSnap] = await Promise.all([
                getDocs(query(collection(db, 'schedules'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
            ]);
            setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading schedules:', err);
        } finally {
            setLoading(false);
        }
    }

    function getCalendarEvents() {
        return schedules.map((s) => {
            const dateVal = s.date?.toDate ? s.date.toDate() : new Date(s.date);
            const dateStr = format(dateVal, 'yyyy-MM-dd');
            return {
                id: s.id,
                title: s.title || 'Class',
                start: s.startTime ? `${dateStr}T${s.startTime}` : dateStr,
                end: s.endTime ? `${dateStr}T${s.endTime}` : undefined,
                backgroundColor: s.status === 'cancelled' ? 'var(--color-danger)' :
                    s.status === 'rescheduled' ? 'var(--color-warning)' : 'var(--color-accent)',
                borderColor: 'transparent',
                extendedProps: { schedule: s },
            };
        });
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

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Schedule</h1>
                    <p className="page-subtitle">Manage your class schedule and calendar</p>
                </div>
                <button className="btn btn-primary" onClick={() => openCreate()}>
                    <Plus size={18} /> Schedule Class
                </button>
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
                    eventClick={(info) => openEdit(info.event.extendedProps.schedule)}
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
                                    <button type="button" className="btn btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
                                        Delete
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingSchedule ? 'Save' : 'Schedule'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
