import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileText, Plus, Edit2, Trash2, X, Eye, Trophy, TrendingUp, Users, ClipboardCheck, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Exams() {
    const { currentUser } = useAuth();
    const [exams, setExams] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showScoresModal, setShowScoresModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [scoringExam, setScoringExam] = useState(null);
    const [leaderboardExam, setLeaderboardExam] = useState(null);
    const [studentScores, setStudentScores] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState({});
    const [filterBatch, setFilterBatch] = useState('');
    const [form, setForm] = useState({
        title: '', batchId: '', date: '', startTime: '', endTime: '', totalMarks: 100,
    });
    // Structured topic config: [{name, maxMarks}]
    const [topicConfig, setTopicConfig] = useState([]);
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicMarks, setNewTopicMarks] = useState('');

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const [examSnap, batchSnap, studentSnap] = await Promise.all([
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', currentUser.uid))),
                getDocs(query(collection(db, 'students'), where('teacherId', '==', currentUser.uid))),
            ]);
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    // Helper: get topics from exam (supports both old and new format)
    function getExamTopics(exam) {
        if (exam.topicConfig && exam.topicConfig.length > 0) {
            return exam.topicConfig; // new format: [{name, maxMarks}]
        }
        // Old format: topics: ["MCQ", ...] — no maxMarks info
        if (exam.topics && exam.topics.length > 0) {
            return exam.topics.map(t => ({ name: t, maxMarks: null }));
        }
        return [];
    }

    function openCreate() {
        setEditingExam(null);
        setForm({
            title: '', batchId: '', date: format(new Date(), 'yyyy-MM-dd'),
            startTime: '09:00', endTime: '10:00', totalMarks: 100,
        });
        setTopicConfig([]);
        setNewTopicName('');
        setNewTopicMarks('');
        setShowModal(true);
    }

    function openEdit(exam) {
        setEditingExam(exam);
        const dateVal = exam.date?.toDate ? format(exam.date.toDate(), 'yyyy-MM-dd') : exam.date || '';
        setForm({
            title: exam.title, batchId: exam.batchId, date: dateVal,
            startTime: exam.startTime || '09:00', endTime: exam.endTime || '10:00',
            totalMarks: exam.totalMarks || 100,
        });
        setTopicConfig(getExamTopics(exam));
        setNewTopicName('');
        setNewTopicMarks('');
        setShowModal(true);
    }

    function addTopic() {
        if (!newTopicName.trim()) return toast.error('Topic name is required');
        if (!newTopicMarks || parseFloat(newTopicMarks) <= 0) return toast.error('Max marks must be > 0');
        setTopicConfig(prev => [...prev, { name: newTopicName.trim(), maxMarks: parseFloat(newTopicMarks) }]);
        setNewTopicName('');
        setNewTopicMarks('');
    }

    function removeTopic(idx) {
        setTopicConfig(prev => prev.filter((_, i) => i !== idx));
    }

    function getTopicTotal() {
        return topicConfig.reduce((sum, t) => sum + (parseFloat(t.maxMarks) || 0), 0);
    }

    function openAttendance(exam) {
        setScoringExam(exam);
        const records = {};
        const studentsInBatch = students.filter(s => (s.batchIds || []).includes(exam.batchId));
        studentsInBatch.forEach(s => {
            records[s.id] = (exam.attendance || {})[s.id] || 'present';
        });
        setAttendanceRecords(records);
        setShowAttendanceModal(true);
    }

    async function handleSaveAttendance(e) {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'exams', scoringExam.id), {
                attendance: attendanceRecords
            });

            const dateVal = scoringExam.date?.toDate ? format(scoringExam.date.toDate(), 'yyyy-MM-dd') : scoringExam.date;
            const snap = await getDocs(
                query(
                    collection(db, 'attendance'),
                    where('teacherId', '==', currentUser.uid),
                    where('batchId', '==', scoringExam.batchId),
                )
            );

            const existing = snap.docs.find((d) => {
                const data = d.data();
                const dDate = data.date?.toDate ? format(data.date.toDate(), 'yyyy-MM-dd') : data.date;
                return dDate === dateVal;
            });

            if (existing) {
                const data = existing.data();
                const updatedRecords = [...(data.records || [])];
                Object.entries(attendanceRecords).forEach(([studentId, status]) => {
                    const idx = updatedRecords.findIndex(r => r.studentId === studentId);
                    if (idx > -1) {
                        if (status === 'present') updatedRecords[idx].status = 'present';
                    } else {
                        if (status === 'present') updatedRecords.push({ studentId, status: 'present' });
                    }
                });
                await updateDoc(doc(db, 'attendance', existing.id), { records: updatedRecords });
            } else {
                const batchStudents = students.filter(s => (s.batchIds || []).includes(scoringExam.batchId));
                const recordsArray = batchStudents.map(s => ({
                    studentId: s.id,
                    status: attendanceRecords[s.id] || 'present'
                }));
                await addDoc(collection(db, 'attendance'), {
                    batchId: scoringExam.batchId,
                    teacherId: currentUser.uid,
                    date: scoringExam.date,
                    records: recordsArray,
                    createdAt: serverTimestamp()
                });
            }

            setShowAttendanceModal(false);
            loadData();
            toast.success('Exam attendance updated & synced');
        } catch (err) {
            console.error(err);
            toast.error('Failed to update attendance');
        }
    }

    function openScores(exam) {
        setScoringExam(exam);
        const presentStudents = students.filter(s => {
            const inBatch = (s.batchIds || []).includes(exam.batchId);
            const attended = exam.attendance?.[s.id] === 'present' || !exam.attendance;
            return inBatch && attended;
        });

        const scores = presentStudents.map((s) => {
            const existing = (exam.scores || []).find((sc) => sc.studentId === s.id);
            return {
                studentId: s.id,
                name: s.name,
                marksObtained: existing ? existing.marksObtained : '',
                topicMarks: existing ? existing.topicMarks || {} : {},
                remarks: existing ? existing.remarks : '',
            };
        });
        setStudentScores(scores);
        setShowScoresModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            // If topics are defined, validate total
            const hasTopics = topicConfig.length > 0;
            const computedTotal = hasTopics ? getTopicTotal() : parseFloat(form.totalMarks) || 100;

            const data = {
                title: form.title,
                date: Timestamp.fromDate(new Date(form.date)),
                startTime: form.startTime || '00:00',
                endTime: form.endTime || '00:00',
                batchId: form.batchId,
                batchName: batches.find((b) => b.id === form.batchId)?.name || '',
                totalMarks: computedTotal,
                // New structured format
                topicConfig: topicConfig,
                // Keep old format for backward compat
                topics: topicConfig.map(t => t.name),
                teacherId: currentUser.uid,
            };
            if (editingExam) {
                await updateDoc(doc(db, 'exams', editingExam.id), data);
            } else {
                data.createdAt = serverTimestamp();
                data.scores = [];
                data.attendance = {};
                await addDoc(collection(db, 'exams'), data);
            }
            setShowModal(false);
            loadData();
            toast.success('Exam saved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to save.');
        }
    }

    async function handleSaveScores() {
        if (!scoringExam) return;
        try {
            const examTopics = getExamTopics(scoringExam);
            const hasTopics = examTopics.length > 0;
            const scoresArray = studentScores
                .filter((v) => {
                    if (hasTopics) {
                        return examTopics.some(t => v.topicMarks && v.topicMarks[t.name] !== undefined && v.topicMarks[t.name] !== '');
                    }
                    return v.marksObtained !== '';
                })
                .map((v) => {
                    let sum = 0;
                    if (hasTopics) {
                        for (let t of examTopics) {
                            sum += parseFloat(v.topicMarks[t.name]) || 0;
                        }
                    } else {
                        sum = parseFloat(v.marksObtained) || 0;
                    }
                    return {
                        studentId: v.studentId,
                        marksObtained: sum,
                        topicMarks: v.topicMarks || {},
                        remarks: v.remarks || '',
                    };
                });
            await updateDoc(doc(db, 'exams', scoringExam.id), { scores: scoresArray });
            setShowScoresModal(false);
            loadData();
            toast.success('Scores saved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to save scores.');
        }
    }

    async function handleDelete(examId) {
        if (!confirm('Delete this exam?')) return;
        try {
            await deleteDoc(doc(db, 'exams', examId));
            loadData();
        } catch (err) {
            console.error('Error:', err);
        }
    }

    function getExamStats(exam) {
        const s = exam.scores || [];
        if (s.length === 0) return { avg: 0, highest: 0, lowest: 0, count: 0 };
        const marks = s.map((x) => x.marksObtained);
        return {
            avg: Math.round(marks.reduce((a, b) => a + b, 0) / marks.length),
            highest: Math.max(...marks),
            lowest: Math.min(...marks),
            count: s.length,
        };
    }

    function getTopicAnalytics(exam) {
        const examTopics = getExamTopics(exam);
        if (examTopics.length === 0) return [];
        const scores = exam.scores || [];
        if (scores.length === 0) return examTopics.map(t => ({ ...t, avg: 0, count: 0 }));

        return examTopics.map(t => {
            let sum = 0;
            let count = 0;
            scores.forEach(s => {
                const mark = parseFloat(s.topicMarks?.[t.name]);
                if (!isNaN(mark)) {
                    sum += mark;
                    count++;
                }
            });
            return {
                name: t.name,
                maxMarks: t.maxMarks,
                avg: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
                count,
            };
        });
    }

    function getBatchName(batchId) {
        return batches.find((b) => b.id === batchId)?.name || '';
    }

    const filteredExams = exams.filter((e) => !filterBatch || e.batchId === filterBatch)
        .sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return db2 - da;
        });

    if (loading) {
        return <div className="loading-page"><div className="loading-spinner" /></div>;
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Exams & Assessments</h1>
                    <p className="page-subtitle">Track tests and student performance</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={18} /> Create Exam
                </button>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <select className="form-select" style={{ width: 220 }} value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
            </div>

            {filteredExams.length === 0 ? (
                <div className="card"><div className="empty-state">
                    <FileText size={48} className="empty-state-icon" />
                    <div className="empty-state-title">No exams yet</div>
                    <div className="empty-state-text">Create an exam to start tracking student performance.</div>
                </div></div>
            ) : (
                <div className="grid-2">
                    {filteredExams.map((exam) => {
                        const stats = getExamStats(exam);
                        const dateVal = exam.date?.toDate ? exam.date.toDate() : new Date(exam.date);
                        const topicAnalytics = getTopicAnalytics(exam);
                        return (
                            <div key={exam.id} className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">{exam.title}</div>
                                        <div className="card-subtitle">{getBatchName(exam.batchId)} · {format(dateVal, 'MMM d, yyyy')}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setLeaderboardExam(exam); setShowLeaderboardModal(true); }} title="View Leaderboard">
                                            <Trophy size={16} style={{ color: 'var(--color-gold)' }} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openAttendance(exam)} title="Mark Attendance">
                                            <Users size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openScores(exam)} title="Enter Scores">
                                            <ClipboardCheck size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(exam)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(exam.id)}>
                                            <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Overall Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-accent)' }}>{stats.avg}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Average</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-success)' }}>{stats.highest}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Highest</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-danger)' }}>{stats.lowest}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Lowest</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{stats.count}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Scored</div>
                                    </div>
                                </div>

                                {/* Topic-Level Analytics */}
                                {topicAnalytics.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic Breakdown</div>
                                        {topicAnalytics.map((t, i) => {
                                            const perc = t.maxMarks > 0 ? Math.round((t.avg / t.maxMarks) * 100) : 0;
                                            return (
                                                <div key={i} style={{ marginBottom: i < topicAnalytics.length - 1 ? 'var(--space-2)' : 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
                                                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                                            {t.maxMarks != null ? `Avg ${t.avg}/${t.maxMarks} (${perc}%)` : `Avg ${t.avg}`}
                                                        </span>
                                                    </div>
                                                    {t.maxMarks != null && (
                                                        <div className="progress-bar" style={{ height: 6 }}>
                                                            <div className="progress-bar-fill" style={{
                                                                width: `${perc}%`,
                                                                background: perc >= 70 ? 'var(--color-success)' : perc >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
                                                            }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div style={{ marginTop: 'var(--space-3)' }}>
                                    <div className="progress-bar">
                                        <div className="progress-bar-fill" style={{ width: `${exam.totalMarks > 0 ? (stats.avg / exam.totalMarks) * 100 : 0}%` }} />
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                                        Avg: {stats.avg} / {exam.totalMarks}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{editingExam ? 'Edit Exam' : 'Create Exam'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Exam Title *</label>
                                    <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Mid-term Exam" />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Batch *</label>
                                        <select className="form-select" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} required>
                                            <option value="">Select</option>
                                            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Exam Date *</label>
                                        <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start Time</label>
                                        <input className="form-input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Time</label>
                                        <input className="form-input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                                    </div>
                                </div>

                                {/* Topic Builder */}
                                <div className="form-group">
                                    <label className="form-label">Topics & Marks Allocation</label>
                                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        {/* Add new topic row */}
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)' }}>
                                            <input
                                                className="form-input"
                                                placeholder="Topic name (e.g., MCQ)"
                                                value={newTopicName}
                                                onChange={(e) => setNewTopicName(e.target.value)}
                                                style={{ flex: 2 }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                                            />
                                            <input
                                                className="form-input"
                                                type="number"
                                                placeholder="Max Marks"
                                                min="1"
                                                value={newTopicMarks}
                                                onChange={(e) => setNewTopicMarks(e.target.value)}
                                                style={{ flex: 1 }}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                                            />
                                            <button type="button" className="btn btn-primary" onClick={addTopic} style={{ padding: '0 12px', flexShrink: 0 }}>
                                                <PlusCircle size={16} />
                                            </button>
                                        </div>
                                        {/* Topic list */}
                                        {topicConfig.length > 0 && (
                                            <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                                {topicConfig.map((t, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: i < topicConfig.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                                        <div>
                                                            <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{t.name}</span>
                                                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-2)' }}>({t.maxMarks} marks)</span>
                                                        </div>
                                                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeTopic(i)} style={{ color: 'var(--color-danger)' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                                                    <span>Total Marks</span>
                                                    <span style={{ color: 'var(--color-accent)' }}>{getTopicTotal()}</span>
                                                </div>
                                            </div>
                                        )}
                                        {topicConfig.length === 0 && (
                                            <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                                No topics added yet. Add topics above or leave empty for a single total mark.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {topicConfig.length === 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Total Marks (when no topics)</label>
                                        <input className="form-input" type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingExam ? 'Save' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Score Entry Modal */}
            {showScoresModal && scoringExam && (
                <div className="modal-overlay" onClick={() => setShowScoresModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Enter Scores — {scoringExam.title}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowScoresModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                Total Marks: <strong>{scoringExam.totalMarks}</strong>
                            </p>
                            {/* Topic header for reference */}
                            {(() => {
                                const topics = getExamTopics(scoringExam);
                                if (topics.length > 0) {
                                    return (
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                                            {topics.map((t, i) => (
                                                <span key={i} className="badge" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)', fontWeight: 600 }}>
                                                    {t.name}{t.maxMarks != null ? ` (${t.maxMarks})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                {studentScores.map((studentScore, idx) => {
                                    const topics = getExamTopics(scoringExam);
                                    return (
                                        <div key={studentScore.studentId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
                                            <div style={{ flex: '1 1 120px', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{studentScore.name}</div>
                                            
                                            {topics.length > 0 ? (
                                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', flex: '1 1 auto' }}>
                                                    {topics.map(t => (
                                                        <div key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                                                {t.name}{t.maxMarks != null ? ` /${t.maxMarks}` : ''}
                                                            </span>
                                                            <input
                                                                className="form-input"
                                                                type="number" min="0"
                                                                max={t.maxMarks != null ? t.maxMarks : undefined}
                                                                style={{ width: 75, padding: '4px 8px' }}
                                                                placeholder="Score"
                                                                value={studentScore.topicMarks?.[t.name] || ''}
                                                                onChange={(e) => {
                                                                    const newScores = [...studentScores];
                                                                    newScores[idx].topicMarks = { ...newScores[idx].topicMarks, [t.name]: e.target.value };
                                                                    setStudentScores(newScores);
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    className="form-input"
                                                    type="number"
                                                    min="0"
                                                    max={scoringExam.totalMarks}
                                                    style={{ width: 85 }}
                                                    placeholder="Marks"
                                                    value={studentScore.marksObtained || ''}
                                                    onChange={(e) => {
                                                        const newScores = [...studentScores];
                                                        newScores[idx].marksObtained = e.target.value;
                                                        setStudentScores(newScores);
                                                    }}
                                                />
                                            )}
                                            <input
                                                className="form-input"
                                                style={{ width: 140 }}
                                                placeholder="Remarks"
                                                value={studentScore.remarks || ''}
                                                onChange={(e) => {
                                                    const newScores = [...studentScores];
                                                    newScores[idx].remarks = e.target.value;
                                                    setStudentScores(newScores);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowScoresModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveScores}>Save Scores</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Leaderboard Modal */}
            {showLeaderboardModal && leaderboardExam && (
                <div className="modal-overlay" onClick={() => setShowLeaderboardModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--color-gold), #f59e0b)', padding: 'var(--space-6)', color: 'white', position: 'relative', textAlign: 'center' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowLeaderboardModal(false)} style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', color: 'white' }}><X size={20} /></button>
                            <Trophy size={48} style={{ margin: '0 auto var(--space-3)' }} />
                            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Leaderboard</h2>
                            <div style={{ opacity: 0.9, fontSize: 'var(--font-size-md)', marginTop: '4px', fontWeight: 600 }}>{leaderboardExam.title}</div>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0', background: 'var(--color-surface-2)' }}>
                            {(!leaderboardExam.scores || leaderboardExam.scores.length === 0) ? (
                                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No scores entered yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {[...leaderboardExam.scores]
                                        .filter(s => students.find(st => st.id === s.studentId))
                                        .sort((a, b) => b.marksObtained - a.marksObtained)
                                        .map((score, index) => {
                                            const student = students.find(st => st.id === score.studentId);
                                            const perc = leaderboardExam.totalMarks > 0 ? Math.round((score.marksObtained / leaderboardExam.totalMarks) * 100) : 0;
                                            
                                            let rankBadge = null;
                                            if (index === 0) rankBadge = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FDB931)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)' }}>1</div>;
                                            else if (index === 1) rankBadge = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E0E0E0, #BDBDBD)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(224, 224, 224, 0.4)' }}>2</div>;
                                            else if (index === 2) rankBadge = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #CD7F32, #A0522D)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(205, 127, 50, 0.4)' }}>3</div>;
                                            else rankBadge = <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>{index + 1}</div>;

                                            return (
                                                <div key={score.studentId} style={{ 
                                                    display: 'flex', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', 
                                                    borderBottom: '1px solid var(--color-border)',
                                                    background: index < 3 ? 'var(--color-bg-card)' : 'transparent',
                                                    transition: 'all 0.2s ease',
                                                }}>
                                                    <div style={{ marginRight: 'var(--space-4)' }}>{rankBadge}</div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text-primary)' }}>{student.name}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Class {student.grade}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '20px', fontWeight: 800, color: index === 0 ? '#FDB931' : index === 1 ? '#BDBDBD' : index === 2 ? '#CD7F32' : 'var(--color-accent)' }}>
                                                            {score.marksObtained} <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {leaderboardExam.totalMarks}</span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: perc >= 80 ? 'var(--color-success)' : perc >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                            {perc}%
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Attendance Modal */}
            {showAttendanceModal && scoringExam && (
                <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Exam Attendance - {scoringExam.title}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAttendanceModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveAttendance}>
                            <div className="modal-body">
                                <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                    Only present students can be graded for this exam.
                                </p>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {students.filter(s => (s.batchIds || []).includes(scoringExam.batchId)).map(student => (
                                        <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                                            <div style={{ fontWeight: 500 }}>{student.name}</div>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                <button type="button" onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'present'})} className={`btn btn-sm ${attendanceRecords[student.id] === 'present' ? 'btn-primary' : 'btn-ghost'}`}>P</button>
                                                <button type="button" onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'absent'})} className={`btn btn-sm ${attendanceRecords[student.id] === 'absent' ? 'btn-danger' : 'btn-ghost'}`}>A</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAttendanceModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Attendance</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
