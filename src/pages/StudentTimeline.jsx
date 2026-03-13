import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, Calendar, ClipboardCheck, FileText, BookOpen, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentTimeline() {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const defaultStudentId = searchParams.get('studentId') || '';
    
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        if (currentUser) loadStudents();
    }, [currentUser]);

    useEffect(() => {
        if (selectedStudentId) {
            loadStudentEvents(selectedStudentId);
        } else {
            setEvents([]);
            setLoading(false);
        }
    }, [selectedStudentId, students]);

    async function loadStudents() {
        try {
            const uid = currentUser.uid;
            const snap = await getDocs(query(collection(db, 'students'), where('teacherId', '==', uid)));
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
        } finally {
            if (!selectedStudentId) setLoading(false);
        }
    }

    async function loadStudentEvents(studentId) {
        if (students.length === 0) return;
        setLoading(true);
        try {
            const uid = currentUser.uid;
            const student = students.find(s => s.id === studentId);
            const batchIds = student?.batchIds || [];

            const newEvents = [];

            // 1. Joined
            if (student?.createdAt) {
                const dateVal = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
                newEvents.push({
                    id: `join-${student.id}`,
                    type: 'System',
                    title: 'Student Profile Created',
                    description: `${student.name} was added to the system.`,
                    date: dateVal,
                    icon: <User size={16} />,
                    color: '#3b82f6' // blueprint blue
                });
            }

            // 2. Attendance (Present/Absent)
            if (batchIds.length > 0) {
                const attSnap = await getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid)));
                attSnap.docs.forEach(d => {
                    const data = d.data();
                    if (batchIds.includes(data.batchId)) {
                        const record = (data.records || []).find(r => r.studentId === studentId);
                        if (record) {
                            const dateVal = data.date.toDate ? data.date.toDate() : new Date(data.date);
                            const isPresent = record.status === 'present';
                            newEvents.push({
                                id: `att-${d.id}`,
                                type: 'Attendance',
                                title: isPresent ? 'Attended Class' : 'Missed Class',
                                description: isPresent ? 'Marked present for session.' : 'Marked absent.',
                                date: dateVal,
                                icon: <ClipboardCheck size={16} />,
                                color: isPresent ? '#14b8a6' : '#ef4444' // teal / red
                            });
                        }
                    }
                });
            }

            // 3. Exams
            if (batchIds.length > 0) {
                const examSnap = await getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid)));
                examSnap.docs.forEach(d => {
                    const data = d.data();
                    if (batchIds.includes(data.batchId)) {
                        const score = (data.scores || []).find(s => s.studentId === studentId);
                        if (score) {
                            const dateVal = data.date.toDate ? data.date.toDate() : new Date(data.date);
                            const perc = data.totalMarks > 0 ? Math.round((score.marksObtained / data.totalMarks) * 100) : 0;
                            newEvents.push({
                                id: `exam-${d.id}`,
                                type: 'Exam',
                                title: `Exam Taken: ${data.title}`,
                                description: `Scored ${score.marksObtained}/${data.totalMarks} (${perc}%)`,
                                date: dateVal,
                                icon: <FileText size={16} />,
                                color: '#f59e0b' // gold
                            });
                        }
                    }
                });
            }

            // 4. Homework (from SessionLogs)
            if (batchIds.length > 0) {
                const sessionLogsSnap = await getDocs(query(collection(db, 'sessionLogs'), where('teacherId', '==', uid)));
                sessionLogsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (batchIds.includes(data.batchId) && data.homeworkAssigned) {
                        const dateVal = data.date.toDate ? data.date.toDate() : new Date(data.date);
                        newEvents.push({
                            id: `hw-${d.id}`,
                            type: 'Homework',
                            title: `Homework Assigned`,
                            description: data.homeworkAssigned,
                            date: dateVal,
                            icon: <BookOpen size={16} />,
                            color: '#a78bfa' // purple
                        });
                    }
                });
            }

            // Sort descending
            newEvents.sort((a,b) => b.date - a.date);
            setEvents(newEvents);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const filteredEvents = events.filter(e => filter === 'All' || e.type === filter);

    if (loading && students.length === 0) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Activity Timeline</h1>
                    <p className="page-subtitle">Chronological feed of student events</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 250 }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                            <option value="">-- Choose a Student --</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter Events</label>
                        <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)}>
                            <option value="All">All Events</option>
                            <option value="Attendance">Attendance</option>
                            <option value="Exam">Exams</option>
                            <option value="Homework">Homework</option>
                            <option value="System">System</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading && selectedStudentId ? (
                <div className="loading-spinner" style={{ margin: 'var(--space-8) auto' }} />
            ) : selectedStudentId ? (
                <div className="timeline-container" style={{ position: 'relative', paddingLeft: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
                    {/* Vertical Line */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '32px', width: '2px', background: 'var(--color-border)' }} />
                    
                    {filteredEvents.length === 0 ? (
                        <div className="empty-state" style={{ marginLeft: 'var(--space-8)' }}>
                            <Clock size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)' }} />
                            <div className="empty-state-title">No events found</div>
                            <div className="empty-state-text">There is no historical data for this student matching your filter.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {filteredEvents.map(ev => (
                                <div key={ev.id} style={{ display: 'flex', gap: 'var(--space-4)', position: 'relative' }}>
                                    <div style={{ 
                                        width: 40, height: 40, borderRadius: 'var(--radius-full)', 
                                        background: ev.color, color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, zIndex: 1, boxShadow: '0 0 0 4px var(--color-bg-base)'
                                    }}>
                                        {ev.icon}
                                    </div>
                                    <div className="card" style={{ flex: 1, padding: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                            <h4 style={{ fontWeight: 600 }}>{ev.title}</h4>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {format(ev.date, 'MMM d, yyyy h:mm a')}
                                            </span>
                                        </div>
                                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                            {ev.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="empty-state card">
                    <User size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }} />
                    <div className="empty-state-title">No Student Selected</div>
                    <div className="empty-state-text">Select a student from the dropdown to view their timeline.</div>
                </div>
            )}
        </div>
    );
}
