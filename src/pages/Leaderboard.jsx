import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
    Award, Trophy, Star, Medal, ArrowUp, ArrowDown, 
    Minus, Filter, Info, TrendingUp, Zap, Sparkles 
} from 'lucide-react';
import { batchService } from '../services/batchService';

export default function Leaderboard() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState('');

    useEffect(() => {
        if (currentUser) loadData();
    }, [currentUser]);

    async function loadData() {
        try {
            const uid = currentUser.uid;
            const [activeBatches, studentSnap, attSnap, examSnap, hwSnap] = await Promise.all([
                batchService.getBatches(uid, true),
                getDocs(query(
                    collection(db, 'students'), 
                    where('teacherId', '==', uid),
                    where('status', '==', 'enrolled')
                )),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            
            const enrolledStudents = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setStudents(enrolledStudents);
            setBatches(activeBatches);
            
            if (activeBatches.length > 0 && !selectedBatchId) {
                setSelectedBatchId(activeBatches[0].id);
            }

            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading leaderboard foundation:', err);
        } finally {
            setLoading(false);
        }
    }

    const leaderboardData = useMemo(() => {
        if (!selectedBatchId) return [];

        const batchStudents = students.filter(s => s.batchIds?.includes(selectedBatchId));
        
        const scores = batchStudents.map(student => {
            let totalPoints = 0;
            let attPoints = 0;
            let hwPoints = 0;
            let examPoints = 0;

            // Attendance Points (10 pts per present)
            attendance.forEach(a => {
                if (a.batchId === selectedBatchId) {
                    const record = (a.records || []).find(r => r.studentId === student.id);
                    if (record && record.status === 'present') attPoints += 10;
                }
            });

            // Homework Points (20 pts per completed HW)
            homeworks.forEach(hw => {
                if (hw.batchId === selectedBatchId) {
                    if ((hw.completedBy || []).includes(student.id)) hwPoints += 20;
                }
            });

            // Exam Points (Marks / 2)
            exams.forEach(e => {
                if (e.batchId === selectedBatchId) {
                    const score = (e.scores || []).find(s => s.studentId === student.id);
                    if (score && typeof score.marksObtained === 'number') {
                        examPoints += Math.round(score.marksObtained / 2);
                    }
                }
            });

            totalPoints = attPoints + hwPoints + examPoints;

            return {
                ...student,
                points: totalPoints,
                breakdown: {
                    attendance: attPoints,
                    homework: hwPoints,
                    exams: examPoints
                }
            };
        });

        return scores.sort((a, b) => b.points - a.points);
    }, [students, selectedBatchId, attendance, homeworks, exams]);

    const getRankUI = (index) => {
        switch (index) {
            case 0: return { icon: <Trophy size={24} />, color: '#fbbf24', label: '1st', bg: 'rgba(251, 191, 36, 0.1)' };
            case 1: return { icon: <Medal size={24} />, color: '#94a3b8', label: '2nd', bg: 'rgba(148, 163, 184, 0.1)' };
            case 2: return { icon: <Medal size={24} />, color: '#b45309', label: '3rd', bg: 'rgba(180, 83, 9, 0.1)' };
            default: return { icon: null, color: 'var(--color-text-muted)', label: `${index + 1}th`, bg: 'transparent' };
        }
    };

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Top Students</h1>
                    <p className="page-subtitle">Celebrating our hardest working students</p>
                </div>
                <div className="glass-card" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid var(--color-primary)' }}>
                    <div style={{ color: 'var(--color-primary)' }}><Filter size={20} /></div>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch</div>
                        <select 
                            className="form-select" 
                            value={selectedBatchId} 
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            style={{ minWidth: '180px', height: '32px', border: 'none', background: 'transparent', padding: 0, fontWeight: 700, fontSize: '15px' }}
                        >
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {!selectedBatchId || leaderboardData.length === 0 ? (
                <div className="glass-panel" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-8)' }}>
                        <Trophy size={48} style={{ color: 'var(--color-border)', opacity: 0.5 }} />
                    </div>
                    <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px' }}>Select a Batch</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>Choose a batch to see who's leading the class.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
                    
                    {/* Elite Podium Display */}
                    <div className="podium-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 'var(--space-4)', padding: 'var(--space-6) 0', marginTop: 'var(--space-8)' }}>
                        {/* 2nd Place */}
                        {leaderboardData[1] && (
                            <div className="podium-item" style={{ width: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ width: '90px', height: '90px', borderRadius: '28px', background: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: 'white', border: '4px solid rgba(148, 163, 184, 0.3)', boxShadow: '0 10px 25px -5px rgba(148, 163, 184, 0.4)' }}>
                                        {leaderboardData[1].name.charAt(0)}
                                    </div>
                                    <div style={{ position: 'absolute', top: -15, right: -15, width: '40px', height: '40px', borderRadius: '50%', background: '#94a3b8', border: '3px solid var(--color-bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Medal size={20} color="white" />
                                    </div>
                                </div>
                                <div className="glass-panel" style={{ width: '100%', height: '160px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(148, 163, 184, 0.05)', border: '1px solid rgba(148, 163, 184, 0.2)', borderBottom: 'none' }}>
                                    <div style={{ fontWeight: 800, fontSize: '18px', textAlign: 'center', marginBottom: '4px' }}>{leaderboardData[1].name}</div>
                                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#94a3b8' }}>{leaderboardData[1].points}<span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '4px' }}>pts</span></div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', marginTop: '8px' }}>2nd Place</div>
                                </div>
                            </div>
                        )}
                        
                        {/* 1st Place */}
                        <div className="podium-item" style={{ width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                            <div style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
                                <div style={{ position: 'absolute', top: -45, left: '50%', transform: 'translateX(-50%)', color: '#fbbf24' }}>
                                    <Sparkles size={40} className="animate-pulse" />
                                </div>
                                <div style={{ width: '120px', height: '120px', borderRadius: '36px', background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 900, color: 'white', border: '5px solid rgba(251, 191, 36, 0.4)', boxShadow: '0 20px 50px -10px rgba(251, 191, 36, 0.6)' }}>
                                    {leaderboardData[0].name.charAt(0)}
                                </div>
                                <div style={{ position: 'absolute', top: -20, right: -20, width: '56px', height: '56px', borderRadius: '50%', background: '#fbbf24', border: '4px solid var(--color-bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(251, 191, 36, 0.4)' }}>
                                    <Trophy size={32} color="white" />
                                </div>
                            </div>
                            <div className="glass-panel" style={{ width: '100%', height: '220px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderBottom: 'none', boxShadow: '0 -20px 40px -20px rgba(251, 191, 36, 0.2)' }}>
                                <div style={{ fontWeight: 900, fontSize: '22px', textAlign: 'center', marginBottom: '6px' }}>{leaderboardData[0].name}</div>
                                <div style={{ fontSize: '42px', fontWeight: 900, color: '#fbbf24', textShadow: '0 0 20px rgba(251, 191, 36, 0.4)' }}>{leaderboardData[0].points}</div>
                                <div style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24', letterSpacing: '0.1em', marginTop: '10px' }}>1st Place</div>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        {leaderboardData[2] && (
                            <div className="podium-item" style={{ width: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ width: '90px', height: '90px', borderRadius: '28px', background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: 'white', border: '4px solid rgba(180, 83, 9, 0.3)', boxShadow: '0 10px 25px -5px rgba(180, 83, 9, 0.4)' }}>
                                        {leaderboardData[2].name.charAt(0)}
                                    </div>
                                    <div style={{ position: 'absolute', top: -15, right: -15, width: '40px', height: '40px', borderRadius: '50%', background: '#b45309', border: '3px solid var(--color-bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Medal size={20} color="white" />
                                    </div>
                                </div>
                                <div className="glass-panel" style={{ width: '100%', height: '140px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(180, 83, 9, 0.05)', border: '1px solid rgba(180, 83, 9, 0.2)', borderBottom: 'none' }}>
                                    <div style={{ fontWeight: 800, fontSize: '17px', textAlign: 'center', marginBottom: '4px' }}>{leaderboardData[2].name}</div>
                                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#b45309' }}>{leaderboardData[2].points}<span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '4px' }}>pts</span></div>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-text-muted)', marginTop: '8px' }}>3rd Place</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overall Leaderboard Ranking */}
                    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <TrendingUp size={22} color="var(--color-primary)" />
                                <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Full Rankings</h3>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ranking for {batches.find(b => b.id === selectedBatchId)?.name}</div>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '100px', textAlign: 'center' }}>RANK</th>
                                        <th>STUDENT</th>
                                        <th style={{ textAlign: 'center' }}>ATTENDANCE</th>
                                        <th style={{ textAlign: 'center' }}>HOMEWORK</th>
                                        <th style={{ textAlign: 'center' }}>EXAMS</th>
                                        <th style={{ textAlign: 'right', paddingRight: '32px' }}>TOTAL POINTS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboardData.map((student, index) => {
                                        const rankUI = getRankUI(index);
                                        return (
                                            <tr key={student.id} 
                                                style={{ 
                                                    background: index < 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {index < 3 ? (
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: rankUI.bg, color: rankUI.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '15px' }}>
                                                                {rankUI.label}
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontWeight: 800, fontSize: '16px', opacity: 0.5 }}>{index + 1}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
                                                        <div style={{ 
                                                            width: '44px', height: '44px', borderRadius: '14px', 
                                                            background: index < 3 ? rankUI.color : 'rgba(255,255,255,0.05)', 
                                                            color: index < 3 ? 'white' : 'var(--color-text-secondary)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '18px', fontWeight: 900,
                                                            boxShadow: index < 3 ? `0 8px 15px -4px ${rankUI.color}60` : 'none'
                                                        }}>
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '15px' }}>{student.name}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <span>ID: {student.studentId || 'N/A'}</span>
                                                                <span style={{ opacity: 0.3 }}>•</span>
                                                                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', fontSize: '10px' }}>GRADE {student.grade}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{student.breakdown.attendance}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800 }}>POINTS</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{student.breakdown.homework}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800 }}>POINTS</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{student.breakdown.exams}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800 }}>POINTS</div>
                                                </td>
                                                <td style={{ textAlign: 'right', paddingRight: '32px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                                                        <div style={{ fontSize: '20px', fontWeight: 900, color: index === 0 ? '#fbbf24' : 'var(--color-primary)' }}>
                                                            {student.points}
                                                        </div>
                                                        {index < 3 && <Zap size={16} fill={rankUI.color} color={rankUI.color} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Point Scoring Mechanics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
                        {[
                            { title: 'Attendance', subtitle: 'Being on time', value: '+10 pts / class', icon: UserCheck, color: 'var(--color-teal)' },
                            { title: 'Homework', subtitle: 'Finishing tasks', value: '+20 pts / task', icon: Star, color: 'var(--color-warning)' },
                            { title: 'Exams', subtitle: 'Doing well in tests', value: '50% of your marks', icon: Trophy, color: 'var(--color-primary)' }
                        ].map((card, i) => (
                            <div key={i} className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
                                    <card.icon size={80} />
                                </div>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${card.color}15`, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <card.icon size={24} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 900 }}>{card.title}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 700 }}>{card.subtitle}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '20px', fontSize: '18px', fontWeight: 900, color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>
                        <Info size={16} />
                        Only showing currently enrolled students. Data is synchronized across all active batch metrics.
                    </div>
                </div>
            )}
        </div>
    );
}
import { UserCheck } from 'lucide-react';
