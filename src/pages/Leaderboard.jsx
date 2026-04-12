import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { 
    Award, Trophy, Star, Medal, ArrowUp, ArrowDown, 
    Minus, Filter, Info, TrendingUp, Zap, Sparkles, UserCheck,
    Calendar, FileText, BarChart3, Clock
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';
import { examService } from '../services/examService';
import { homeworkService } from '../services/homeworkService';
import ReportCardModal from '../components/analytics/ReportCardModal';

export default function Leaderboard() {
    const { userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [exams, setExams] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    
    // Period Filtering
    const [timePeriod, setTimePeriod] = useState('30'); // '7', '30', '90', 'all'
    const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
    
    // Modals
    const [selectedStudentForReport, setSelectedStudentForReport] = useState(null);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [activeBatches, allStudents, allAttendance, allExams, allHw] = await Promise.all([
                batchService.getBatches(uid, true),
                studentService.getStudentsByTeacher(uid),
                attendanceService.getAttendanceByTeacher(uid),
                examService.getExams(uid),
                homeworkService.getHomeworkByTeacher(uid)
            ]);
            
            setStudents(allStudents.filter(s => s.status === 'enrolled'));
            setBatches(activeBatches);
            
            if (activeBatches.length > 0 && !selectedBatchId) {
                setSelectedBatchId(activeBatches[0].id);
            }

            setAttendance(allAttendance);
            setExams(allExams);
            setHomeworks(allHw);
        } catch (err) {
            console.error('Error loading leaderboard foundation:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredRange = useMemo(() => {
        if (timePeriod === 'all') return { start: new Date(0), end: new Date(2100, 0, 1) };
        if (timePeriod === 'custom') {
            return { 
                start: startOfDay(new Date(customDateRange.from || '2000-01-01')), 
                end: endOfDay(new Date(customDateRange.to || '2100-01-01')) 
            };
        }
        return { 
            start: startOfDay(subDays(new Date(), parseInt(timePeriod))), 
            end: endOfDay(new Date()) 
        };
    }, [timePeriod, customDateRange]);

    const leaderboardData = useMemo(() => {
        if (!selectedBatchId) return [];

        const batchStudents = students.filter(s => (s.batchIds || []).includes(selectedBatchId));
        
        const rankings = batchStudents.map(student => {
            let totalWeightedScore = 0;
            
            // 1. Attendance % (Weight: 30%)
            let attPossible = 0;
            let attPresent = 0;
            attendance.filter(a => a.batch_id === selectedBatchId).forEach(record => {
                const d = new Date(record.date);
                if (isWithinInterval(d, filteredRange)) {
                    const sRecord = (record.records || []).find(r => r.studentId === student.id);
                    if (sRecord) {
                        attPossible++;
                        if (sRecord.status === 'present') {
                            attPresent++;
                        } else if (sRecord.status === 'late') {
                            attPresent += 0.5; // 50% marks for being late
                        }
                    }
                }
            });
            const attRate = attPossible > 0 ? (attPresent / attPossible) : 0;

            // 2. Exam % (Weight: 50%)
            let examTotalPossibleMarks = 0;
            let examTotalEarnedMarks = 0;
            exams.filter(e => e.batch_id === selectedBatchId).forEach(exam => {
                const d = new Date(exam.date);
                if (isWithinInterval(d, filteredRange)) {
                    const score = (exam.scores || []).find(s => s.studentId === student.id);
                    if (score) {
                        examTotalPossibleMarks += (exam.totalMarks || 100);
                        examTotalEarnedMarks += (score.marksObtained || 0);
                    }
                }
            });
            const examRate = examTotalPossibleMarks > 0 ? (examTotalEarnedMarks / examTotalPossibleMarks) : 0;

            // 3. Homework % (Weight: 20%)
            let hwPossible = 0;
            let hwDone = 0;
            homeworks.filter(hw => hw.batch_id === selectedBatchId).forEach(hw => {
                const d = new Date(hw.due_date || hw.created_at);
                if (isWithinInterval(d, filteredRange)) {
                    hwPossible++;
                    const sub = (hw.submissions || {})[student.id];
                    if (sub && (sub.status === 'completed' || sub.status === 'late')) {
                        hwDone++;
                    }
                }
            });
            const hwRate = hwPossible > 0 ? (hwDone / hwPossible) : 0;

            // Final Weighted Calculation
            // Scale to 1000 points for a cleaner leaderboard display
            totalWeightedScore = Math.round(((attRate * 0.3) + (examRate * 0.5) + (hwRate * 0.2)) * 1000);

            return {
                ...student,
                points: totalWeightedScore,
                breakdown: {
                    attendance: Math.round(attRate * 100),
                    exams: Math.round(examRate * 100),
                    homework: Math.round(hwRate * 100)
                }
            };
        });

        return rankings.sort((a, b) => b.points - a.points);
    }, [students, selectedBatchId, attendance, homeworks, exams, filteredRange]);

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
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <h1 className="page-title">Top Students</h1>
                    <p className="page-subtitle">Celebrating performance and consistency</p>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Time Filter */}
                    <div className="glass-card" style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--color-border)' }}>
                        <Clock size={16} color="var(--color-text-muted)" />
                        <select 
                            className="form-select" 
                            value={timePeriod} 
                            onChange={(e) => setTimePeriod(e.target.value)}
                            style={{ width: '130px', height: '28px', border: 'none', background: 'transparent', padding: 0, fontWeight: 700, fontSize: '13px' }}
                        >
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {/* Batch Filter */}
                    <div className="glass-card" style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--color-primary)' }}>
                        <Filter size={16} color="var(--color-primary)" />
                        <select 
                            className="form-select" 
                            value={selectedBatchId} 
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            style={{ minWidth: '160px', height: '28px', border: 'none', background: 'transparent', padding: 0, fontWeight: 700, fontSize: '14px' }}
                        >
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {timePeriod === 'custom' && (
                <div className="glass-panel animate-slide-up" style={{ marginBottom: 'var(--space-6)', padding: '16px', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)' }}>CUSTOM RANGE</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)' }}>FROM</span>
                        <input type="date" className="form-input" style={{ width: '130px' }} value={customDateRange.from} onChange={e => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)' }}>TO</span>
                        <input type="date" className="form-input" style={{ width: '130px' }} value={customDateRange.to} onChange={e => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))} />
                    </div>
                </div>
            )}

            {!selectedBatchId || leaderboardData.length === 0 ? (
                <div className="glass-panel" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-8)' }}>
                        <Trophy size={48} style={{ color: 'var(--color-border)', opacity: 0.5 }} />
                    </div>
                    <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '12px' }}>No Data Found</h2>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>There isn't enough performance data for this batch in the selected period to generate rankings.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
                    
                    {/* Elite Podium Display */}
                    <div className="podium-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 'var(--space-4)', padding: 'var(--space-6) 0', marginTop: 'var(--space-4)' }}>
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
                            <div className="glass-panel" style={{ width: '100%', height: '210px', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderBottom: 'none', boxShadow: '0 -20px 40px -20px rgba(251, 191, 36, 0.2)' }}>
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
                                <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Top Performers</h3>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Weightage: Exams (50%), Attendance (30%), Homework (20%)</div>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '80px', textAlign: 'center' }}>RANK</th>
                                        <th>STUDENT</th>
                                        <th style={{ textAlign: 'center' }}>ATTENDANCE</th>
                                        <th style={{ textAlign: 'center' }}>EXAMS</th>
                                        <th style={{ textAlign: 'center' }}>HOMEWORK</th>
                                        <th style={{ textAlign: 'center' }}>SCORE</th>
                                        <th style={{ textAlign: 'right', paddingRight: '32px' }}>ACTIONS</th>
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
                                                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: rankUI.bg, color: rankUI.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px' }}>
                                                                {rankUI.label}
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontWeight: 800, fontSize: '15px', opacity: 0.5 }}>{index + 1}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                                                        <div style={{ 
                                                            width: '40px', height: '40px', borderRadius: '12px', 
                                                            background: index < 3 ? rankUI.color : 'rgba(255,255,255,0.05)', 
                                                            color: index < 3 ? 'white' : 'var(--color-text-secondary)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '16px', fontWeight: 900
                                                        }}>
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '15px' }}>{student.name}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Class {student.grade}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 800, color: student.breakdown.attendance >= 80 ? 'var(--color-teal)' : 'inherit' }}>{student.breakdown.attendance}%</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 800, color: student.breakdown.exams >= 80 ? 'var(--color-primary)' : 'inherit' }}>{student.breakdown.exams}%</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 800, color: student.breakdown.homework >= 80 ? 'var(--color-warning)' : 'inherit' }}>{student.breakdown.homework}%</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <div style={{ fontSize: '18px', fontWeight: 900, color: index === 0 ? '#fbbf24' : 'var(--color-primary)' }}>
                                                            {student.points}
                                                        </div>
                                                        {index < 3 && <Zap size={14} fill={rankUI.color} color={rankUI.color} />}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                                        <div className="tooltip-wrapper">
                                                            <button 
                                                                className="btn btn-ghost btn-icon" 
                                                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                                                onClick={() => window.location.hash = `#/student-analytics?id=${student.id}`}
                                                            >
                                                                <BarChart3 size={18} />
                                                            </button>
                                                            <span className="tooltip">Analytics</span>
                                                        </div>
                                                        <div className="tooltip-wrapper">
                                                            <button 
                                                                className="btn btn-primary btn-icon" 
                                                                style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                                                                onClick={() => setSelectedStudentForReport(student)}
                                                            >
                                                                <FileText size={18} />
                                                            </button>
                                                            <span className="tooltip">Report Card</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* Performance Formula Explanation */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
                        {[
                            { title: 'Exams (Weight: 50%)', desc: 'Academic excellence is the core of our ranking system.', icon: GraduationCap, color: 'var(--color-primary)' },
                            { title: 'Attendance (Weight: 30%)', desc: 'Consistency and discipline are key to long-term success.', icon: UserCheck, color: 'var(--color-teal)' },
                            { title: 'Homework (Weight: 20%)', desc: 'Regular practice through tasks ensures solid foundations.', icon: Star, color: 'var(--color-warning)' }
                        ].map((item, i) => (
                            <div key={i} className="glass-card" style={{ padding: '24px', borderLeft: `4px solid ${item.color}` }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <item.icon size={20} />
                                    </div>
                                    <div style={{ fontSize: '15px', fontWeight: 900 }}>{item.title}</div>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Support Modal */}
            {selectedStudentForReport && (
                <ReportCardModal 
                    student={selectedStudentForReport}
                    batches={batches}
                    attendance={attendance}
                    exams={exams}
                    homeworks={homeworks}
                    onClose={() => setSelectedStudentForReport(null)}
                />
            )}
        </div>
    );
}
