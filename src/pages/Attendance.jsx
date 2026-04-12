import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import React from 'react';
import { 
    ClipboardCheck, Check, X as XIcon, Clock, Save, 
    Trash2, Edit2, ChevronDown, ChevronUp, UserCheck, 
    CalendarDays, History, LayoutGrid, Info, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { batchService } from '../services/batchService';
import { studentService } from '../services/studentService';
import { attendanceService } from '../services/attendanceService';

export default function Attendance() {
    const { userProfile } = useAuth();
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [records, setRecords] = useState({});
    const [existingAttendance, setExistingAttendance] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('mark');
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        if (userProfile?.id) loadData();
    }, [userProfile]);

    useEffect(() => {
        if (selectedBatch && selectedDate) loadAttendanceForDate();
    }, [selectedBatch, selectedDate]);

    async function loadData() {
        try {
            const uid = userProfile.id;
            const [activeBatches, allStudents] = await Promise.all([
                batchService.getBatches(uid, true),
                studentService.getStudentsByTeacher(uid)
            ]);
            setBatches(activeBatches);
            setStudents(allStudents.filter(s => s.status === 'enrolled'));
        } catch (err) {
            console.error('Error loading students:', err);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    }

    async function loadAttendanceForDate() {
        try {
            const data = await attendanceService.getBatchAttendance(selectedBatch);
            
            const existing = data.find((d) => d.date === selectedDate);

            if (existing) {
                setExistingAttendance(existing);
                const recs = {};
                (existing.records || []).forEach((log) => {
                    recs[log.studentId] = log.status;
                });
                setRecords(recs);
            } else {
                setExistingAttendance(null);
                const enrolledInBatch = students.filter((s) => (s.batchIds || []).includes(selectedBatch));
                const recs = {};
                enrolledInBatch.forEach((s) => { recs[s.id] = 'present'; });
                setRecords(recs);
            }

            setHistory(data);
        } catch (err) {
            console.error('Error loading attendance history:', err);
        }
    }

    const batchStudents = useMemo(() => {
        const enrolled = students.filter((s) => (s.batchIds || []).includes(selectedBatch));
        if (existingAttendance?.records) {
            const historicalIds = existingAttendance.records.map((log) => log.studentId);
            const historicalStudents = students.filter(
                (s) => historicalIds.includes(s.id) && !enrolled.some((e) => e.id === s.id)
            );
            return [...enrolled, ...historicalStudents];
        }
        return enrolled;
    }, [students, selectedBatch, existingAttendance]);

    function setStatus(studentId, status) {
        setRecords((prev) => ({ ...prev, [studentId]: status }));
    }

    async function handleSave() {
        if (!selectedBatch) return toast.error('Please select a batch first');
        setSaving(true);
        const toastId = toast.loading('Saving attendance...');
        try {
            await attendanceService.saveAttendance(
                userProfile.id,
                selectedBatch,
                selectedDate,
                records
            );

            // Sync with Schedule
            const { data: schedules } = await supabase
                .from('schedules')
                .select('id')
                .eq('teacher_id', userProfile.id)
                .eq('batch_id', selectedBatch)
                .eq('date', selectedDate)
                .eq('status', 'scheduled');
            
            if (schedules && schedules.length > 0) {
                await supabase
                    .from('schedules')
                    .update({ status: 'completed' })
                    .in('id', schedules.map(s => s.id));
            }

            toast.success('Attendance saved!', { id: toastId });
            loadAttendanceForDate();
        } catch (err) {
            console.error('Save error:', err);
            toast.error('Failed to sync attendance.', { id: toastId });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('This will permanently delete this record. Proceed?')) return;
        try {
            const { error } = await supabase
                .from('attendance_records')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Record deleted');
            loadAttendanceForDate();
        } catch (err) {
            console.error('Delete error:', err);
            toast.error('Failed to delete');
        }
    }

    function handleEdit(att) {
        setSelectedBatch(att.batch_id);
        setSelectedDate(att.date);
        setTab('mark');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function getStudentName(id) {
        return students.find(s => s.id === id)?.name || 'Former Student';
    }

    const presentCount = Object.values(records).filter((s) => s === 'present').length;
    const absentCount = Object.values(records).filter((s) => s === 'absent').length;
    const lateCount = Object.values(records).filter((s) => s === 'late').length;

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-12)' }}>
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '12px' }}>
                            <Activity size={24} />
                        </div>
                        <h1 className="page-title" style={{ margin: 0 }}>Attendance Records</h1>
                    </div>
                    <p className="page-subtitle">Track student attendance for your classes</p>
                </div>
            </div>

            {/* Premium Tab Navigation */}
            <div className="glass-panel" style={{ 
                display: 'flex', 
                gap: '8px', 
                padding: '6px', 
                marginBottom: 'var(--space-8)', 
                flexWrap: 'wrap'
            }}>
                <button 
                    className={`tab ${tab === 'mark' ? 'active' : ''}`} 
                    onClick={() => setTab('mark')}
                    style={{ 
                        padding: '12px 24px', 
                        borderRadius: '12px', 
                        fontSize: '14px', 
                        fontWeight: 800, 
                        background: tab === 'mark' ? 'var(--color-accent)' : 'transparent',
                        color: tab === 'mark' ? 'white' : 'var(--color-text-secondary)',
                        border: 'none', 
                        cursor: 'pointer', 
                        transition: 'all 0.3s ease',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        flex: '1',
                        minWidth: '160px',
                        justifyContent: 'center'
                    }}
                >
                    <LayoutGrid size={18} /> Mark Attendance
                </button>
                <button 
                    className={`tab ${tab === 'history' ? 'active' : ''}`} 
                    onClick={() => setTab('history')}
                    style={{ 
                        padding: '12px 24px', 
                        borderRadius: '12px', 
                        fontSize: '14px', 
                        fontWeight: 800, 
                        background: tab === 'history' ? 'var(--color-accent)' : 'transparent',
                        color: tab === 'history' ? 'white' : 'var(--color-text-secondary)',
                        border: 'none', 
                        cursor: 'pointer', 
                        transition: 'all 0.3s ease',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        flex: '1',
                        minWidth: '160px',
                        justifyContent: 'center'
                    }}
                >
                    <History size={18} /> Past Records
                </button>
            </div>

            {/* Focus Controls */}
            <div className="glass-panel" style={{ 
                padding: 'var(--space-8)', 
                marginBottom: 'var(--space-8)', 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: 'var(--space-8)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <UserCheck size={16} /> Select Batch
                    </label>
                    <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} style={{ height: '56px', fontSize: '16px', fontWeight: 700, borderRadius: '14px', background: 'rgba(255, 255, 255, 0.04)' }}>
                        <option value="">Choose a Batch...</option>
                        {batches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <CalendarDays size={16} /> Class Date
                    </label>
                    <input className="form-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ height: '56px', fontSize: '16px', fontWeight: 700, borderRadius: '14px', background: 'rgba(255, 255, 255, 0.04)' }} />
                </div>
            </div>

            {tab === 'mark' && (
                <div className="animate-fade-in">
                    {!selectedBatch ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-20)', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                            <div style={{ 
                                width: '100px', height: '100px', borderRadius: '30px', 
                                background: 'rgba(59, 130, 246, 0.05)', display: 'flex', 
                                alignItems: 'center', justifyContent: 'center', 
                                margin: '0 auto var(--space-8)', color: 'var(--color-primary)',
                                border: '1px solid rgba(59, 130, 246, 0.1)'
                            }}>
                                <Info size={48} />
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em' }}>Select a Batch</h2>
                            <p style={{ color: 'var(--color-text-muted)', maxWidth: '450px', margin: '0 auto', fontSize: '16px', lineHeight: 1.6 }}>Please select a batch from the menu above to start marking student attendance.</p>
                        </div>
                    ) : batchStudents.length === 0 ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-20)', textAlign: 'center' }}>
                            <ClipboardCheck size={80} style={{ color: 'rgba(255, 255, 255, 0.05)', marginBottom: 'var(--space-8)' }} />
                            <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em' }}>No Enrolled Students</h2>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>There are no active students in this batch.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Stat Bar */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: '1px solid rgba(20, 184, 166, 0.1)' }}>
                                    <div style={{ padding: '12px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-teal)', borderRadius: '14px', boxShadow: '0 0 15px rgba(20, 184, 166, 0.2)' }}><Check size={24} /></div>
                                    <div><div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRESENT</div><div style={{ fontSize: '24px', fontWeight: 900 }}>{presentCount}</div></div>
                                </div>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '14px', boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)' }}><XIcon size={24} /></div>
                                    <div><div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ABSENT</div><div style={{ fontSize: '24px', fontWeight: 900 }}>{absentCount}</div></div>
                                </div>
                                <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                                    <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', borderRadius: '14px', boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)' }}><Clock size={24} /></div>
                                    <div><div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LATE</div><div style={{ fontSize: '24px', fontWeight: 900 }}>{lateCount}</div></div>
                                </div>
                                {existingAttendance && (
                                    <div className="glass-card" style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', border: '1px solid var(--color-primary)', background: 'rgba(59, 130, 246, 0.05)' }}>
                                        <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-primary)', borderRadius: '14px', boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}><Save size={24} /></div>
                                        <div><div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</div><div style={{ fontSize: '20px', fontWeight: 900, color: 'white' }}>SAVED</div></div>
                                    </div>
                                )}
                            </div>

                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {batchStudents.map((student, idx) => (
                                        <div key={student.id} 
                                            style={{ 
                                                padding: '24px 40px', 
                                                borderBottom: idx === batchStudents.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: records[student.id] === 'absent' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                <div style={{ 
                                                    width: '60px', height: '60px', borderRadius: '20px', 
                                                    background: 'rgba(255, 255, 255, 0.03)', display: 'flex', 
                                                    alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '22px', fontWeight: 900, color: 'var(--color-primary)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    textShadow: '0 0 10px rgba(59, 130, 246, 0.3)'
                                                }}>
                                                    {student.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.01em' }}>{student.name}</div>
                                                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', gap: '10px', marginTop: '4px', alignItems: 'center' }}>
                                                        <span style={{ 
                                                            background: 'rgba(255, 255, 255, 0.08)', 
                                                            padding: '2px 10px', 
                                                            borderRadius: '6px', 
                                                            fontWeight: 700,
                                                            fontSize: '11px',
                                                            color: 'white'
                                                        }}>GRADE: {student.grade}</span>
                                                        <span style={{ opacity: 0.3 }}>•</span>
                                                        <span style={{ fontWeight: 600 }}>{student.studentId || 'NO_UID'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                                                {[
                                                    { id: 'present', label: 'Present', icon: Check, color: 'var(--color-teal)' },
                                                    { id: 'absent', label: 'Absent', icon: XIcon, color: 'var(--color-danger)' },
                                                    { id: 'late', label: 'Late', icon: Clock, color: 'var(--color-warning)' }
                                                ].map((btn) => (
                                                    <button
                                                        key={btn.id}
                                                        onClick={() => setStatus(student.id, btn.id)}
                                                        style={{ 
                                                            display: 'flex', alignItems: 'center', gap: '10px', 
                                                            padding: '12px 24px', borderRadius: '14px', 
                                                            fontSize: '14px', fontWeight: 800, 
                                                            cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            border: records[student.id] === btn.id ? `2px solid ${btn.color}` : '1px solid rgba(255, 255, 255, 0.04)',
                                                            background: records[student.id] === btn.id ? `${btn.color}15` : 'rgba(255, 255, 255, 0.02)',
                                                            color: records[student.id] === btn.id ? btn.color : 'var(--color-text-muted)',
                                                            boxShadow: records[student.id] === btn.id ? `0 0 20px ${btn.color}20` : 'none',
                                                            transform: records[student.id] === btn.id ? 'translateY(-2px)' : 'none'
                                                        }}
                                                    >
                                                        <btn.icon size={18} /> {btn.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 'var(--space-10)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ 
                                    padding: '0 56px', height: '64px', borderRadius: '20px', 
                                    fontSize: '18px', fontWeight: 900, 
                                    boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)',
                                    display: 'flex', alignItems: 'center', gap: '12px'
                                }}>
                                    {saving ? (
                                        <>Saving Records...</>
                                    ) : (
                                        <>
                                            <Save size={22} />
                                            Save Attendance
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div className="animate-fade-in">
                    {history.length === 0 ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-20)', textAlign: 'center' }}>
                            <History size={80} style={{ color: 'rgba(255, 255, 255, 0.05)', marginBottom: 'var(--space-8)' }} />
                            <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em' }}>No History Found</h2>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>Attendance history for this batch will show up here.</p>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                                            <th style={{ padding: '24px 40px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Class Date</th>
                                            <th style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Attendance Summary</th>
                                            <th style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Attendance %</th>
                                            <th style={{ textAlign: 'right', paddingRight: '40px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((att) => {
                                            const isExpanded = expandedId === att.id;
                                            const dateVal = att.date?.toDate ? att.date.toDate() : new Date(att.date);
                                            const attRecords = att.records || [];
                                            const p = attRecords.filter((r) => r.status === 'present').length;
                                            const a = attRecords.filter((r) => r.status === 'absent').length;
                                            const l = attRecords.filter((r) => r.status === 'late').length;
                                            const total = attRecords.length;
                                            const rate = total > 0 ? Math.round((p / total) * 100) : 0;
                                            
                                            return (
                                                <React.Fragment key={att.id}>
                                                    <tr style={{ cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }} onClick={() => setExpandedId(isExpanded ? null : att.id)}>
                                                        <td style={{ padding: '28px 40px', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.01em' }}>{format(dateVal, 'MMMM d, yyyy')}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: 900, padding: '4px 12px', borderRadius: '8px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-teal)', border: '1px solid rgba(20, 184, 166, 0.2)' }}>{p} PRESENT</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 900, padding: '4px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{a} ABSENT</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 900, padding: '4px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{l} LATE</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                <div style={{ width: '120px', height: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                                    <div style={{ width: `${rate}%`, height: '100%', background: 'var(--color-primary)', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }} />
                                                                </div>
                                                                <span style={{ fontSize: '16px', fontWeight: 900, color: 'white' }}>{rate}%</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', paddingRight: '40px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                                                                <div className="tooltip-wrapper">
                                                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '36px', height: '36px', borderRadius: '10px' }} onClick={(e) => { e.stopPropagation(); handleEdit(att); }}>
                                                                        <Edit2 size={18} />
                                                                    </button>
                                                                    <span className="tooltip">Edit Record</span>
                                                                </div>
                                                                <div className="tooltip-wrapper">
                                                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '36px', height: '36px', borderRadius: '10px' }} onClick={(e) => { e.stopPropagation(); handleDelete(att.id); }}>
                                                                        <Trash2 size={18} style={{ color: 'var(--color-danger)' }} />
                                                                    </button>
                                                                    <span className="tooltip">Delete Record</span>
                                                                </div>
                                                                <div style={{ marginLeft: '12px', opacity: 0.5 }}>
                                                                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan="4" style={{ padding: '0', background: 'rgba(255, 255, 255, 0.01)' }}>
                                                                <div className="animate-slide-down" style={{ padding: '40px' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px' }}>
                                                                        {[
                                                                            { title: 'Confirmed Present', status: 'present', color: 'var(--color-teal)', icon: Check },
                                                                            { title: 'Recorded Absent', status: 'absent', color: 'var(--color-danger)', icon: XIcon },
                                                                            { title: 'Marked Late', status: 'late', color: 'var(--color-warning)', icon: Clock }
                                                                        ].map((group) => (
                                                                            <div key={group.status}>
                                                                                <h4 style={{ fontSize: '13px', fontWeight: 950, color: group.color, textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                                    <group.icon size={16} /> {group.title}
                                                                                </h4>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                                    {attRecords.filter(r => r.status === group.status).length === 0 ? (
                                                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', fontStyle: 'italic', opacity: 0.6 }}>No students recorded</span>
                                                                                    ) : (
                                                                                        attRecords.filter(r => r.status === group.status).map(r => (
                                                                                            <div key={r.studentId} className="glass-card" style={{ 
                                                                                                padding: '12px 20px', 
                                                                                                fontSize: '14px', 
                                                                                                fontWeight: 700, 
                                                                                                background: 'rgba(255, 255, 255, 0.03)',
                                                                                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                                                                                display: 'flex',
                                                                                                justifyContent: 'space-between',
                                                                                                alignItems: 'center'
                                                                                            }}>
                                                                                                {getStudentName(r.studentId)}
                                                                                                <span style={{ opacity: 0.3, fontSize: '11px' }}>#{r.studentId.substring(0, 6)}</span>
                                                                                            </div>
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
