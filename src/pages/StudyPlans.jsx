import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
    BrainCircuit, Loader2, Sparkles, BookOpen, 
    Target, Clock, CheckCircle2, Calendar,
    Zap, Cpu, Lightbulb, ArrowRight, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';

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
            const [studentSnap, activeBatches, examSnap] = await Promise.all([
                getDocs(query(
                    collection(db, 'students'), 
                    where('teacherId', '==', uid),
                    where('status', '==', 'enrolled')
                )),
                batchService.getBatches(uid, true),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setBatches(activeBatches);
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading academic landscape:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredStudents = useMemo(() => {
        let list = students.filter(s => s.status === 'enrolled');
        if (selectedBatchId) {
            list = list.filter(s => s.batchIds?.includes(selectedBatchId));
        }
        return list;
    }, [students, selectedBatchId]);

    useEffect(() => {
        if (selectedStudentId && !filteredStudents.find(s => s.id === selectedStudentId)) {
            setSelectedStudentId('');
            setStudyPlan(null);
        }
    }, [selectedBatchId, filteredStudents, selectedStudentId]);

    function handleGeneratePlan() {
        if (!selectedStudentId) return;
        setIsGenerating(true);
        setStudyPlan(null);

        // Simulation of high-compute AI synthesis
        setTimeout(() => {
            const plan = buildHeuristicPlan(selectedStudentId);
            setStudyPlan(plan);
            setIsGenerating(false);
            if (plan.topics.length === 0) {
                toast.error("Not enough data for this student yet.");
            } else {
                toast.success("Study Plan Created!");
            }
        }, 2000);
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

        analyzedTopics.sort((a, b) => a.avgDiff - b.avgDiff);

        const topWeaknesses = analyzedTopics.filter(t => t.avgDiff <= 0).slice(0, 3);
        const topStrengths = analyzedTopics.filter(t => t.avgDiff > 0).slice(0, 2);

        const actionItems = [];
        
        topWeaknesses.forEach((weak, i) => {
            const minutes = 45 + (i * 15);
            const days = i === 0 ? "Daily Routine" : "Alternate Days";
            actionItems.push({
                title: `Focus on: ${weak.topic}`,
                description: `Lower marks found in ${weak.topic}. Try covering the basics and reviewing your mistakes from old tests.`,
                time: `${minutes}m`,
                frequency: days,
                type: 'weakness'
            });
        });

        topStrengths.forEach((strong, i) => {
            actionItems.push({
                title: `Keep it up: ${strong.topic}`,
                description: `Doing great in ${strong.topic}! Try more difficult questions to get even better.`,
                time: `30m`,
                frequency: "Weekend Review",
                type: 'strength'
            });
        });

        if (actionItems.length === 0 && analyzedTopics.length > 0) {
            actionItems.push({
                title: "Cognitive Consistency",
                description: "Maintain linear progression through active course materials. Review previous session logs daily for at least 30 minutes.",
                time: "30m",
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
                    <h1 className="page-title">Study Plan</h1>
                    <p className="page-subtitle">Smart study plans based on student marks and progress</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Cpu size={20} />
                    </div>
                </div>
            </div>

            {/* AI Generator Interface */}
            <div className="glass-panel" style={{ padding: '32px', marginBottom: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'var(--color-primary)', filter: 'blur(100px)', opacity: 0.05, pointerEvents: 'none' }} />
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', position: 'relative', zIndex: 1 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Batch</label>
                        <select className="form-select" value={selectedBatchId} onChange={(e) => { setSelectedBatchId(e.target.value); setStudyPlan(null); }} style={{ height: '48px', fontWeight: 700 }}>
                            <option value="">Select a Batch</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Student</label>
                        <select className="form-select" value={selectedStudentId} onChange={(e) => { setSelectedStudentId(e.target.value); setStudyPlan(null); }} style={{ height: '48px', fontWeight: 700 }}>
                            <option value="">Select a Student...</option>
                            {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleGeneratePlan} 
                            disabled={!selectedStudentId || isGenerating}
                            style={{ height: '48px', width: '100%', borderRadius: '14px', fontWeight: 900, boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)', gap: '12px', fontSize: '15px' }}
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={20} />}
                            {isGenerating ? 'Creating...' : 'Create Study Plan'}
                        </button>
                    </div>
                </div>
            </div>

            {!studyPlan && !isGenerating && (
                <div className="glass-panel" style={{ padding: '60px var(--space-8)', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-8)' }}>
                        <Sparkles size={48} style={{ color: '#fbbf24', opacity: 0.5 }} />
                    </div>
                    <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px' }}>Select a Student</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', margin: '0 auto' }}>Choose a student to analyze their test scores and create a personalized study plan.</p>
                </div>
            )}

            {isGenerating && (
                <div className="glass-panel" style={{ padding: '80px var(--space-8)', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 32px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 className="animate-pulse" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-primary)' }}>Checking marks and progress...</h3>
                        <p style={{ color: 'var(--color-text-muted)', maxWidth: '500px', margin: '0 auto' }}>Analyzing how the student is doing compared to others to find the best topics to study.</p>
                    </div>
                </div>
            )}

            {studyPlan && studyPlan.topics.length === 0 && (
                <div className="glass-panel" style={{ borderLeft: '4px solid var(--color-warning)', textAlign: 'center', padding: '60px' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Target size={40} />
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--color-warning)' }}>Not Enough Data Found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>We need more detailed exam marks for this student to create a good study plan.</p>
                </div>
            )}

            {studyPlan && studyPlan.topics.length > 0 && (
                <div className="animate-fade-in-up">
                    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '32px 40px', background: 'rgba(59, 130, 246, 0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <div style={{ padding: '8px', background: 'var(--color-primary)', borderRadius: '10px', color: 'white' }}><Zap size={18} /></div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em' }}>Personalized Study Plan</h2>
                                </div>
                                <div style={{ fontSize: '15px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Specially made for <strong style={{color: 'var(--color-text-primary)'}}>{studyPlan.studentName}</strong> • Grade {studyPlan.grade}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-secondary" onClick={() => window.print()} style={{ height: '44px', borderRadius: '12px', padding: '0 24px', fontWeight: 800 }}>
                                    Print Plan
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '40px' }}>
                            {/* Executive Summary */}
                            <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                                <div style={{ padding: '12px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', borderRadius: '14px' }}><Lightbulb size={24} /></div>
                                <div>
                                    <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.1em' }}>Key Finding</h4>
                                    <p style={{ margin: 0, lineHeight: 1.7, fontSize: '16px', fontWeight: 500 }}>
                                        The student mostly needs help with <strong style={{ color: 'var(--color-text-primary)' }}>{studyPlan.weakTopics.join(', ')}</strong>. 
                                        Based on our analysis, focusing on these topics will help the student improve the most.
                                    </p>
                                </div>
                            </div>

                            {/* Strategic Action Items */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
                                <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.05))' }} />
                                <h3 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.6 }}>What to Study</h3>
                                <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.05))' }} />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                {studyPlan.actionItems.map((item, index) => (
                                    <div key={index} className="glass-card hover-lift" style={{ 
                                        padding: '28px',
                                        display: 'flex',
                                        gap: '24px',
                                        borderLeft: `5px solid ${item.type === 'weakness' ? 'var(--color-warning)' : item.type === 'strength' ? 'var(--color-teal)' : 'var(--color-primary)'}`,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                        <div style={{ 
                                            width: '56px', height: '56px', borderRadius: '18px', 
                                            background: 'rgba(255,255,255,0.03)', display: 'flex', 
                                            alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                        }}>
                                            {item.type === 'weakness' ? <Target size={28} style={{ color: 'var(--color-warning)' }} /> : 
                                             item.type === 'strength' ? <ArrowRight size={28} style={{ color: 'var(--color-teal)' }} /> : 
                                             <BookOpen size={28} style={{ color: 'var(--color-primary)' }} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <h4 style={{ fontSize: '18px', fontWeight: 900 }}>{item.title}</h4>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '10px', textTransform: 'uppercase' }}>{item.type}</span>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '20px', fontWeight: 500 }}>
                                                {item.description}
                                            </p>
                                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}><Clock size={16} /></div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Duration</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 800 }}>{item.time} / Session</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}><Calendar size={16} /></div>
                                                    <div>
                                                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Frequency</div>
                                                        <div style={{ fontSize: '13px', fontWeight: 800 }}>{item.frequency}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '32px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>
                        <Info size={16} />
                        Analyzed topics and frequency depend on historical point distribution from the database.
                    </div>
                </div>
            )}
        </div>
    );
}


