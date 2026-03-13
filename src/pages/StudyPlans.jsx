import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BrainCircuit, Loader2, Sparkles, BookOpen, Target, Clock, CheckCircle2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudyPlans() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [studyPlan, setStudyPlan] = useState(null);

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [studentSnap, batchSnap, examSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredStudents = selectedBatchId
        ? students.filter(s => s.batchIds?.includes(selectedBatchId))
        : students;

    // Reset selected student and plan if batch changes
    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
            setStudyPlan(null);
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    // Generate the AI plan heuristically based on topics
    function handleGeneratePlan() {
        if (!selectedStudentId) return;
        setIsGenerating(true);
        setStudyPlan(null);

        // Simulate API call delay for "AI" effect
        setTimeout(() => {
            const plan = buildHeuristicPlan(selectedStudentId);
            setStudyPlan(plan);
            setIsGenerating(false);
            if (plan.topics.length === 0) {
                toast.error("Not enough exam data to build a personalized plan.");
            } else {
                toast.success("Study plan generated successfully!");
            }
        }, 1500);
    }

    function buildHeuristicPlan(studentId) {
        const student = students.find(s => s.id === studentId);
        if (!student) return null;

        const topicsPerformance = {};
        exams.forEach(e => {
            if (student.batchIds?.includes(e.batchId)) {
                const sScore = (e.scores || []).find(sc => sc.studentId === student.id);
                if (sScore && sScore.topicMarks) {
                    const batchTopicSums = {};
                    const batchTopicCounts = {};
                    e.scores.forEach(score => {
                        if (score.topicMarks) {
                            Object.entries(score.topicMarks).forEach(([topic, mark]) => {
                                const val = parseFloat(mark) || 0;
                                batchTopicSums[topic] = (batchTopicSums[topic] || 0) + val;
                                batchTopicCounts[topic] = (batchTopicCounts[topic] || 0) + 1;
                            });
                        }
                    });

                    Object.entries(sScore.topicMarks).forEach(([topic, mark]) => {
                        const studentVal = parseFloat(mark) || 0;
                        const batchAvg = batchTopicSums[topic] / (batchTopicCounts[topic] || 1); 
                        const diff = studentVal - batchAvg;
                        
                        if (!topicsPerformance[topic]) {
                            topicsPerformance[topic] = { count: 0, diffSum: 0, studentScores: [] };
                        }
                        topicsPerformance[topic].diffSum += diff;
                        topicsPerformance[topic].count += 1;
                        topicsPerformance[topic].studentScores.push(studentVal);
                    });
                }
            }
        });

        const analyzedTopics = Object.entries(topicsPerformance).map(([topic, data]) => {
            const avgDiff = data.diffSum / data.count;
            const absoluteAvgScore = data.studentScores.reduce((a, b) => a + b, 0) / data.count;
            return { topic, avgDiff, absoluteAvgScore };
        });

        analyzedTopics.sort((a, b) => a.avgDiff - b.avgDiff); // Lowest difference first (weakest)

        const topWeaknesses = analyzedTopics.filter(t => t.avgDiff <= 0).slice(0, 3);
        const topStrengths = analyzedTopics.filter(t => t.avgDiff > 0).slice(0, 2);

        // Generate action items
        const actionItems = [];
        
        topWeaknesses.forEach((weak, i) => {
            const minutes = 45 + (i * 15); // Allocate more time to the absolute weakest
            const days = i === 0 ? "Daily" : "Every alternate day";
            actionItems.push({
                title: `Intensive Review: ${weak.topic}`,
                description: `Your scores in ${weak.topic} are below the batch average. Focus on core concepts and resolve previous test mistakes.`,
                time: `${minutes} mins`,
                frequency: days,
                type: 'weakness'
            });
        });

        topStrengths.forEach((strong, i) => {
            actionItems.push({
                title: `Advanced Practice: ${strong.topic}`,
                description: `You are performing exceptionally well in ${strong.topic}. Attempt higher-order thinking questions to maintain momentum.`,
                time: `30 mins`,
                frequency: "Weekend Review",
                type: 'strength'
            });
        });

        // Add a generic one if data is sparse
        if (actionItems.length === 0 && analyzedTopics.length > 0) {
            actionItems.push({
                title: "General Consistency",
                description: "Maintain a steady review of all recent class notes. Try to spend 30 minutes reading ahead before the next class.",
                time: "30 mins",
                frequency: "Daily",
                type: 'general'
            });
        }

        return {
            studentName: student.name,
            grade: student.grade,
            topics: analyzedTopics.map(t => t.topic),
            weakTopics: topWeaknesses.map(t => t.topic),
            actionItems: actionItems
        };
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">AI Study Plans</h1>
                    <p className="page-subtitle">Generate personalized revision strategies based on topic performance.</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    
                    <div style={{ flex: '1 1 250px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Filter by Batch (Optional)</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => { setSelectedBatchId(e.target.value); setStudyPlan(null); }}>
                            <option value="">-- All Batches --</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div style={{ flex: '1 1 250px' }}>
                        <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Select Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => { setSelectedStudentId(e.target.value); setStudyPlan(null); }}>
                            <option value="">-- Choose a Student --</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Class {s.grade})</option>)}
                        </select>
                    </div>

                    <div>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleGeneratePlan} 
                            disabled={!selectedStudentId || isGenerating}
                            style={{ padding: '0 var(--space-6)', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                            {isGenerating ? 'Analyzing Data...' : 'Generate AI Plan'}
                        </button>
                    </div>

                </div>
            </div>

            {!studyPlan && !isGenerating && (
                <div className="empty-state card">
                    <Sparkles size={48} className="empty-state-icon" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-4)' }} />
                    <div className="empty-state-title">Ready to Generate?</div>
                    <div className="empty-state-text">Select a student and click generate. The system algorithmically analyzes past exam topics to pinpoint exact areas requiring focus.</div>
                </div>
            )}

            {isGenerating && (
                <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Constructing Study Plan...</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>Analyzing batch averages and topic-wise historical performance.</p>
                </div>
            )}

            {studyPlan && studyPlan.topics.length === 0 && (
                <div className="card empty-state" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                    <div className="empty-state-title" style={{ color: 'var(--color-warning)' }}>Insufficient Exam Data</div>
                    <div className="empty-state-text">We need more exam records with detailed topic-wise marks for this student to generate an accurate plan. Check back later!</div>
                </div>
            )}

            {studyPlan && studyPlan.topics.length > 0 && (
                <div className="card animate-fade-in-up">
                    <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', background: 'linear-gradient(to right, var(--color-primary-soft), transparent)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                            <div>
                                <div className="card-title" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Sparkles size={20} /> Personalized Study Directive
                                </div>
                                <div className="card-subtitle" style={{ fontSize: '15px' }}>Custom plan for <strong style={{color: 'var(--color-text-primary)'}}>{studyPlan.studentName}</strong> (Class {studyPlan.grade})</div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                                Print Plan
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-6)' }}>
                        {/* Summary of findings */}
                        <div style={{ marginBottom: 'var(--space-6)', background: 'var(--color-surface-1)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                            <p style={{ margin: 0, lineHeight: 1.6, fontSize: '15px' }}>
                                Based on a heuristic analysis of past exam data, we've identified that immediate focus is required on <strong>{studyPlan.weakTopics.join(', ')}</strong>. 
                                By dedicating structured review time to these areas, the student can significantly elevate their overall average.
                            </p>
                        </div>

                        {/* Action Items List */}
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
                            Action Plan
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {studyPlan.actionItems.map((item, index) => (
                                <div key={index} style={{ 
                                    display: 'flex', 
                                    gap: 'var(--space-4)', 
                                    padding: 'var(--space-4)',
                                    background: 'var(--color-bg-card)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-lg)',
                                    borderLeft: `4px solid ${item.type === 'weakness' ? 'var(--color-warning)' : item.type === 'strength' ? 'var(--color-success)' : 'var(--color-primary)'}`
                                }}>
                                    <div style={{ 
                                        width: 48, height: 48, borderRadius: 'var(--radius-md)', 
                                        background: 'var(--color-bg-elevated)', display: 'flex', 
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                    }}>
                                        {item.type === 'weakness' ? <Target size={24} style={{ color: 'var(--color-warning)' }} /> : 
                                         item.type === 'strength' ? <CheckCircle2 size={24} style={{ color: 'var(--color-success)' }} /> : 
                                         <BookOpen size={24} style={{ color: 'var(--color-primary)' }} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{item.title}</h4>
                                        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>
                                            {item.description}
                                        </p>
                                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'var(--color-surface-2)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                                                <Clock size={14} style={{ color: 'var(--color-text-muted)' }} /> Required Time: {item.time}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'var(--color-surface-2)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                                                <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} /> Frequency: {item.frequency}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


