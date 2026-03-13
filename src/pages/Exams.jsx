import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { FileText, Plus, Edit2, Trash2, X, Eye, Trophy, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Exams() {
    const { currentUser } = useAuth();
    const [exams, setExams] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [editingExam, setEditingExam] = useState(null);
    const [selectedExam, setSelectedExam] = useState(null);
    const [scores, setScores] = useState({});
    const [filterBatch, setFilterBatch] = useState('');
    const [form, setForm] = useState({
        title: '', batchId: '', date: '', totalMarks: 100, topics: '',
    });

    const pastTopics = Array.from(new Set(exams.flatMap(e => e.topics || []))).filter(Boolean).sort();

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

    function openCreate() {
        setEditingExam(null);
        setForm({ title: '', batchId: '', date: format(new Date(), 'yyyy-MM-dd'), totalMarks: 100, topics: '' });
        setShowModal(true);
    }

    function openEdit(exam) {
        setEditingExam(exam);
        const dateVal = exam.date?.toDate ? format(exam.date.toDate(), 'yyyy-MM-dd') : exam.date || '';
        setForm({
            title: exam.title, batchId: exam.batchId, date: dateVal,
            totalMarks: exam.totalMarks || 100, topics: (exam.topics || []).join(', '),
        });
        setShowModal(true);
    }

    function openScores(exam) {
        setSelectedExam(exam);
        const sc = {};
        (exam.scores || []).forEach((s) => { sc[s.studentId] = { marks: s.marksObtained, remarks: s.remarks || '', topicMarks: s.topicMarks || {} }; });
        const batchStudents = students.filter((s) => (s.batchIds || []).includes(exam.batchId));
        batchStudents.forEach((s) => {
            if (!sc[s.id]) sc[s.id] = { marks: '', remarks: '', topicMarks: {} };
        });
        setScores(sc);
        setShowScoreModal(true);
    }

    async function handleSave(e) {
        e.preventDefault();
        try {
            const data = {
                title: form.title, batchId: form.batchId,
                batchName: batches.find((b) => b.id === form.batchId)?.name || '',
                date: Timestamp.fromDate(new Date(form.date)),
                totalMarks: parseInt(form.totalMarks) || 100,
                topics: form.topics.split(',').map((t) => t.trim()).filter(Boolean),
                teacherId: currentUser.uid,
            };
            if (editingExam) {
                await updateDoc(doc(db, 'exams', editingExam.id), data);
            } else {
                data.createdAt = serverTimestamp();
                data.scores = [];
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
        if (!selectedExam) return;
        try {
            const hasTopics = selectedExam.topics && selectedExam.topics.length > 0;
            const scoresArray = Object.entries(scores)
                .filter(([_, v]) => {
                    if (hasTopics) {
                        return selectedExam.topics.some(t => v.topicMarks && v.topicMarks[t] !== undefined && v.topicMarks[t] !== '');
                    }
                    return v.marks !== '';
                })
                .map(([studentId, v]) => {
                    let sum = 0;
                    if (hasTopics) {
                        for (let t of selectedExam.topics) {
                            sum += parseFloat(v.topicMarks[t]) || 0;
                        }
                    } else {
                        sum = parseFloat(v.marks) || 0;
                    }
                    return {
                        studentId,
                        marksObtained: sum,
                        topicMarks: v.topicMarks || {},
                        remarks: v.remarks || '',
                    };
                });
            await updateDoc(doc(db, 'exams', selectedExam.id), { scores: scoresArray });
            setShowScoreModal(false);
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

    function getBatchName(batchId) {
        return batches.find((b) => b.id === batchId)?.name || '';
    }

    function getStudentName(studentId) {
        return students.find((s) => s.id === studentId)?.name || 'Unknown';
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
                        return (
                            <div key={exam.id} className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">{exam.title}</div>
                                        <div className="card-subtitle">{getBatchName(exam.batchId)} · {format(dateVal, 'MMM d, yyyy')}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openScores(exam)} title="Enter scores">
                                            <Trophy size={16} style={{ color: 'var(--color-gold)' }} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(exam)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(exam.id)}>
                                            <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
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

                                {(exam.topics || []).length > 0 && (
                                    <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                                        {exam.topics.map((t, i) => (
                                            <span key={i} className="badge badge-teal">{t}</span>
                                        ))}
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
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                                        <label className="form-label">Date *</label>
                                        <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Total Marks</label>
                                    <input className="form-input" type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Topics (comma-separated)</label>
                                    <input className="form-input" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} placeholder="e.g., Grammar, Comprehension, Writing" />
                                    {pastTopics.length > 0 && (
                                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Suggestions:</span>
                                            {pastTopics.map(pt => (
                                                <button key={pt} type="button" 
                                                    onClick={() => {
                                                        const cur = form.topics.split(',').map(t=>t.trim()).filter(Boolean);
                                                        if(!cur.includes(pt)) {
                                                            setForm(f => ({ ...f, topics: f.topics ? f.topics + ', ' + pt : pt }));
                                                        }
                                                    }}
                                                    className="badge badge-teal" style={{ cursor: 'pointer', border: 'none', background: 'var(--color-bg-elevated)', color: 'var(--color-accent)' }}>
                                                    + {pt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
            {showScoreModal && selectedExam && (
                <div className="modal-overlay" onClick={() => setShowScoreModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Enter Scores — {selectedExam.title}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowScoreModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                Total Marks: <strong>{selectedExam.totalMarks}</strong>
                            </p>
                            {students
                                .filter((s) => (s.batchIds || []).includes(selectedExam.batchId))
                                .map((student) => (
                                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 120px', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{student.name}</div>
                                        
                                        {(selectedExam.topics?.length > 0) ? (
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', flex: '1 1 auto' }}>
                                                {selectedExam.topics.map(t => (
                                                    <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{t}</span>
                                                        <input
                                                            className="form-input"
                                                            type="number" min="0"
                                                            style={{ width: 70, padding: '4px 8px' }}
                                                            placeholder="Score"
                                                            value={scores[student.id]?.topicMarks?.[t] || ''}
                                                            onChange={(e) => setScores(prev => ({
                                                                ...prev, [student.id]: {
                                                                    ...prev[student.id], 
                                                                    topicMarks: { ...prev[student.id].topicMarks, [t]: e.target.value }
                                                                }
                                                            }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <input
                                                className="form-input"
                                                type="number"
                                                min="0"
                                                max={selectedExam.totalMarks}
                                                style={{ width: 80 }}
                                                placeholder="Marks"
                                                value={scores[student.id]?.marks || ''}
                                                onChange={(e) => setScores({ ...scores, [student.id]: { ...scores[student.id], marks: e.target.value } })}
                                            />
                                        )}
                                        <input
                                            className="form-input"
                                            style={{ width: 140 }}
                                            placeholder="Remarks"
                                            value={scores[student.id]?.remarks || ''}
                                            onChange={(e) => setScores({ ...scores, [student.id]: { ...scores[student.id], remarks: e.target.value } })}
                                        />
                                    </div>
                                ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowScoreModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveScores}>Save Scores</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
