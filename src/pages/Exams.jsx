import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { FileText, Plus, Edit2, Trash2, X, Eye, Trophy, TrendingUp, Users, ClipboardCheck, PlusCircle, Filter, Calendar, Clock, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { examService } from '../services/examService';
import { attendanceService } from '../services/attendanceService';
import Modal from '../components/Modal';

export default function Exams() {
    const { userProfile } = useAuth();
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
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [examsList, activeBatches, allStudents] = await Promise.all([
                examService.getExams(uid),
                batchService.getBatches(uid, true),
                studentService.getStudentsByTeacher(uid)
            ]);
            setExams(examsList);
            setBatches(activeBatches);
            setStudents(allStudents.filter(s => s.status === 'enrolled'));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    // Helper: get topics from exam (supports both old and new format)
    function getExamTopics(exam) {
        if (exam.topic_config && exam.topic_config.length > 0) {
            return exam.topic_config; // structured format: [{name, maxMarks}]
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
        setForm({
            title: exam.title, batchId: exam.batch_id, date: exam.date,
            startTime: exam.start_time || '09:00', endTime: exam.end_time || '10:00',
            totalMarks: exam.total_marks || 100,
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
        const studentsInBatch = students.filter(s => (s.batchIds || []).includes(exam.batch_id));
        studentsInBatch.forEach(s => {
            records[s.id] = (exam.attendance || {})[s.id] || 'present';
        });
        setAttendanceRecords(records);
        setShowAttendanceModal(true);
    }

    async function handleSaveAttendance(e) {
        e.preventDefault();
        try {
            // 1. Update Attendance in Exam (for filtering present students)
            await supabase
                .from('exams')
                .update({ attendance: attendanceRecords })
                .eq('id', scoringExam.id);

            // 2. Sync with main attendance system
            await attendanceService.saveAttendance(
                userProfile.id,
                scoringExam.batch_id,
                scoringExam.date,
                attendanceRecords
            );

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
            const inBatch = (s.batchIds || []).includes(exam.batch_id);
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
            const hasTopics = topicConfig.length > 0;
            const computedTotal = hasTopics ? getTopicTotal() : parseFloat(form.totalMarks) || 100;

            const data = {
                title: form.title,
                date: form.date,
                start_time: form.startTime || '00:00',
                end_time: form.endTime || '00:00',
                batch_id: form.batchId,
                total_marks: computedTotal,
                topic_config: topicConfig,
                teacher_id: userProfile.id,
            };

            if (editingExam) {
                data.id = editingExam.id;
            }
            
            await examService.saveExam(data);
            
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
            
            await examService.saveResults(scoringExam.id, scoresArray);
            
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
            await examService.deleteExam(examId);
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
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <h1 className="page-title">Exams & Tests</h1>
                    <p className="page-subtitle">Track tests and student progress in your batches</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate} style={{ boxShadow: 'var(--shadow-primary)' }}>
                    <Plus size={18} /> Add Exam
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

            {filteredExams.length === 0 ? (
                <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                        <FileText size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No Exams Found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Create an exam for your active batches to start evaluating student progress.</p>
                </div>
            ) : (
                <div className="grid-2">
                    {filteredExams.map((exam) => {
                        const stats = getExamStats(exam);
                        const dateVal = exam.date?.toDate ? exam.date.toDate() : new Date(exam.date);
                        const topicAnalytics = getTopicAnalytics(exam);
                        return (
                            <div key={exam.id} className="glass-card" style={{ padding: 'var(--space-6)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <div style={{ padding: '4px 10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{getBatchName(exam.batchId)}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} /> {format(dateVal, 'MMM d, yyyy')}
                                            </div>
                                        </div>
                                        <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{exam.title}</h3>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => { setLeaderboardExam(exam); setShowLeaderboardModal(true); }} title="Leaderboard">
                                            <Trophy size={16} style={{ color: 'var(--color-gold)' }} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openAttendance(exam)} title="Attendance">
                                            <Users size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openScores(exam)} title="Enter Scores">
                                            <ClipboardCheck size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(exam)} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(exam.id)} title="Delete" style={{ color: 'var(--color-danger)' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Average</div>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-accent)' }}>{stats.avg}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Highest</div>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-success)' }}>{stats.highest}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Lowest</div>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-danger)' }}>{stats.lowest}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Scored</div>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>{stats.count}</div>
                                        </div>
                                    </div>
                                </div>

                                {topicAnalytics.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-6)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-3)', letterSpacing: '0.05em' }}>Topic Breakdown</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                            {topicAnalytics.map((t, i) => {
                                                const perc = t.maxMarks > 0 ? Math.round((t.avg / t.maxMarks) * 100) : 0;
                                                return (
                                                    <div key={i}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                                                            <span style={{ fontWeight: 600 }}>{t.name}</span>
                                                            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                                                {t.maxMarks != null ? `${t.avg}/${t.maxMarks} (${perc}%)` : t.avg}
                                                            </span>
                                                        </div>
                                                        <div className="progress-bar" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
                                                            <div className="progress-bar-fill" style={{
                                                                width: `${perc}%`,
                                                                background: perc >= 70 ? 'var(--color-success)' : perc >= 40 ? 'var(--color-warning)' : 'var(--color-danger)',
                                                                boxShadow: `0 0 8px ${perc >= 70 ? 'rgba(34, 197, 94, 0.2)' : perc >= 40 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                                            }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Class Performance</span>
                                        <span style={{ color: 'var(--color-text)' }}>{stats.avg} / {exam.totalMarks}</span>
                                    </div>
                                    <div className="progress-bar" style={{ height: 10, background: 'rgba(255,255,255,0.05)' }}>
                                        <div className="progress-bar-fill" style={{ 
                                            width: `${exam.totalMarks > 0 ? (stats.avg / exam.totalMarks) * 100 : 0}%`,
                                            background: 'var(--color-accent)',
                                            boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)'
                                        }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Redesigned Modals using the Modal component */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingExam ? 'Edit Exam' : 'Add New Exam'}
                maxWidth="640px"
            >
                <form onSubmit={handleSave} style={{ padding: '4px' }}>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label className="form-label">Exam Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Mid-term Exam" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Active Batch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <select className="form-select" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} required>
                                <option value="">Select Batch</option>
                                {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Exam Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div className="form-group">
                            <label className="form-label">Start Time</label>
                            <div style={{ position: 'relative' }}>
                                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input className="form-input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required style={{ paddingLeft: '36px' }} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">End Time</label>
                            <div style={{ position: 'relative' }}>
                                <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                <input className="form-input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required style={{ paddingLeft: '36px' }} />
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                        <label className="form-label">Topics & Marks</label>
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', background: 'rgba(255,255,255,0.03)' }}>
                                <input className="form-input" placeholder="Topic (e.g., Algebra)" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} style={{ flex: 2 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} />
                                <input className="form-input" type="number" placeholder="Marks" min="1" value={newTopicMarks} onChange={(e) => setNewTopicMarks(e.target.value)} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} />
                                <button type="button" className="btn btn-primary btn-icon" onClick={addTopic} style={{ flexShrink: 0 }}><PlusCircle size={20} /></button>
                            </div>
                            
                            {topicConfig.length > 0 ? (
                                <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                    {topicConfig.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < topicConfig.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>{i + 1}</div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</div>
                                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 500 }}>Marks: {t.maxMarks}</div>
                                                </div>
                                            </div>
                                            <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeTopic(i)} style={{ color: 'var(--color-danger)' }}><X size={16} /></button>
                                        </div>
                                    ))}
                                    <div style={{ padding: '16px 0', borderTop: '2px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-secondary)' }}>Total Exam Marks</span>
                                        <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--color-accent)' }}>{getTopicTotal()}</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                                    <div className="form-group" style={{ maxWidth: '200px', margin: '0 auto' }}>
                                        <label className="form-label">Simple Total Marks</label>
                                        <input className="form-input" type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} style={{ textAlign: 'center', fontSize: '18px', fontWeight: 700 }} />
                                    </div>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '12px' }}>Or add topics above for detailed evaluation</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>{editingExam ? 'Save Changes' : 'Add Exam'}</button>
                    </div>
                </form>
            </Modal>

            {/* Score Entry Modal */}
            <Modal
                isOpen={showScoresModal && !!scoringExam}
                onClose={() => setShowScoresModal(false)}
                title={scoringExam ? `Enter Scores — ${scoringExam.title}` : ''}
                maxWidth="750px"
            >
                {scoringExam && (
                    <div style={{ padding: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Marks Summary</div>
                                <div style={{ fontSize: '18px', fontWeight: 800 }}>{scoringExam.totalMarks} <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Total Marks</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {getExamTopics(scoringExam).map((t, i) => (
                                    <div key={i} style={{ padding: '4px 12px', background: 'var(--color-accent-soft)', color: 'var(--color-accent)', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                                        {t.name} {t.maxMarks != null && `(${t.maxMarks})`}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                            {studentScores.map((studentScore, idx) => {
                                const topics = getExamTopics(scoringExam);
                                return (
                                    <div key={studentScore.studentId} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-accent)' }}>
                                                {studentScore.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{studentScore.name}</div>
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: topics.length > 0 ? `repeat(${Math.min(topics.length, 3)}, 1fr)` : '1fr', gap: '16px' }}>
                                            {topics.length > 0 ? (
                                                topics.map(t => (
                                                    <div key={t.name} className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '11px' }}>{t.name} {t.maxMarks != null && `(max ${t.maxMarks})`}</label>
                                                        <input
                                                            className="form-input"
                                                            type="number" min="0"
                                                            max={t.maxMarks != null ? t.maxMarks : undefined}
                                                            placeholder="0"
                                                            value={studentScore.topicMarks?.[t.name] || ''}
                                                            onChange={(e) => {
                                                                const newScores = [...studentScores];
                                                                newScores[idx].topicMarks = { ...newScores[idx].topicMarks, [t.name]: e.target.value };
                                                                setStudentScores(newScores);
                                                            }}
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label">Marks Obtained</label>
                                                    <input
                                                        className="form-input"
                                                        type="number"
                                                        min="0"
                                                        max={scoringExam.totalMarks}
                                                        placeholder={`0 / ${scoringExam.totalMarks}`}
                                                        value={studentScore.marksObtained || ''}
                                                        onChange={(e) => {
                                                            const newScores = [...studentScores];
                                                            newScores[idx].marksObtained = e.target.value;
                                                            setStudentScores(newScores);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '11px' }}>Performance Remarks</label>
                                            <input
                                                className="form-input"
                                                placeholder="Excellent performance, needs improvement in..."
                                                value={studentScore.remarks || ''}
                                                onChange={(e) => {
                                                    const newScores = [...studentScores];
                                                    newScores[idx].remarks = e.target.value;
                                                    setStudentScores(newScores);
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-6)' }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowScoresModal(false)}>Cancel</button>
                            <button className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }} onClick={handleSaveScores}>Save Scores</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Leaderboard Modal */}
            <Modal
                isOpen={showLeaderboardModal && !!leaderboardExam}
                onClose={() => setShowLeaderboardModal(false)}
                title=""
                maxWidth="600px"
                padding="0"
            >
                {leaderboardExam && (
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--color-gold), #f59e0b)', padding: 'var(--space-8)', color: 'white', textAlign: 'center' }}>
                            <Trophy size={48} style={{ margin: '0 auto var(--space-4)', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))' }} />
                            <h2 style={{ fontSize: '28px', fontWeight: 800, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Top Scorers</h2>
                            <div style={{ opacity: 0.9, fontSize: '14px', marginTop: '4px', fontWeight: 600 }}>{leaderboardExam.title} Results</div>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', background: 'rgba(255,255,255,0.02)' }}>
                            {(!leaderboardExam.scores || leaderboardExam.scores.length === 0) ? (
                                <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    <BarChart2 size={32} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
                                    <p>No scores entered yet.</p>
                                </div>
                            ) : (
                                <div>
                                    {[...leaderboardExam.scores]
                                        .filter(s => students.find(st => st.id === s.studentId))
                                        .sort((a, b) => b.marksObtained - a.marksObtained)
                                        .map((score, index) => {
                                            const student = students.find(st => st.id === score.studentId);
                                            const perc = leaderboardExam.totalMarks > 0 ? Math.round((score.marksObtained / leaderboardExam.totalMarks) * 100) : 0;
                                            
                                            let rankIcon = null;
                                            if (index === 0) rankIcon = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FDB931)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}>1</div>;
                                            else if (index === 1) rankIcon = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E0E0E0, #BDBDBD)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(224, 224, 224, 0.3)' }}>2</div>;
                                            else if (index === 2) rankIcon = <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #CD7F32, #A0522D)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(205, 127, 50, 0.3)' }}>3</div>;
                                            else rankIcon = <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--color-text-muted)' }}>{index + 1}</div>;

                                            return (
                                                <div key={score.studentId} style={{ 
                                                    display: 'flex', alignItems: 'center', padding: '16px 24px', 
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    background: index < 1 ? 'rgba(254, 185, 49, 0.05)' : 'transparent',
                                                    transition: 'all 0.2s ease',
                                                }}>
                                                    <div style={{ marginRight: '16px' }}>{rankIcon}</div>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--color-accent)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            {student.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '16px' }}>{student.name}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>GRADE {student.grade}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '20px', fontWeight: 800, color: index === 0 ? '#FDB931' : 'var(--color-text)' }}>
                                                            {score.marksObtained} <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {leaderboardExam.totalMarks}</span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: perc >= 80 ? 'var(--color-success)' : perc >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                                            {perc}%
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: 'var(--space-4)', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowLeaderboardModal(false)}>Close View</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Attendance Modal */}
            <Modal
                isOpen={showAttendanceModal && !!scoringExam}
                onClose={() => setShowAttendanceModal(false)}
                title={scoringExam ? `Exam Attendance — ${scoringExam.title}` : ''}
                maxWidth="500px"
            >
                {scoringExam && (
                    <form onSubmit={handleSaveAttendance} style={{ padding: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-warning-light)', padding: '12px', borderRadius: '12px', marginBottom: 'var(--space-6)', color: 'var(--color-warning)', fontSize: '13px', fontWeight: 500 }}>
                            <Info size={18} />
                            Only present students can be given marks for this exam.
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                            {students.filter(s => (s.batchIds || []).includes(scoringExam.batchId)).map(student => (
                                <div key={student.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{student.name}</div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'present'})} 
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                borderRadius: '8px',
                                                background: attendanceRecords[student.id] === 'present' ? 'var(--color-success-light)' : 'rgba(255,255,255,0.03)',
                                                color: attendanceRecords[student.id] === 'present' ? 'var(--color-success)' : 'var(--color-text-muted)',
                                                border: `1px solid ${attendanceRecords[student.id] === 'present' ? 'var(--color-success)' : 'rgba(255,255,255,0.05)'}`,
                                            }}
                                        >
                                            PRESENT
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setAttendanceRecords({...attendanceRecords, [student.id]: 'absent'})} 
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                borderRadius: '8px',
                                                background: attendanceRecords[student.id] === 'absent' ? 'var(--color-danger-light)' : 'rgba(255,255,255,0.03)',
                                                color: attendanceRecords[student.id] === 'absent' ? 'var(--color-danger)' : 'var(--color-text-muted)',
                                                border: `1px solid ${attendanceRecords[student.id] === 'absent' ? 'var(--color-danger)' : 'rgba(255,255,255,0.05)'}`,
                                            }}
                                        >
                                            ABSENT
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-6)' }}>
                            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAttendanceModal(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" style={{ flex: 2, boxShadow: 'var(--shadow-primary)' }}>Save Attendance</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
