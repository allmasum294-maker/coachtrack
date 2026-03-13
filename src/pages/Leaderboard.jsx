import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Award, Trophy, Star, Medal, ArrowUp, ArrowDown, Minus } from 'lucide-react';

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
            const [studentSnap, batchSnap, attSnap, examSnap, hwSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'batches'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'attendance'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'exams'), where('teacherId', '==', uid))),
                getDocs(query(collection(db, 'homeworks'), where('teacherId', '==', uid))),
            ]);
            setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            
            const fetchedBatches = batchSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setBatches(fetchedBatches);
            if (fetchedBatches.length > 0) {
                setSelectedBatchId(fetchedBatches[0].id);
            }

            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setHomeworks(hwSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading leaderboard data:', err);
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
                    if (record && record.status === 'present') {
                        attPoints += 10;
                    }
                }
            });

            // Homework Points (20 pts per completed HW)
            homeworks.forEach(hw => {
                if (hw.batchId === selectedBatchId) {
                    if ((hw.completedBy || []).includes(student.id)) {
                        hwPoints += 20;
                    }
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

        // Sort descending
        return scores.sort((a, b) => b.points - a.points);
    }, [students, selectedBatchId, attendance, homeworks, exams]);

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <Trophy size={24} style={{ color: '#fbbf24' }} />; // Gold
            case 1: return <Medal size={24} style={{ color: '#94a3b8' }} />; // Silver
            case 2: return <Medal size={24} style={{ color: '#b45309' }} />; // Bronze
            default: return <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-text-muted)' }}>{index + 1}</div>;
        }
    };

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Top Achievers</h1>
                    <p className="page-subtitle">Gamified leaderboard based on performance, attendance, and homework</p>
                </div>
                <div>
                    <select 
                        className="form-select" 
                        value={selectedBatchId} 
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        style={{ minWidth: '200px' }}
                    >
                        {batches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {leaderboardData.length === 0 ? (
                <div className="empty-state card">
                    <Award size={48} className="empty-state-icon" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }} />
                    <div className="empty-state-title">No Data Available</div>
                    <div className="empty-state-text">No students found in this batch or no activities recorded yet.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    
                    {/* Top 3 Podium Cards */}
                    {leaderboardData.length >= 3 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', alignItems: 'end', marginBottom: 'var(--space-4)' }}>
                            {/* Rank 2 */}
                            <div className="card" style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center', background: 'linear-gradient(to bottom, var(--color-bg-card), var(--color-bg-elevated))', borderTop: '4px solid #94a3b8', transform: 'translateY(20px)' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
                                    <Medal size={32} style={{ color: '#94a3b8' }} />
                                </div>
                                <div style={{ width: 64, height: 64, margin: '0 auto var(--space-3)', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                                    {leaderboardData[1].name.charAt(0)}
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>{leaderboardData[1].name}</h3>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-accent)' }}>{leaderboardData[1].points} <span style={{fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500}}>pts</span></div>
                            </div>
                            
                            {/* Rank 1 */}
                            <div className="card" style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', background: 'linear-gradient(to bottom, var(--color-primary-soft), var(--color-primary))', borderTop: '4px solid #fbbf24', boxShadow: '0 10px 25px -5px rgba(251, 191, 36, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                                    <Trophy size={48} style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))' }} />
                                </div>
                                <div style={{ width: 80, height: 80, margin: '0 auto var(--space-3)', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, color: 'white', border: '3px solid rgba(255,255,255,0.5)' }}>
                                    {leaderboardData[0].name.charAt(0)}
                                </div>
                                <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', color: 'white' }}>{leaderboardData[0].name}</h3>
                                <div style={{ fontSize: '32px', fontWeight: 800, color: '#fbbf24' }}>{leaderboardData[0].points} <span style={{fontSize: '14px', color: 'rgba(255,255,255,0.7)', fontWeight: 500}}>pts</span></div>
                            </div>

                            {/* Rank 3 */}
                            <div className="card" style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center', background: 'linear-gradient(to bottom, var(--color-bg-card), var(--color-bg-elevated))', borderTop: '4px solid #b45309', transform: 'translateY(30px)' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
                                    <Medal size={32} style={{ color: '#b45309' }} />
                                </div>
                                <div style={{ width: 64, height: 64, margin: '0 auto var(--space-3)', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                                    {leaderboardData[2].name.charAt(0)}
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>{leaderboardData[2].name}</h3>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-accent)' }}>{leaderboardData[2].points} <span style={{fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500}}>pts</span></div>
                            </div>
                        </div>
                    )}

                    {/* Full List */}
                    <div className="card">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                                        <th>Student</th>
                                        <th style={{ textAlign: 'right' }}>Attendance Points</th>
                                        <th style={{ textAlign: 'right' }}>Homework Points</th>
                                        <th style={{ textAlign: 'right' }}>Exam Points</th>
                                        <th style={{ textAlign: 'right', fontSize: '15px', fontWeight: 800 }}>Total Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboardData.map((student, index) => (
                                        <tr key={student.id} style={{ transition: 'all 0.2s', background: index < 3 ? 'var(--color-bg-elevated)' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                {getRankIcon(index)}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                    <div className="attendance-student-avatar" style={{ background: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : 'var(--color-bg-elevated)', color: index < 3 ? '#fff' : 'var(--color-accent)' }}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div style={{ fontWeight: 600 }}>{student.name}</div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{student.breakdown.attendance}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{student.breakdown.homework}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{student.breakdown.exams}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '16px', color: 'var(--color-accent)' }}>
                                                {student.points}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Points Legend */}
                    <div style={{ background: 'var(--color-bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-6)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={14} style={{ color: 'var(--color-gold)' }} /> <strong>+10 pts</strong> per attended class
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={14} style={{ color: 'var(--color-gold)' }} /> <strong>+20 pts</strong> per completed homework
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={14} style={{ color: 'var(--color-gold)' }} /> <strong>+0.5 pts</strong> per exam mark obtained
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
