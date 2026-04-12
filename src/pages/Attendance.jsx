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
    const totalCount = batchStudents.length;
    const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    function markAllPresent() {
        const newRecords = { ...records };
        batchStudents.forEach(s => {
            newRecords[s.id] = 'present';
        });
        setRecords(newRecords);
        toast.success(`Marked ${batchStudents.length} students as present`);
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-12)' }}>
            {/* 1. Page Header & Live Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '8px' }}>
                        Attendance <span style={{ color: 'var(--color-primary)' }}>Taking</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', fontWeight: 600 }}>
                        {selectedBatch ? 'Mark attendance accurately for this session' : 'Select a batch below to begin tracking'}
                    </p>
                </div>

                {selectedBatch && batchStudents.length > 0 && (
                    <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '32px', background: 'rgba(255, 255, 255, 0.02)' }}>
                        <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="64" height="64" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-primary)" strokeWidth="8" 
                                    strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * attendancePercentage) / 100} 
                                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} 
                                    transform="rotate(-90 50 50)" />
                            </svg>
                            <span style={{ position: 'absolute', fontSize: '14px', fontWeight: 900 }}>{attendancePercentage}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: '24px' }}>
                            <div>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Present</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-teal)' }}>{presentCount}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Absent</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--color-danger)' }}>{absentCount}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-8)' }}>
                {[
                    { id: 'mark', label: 'Taking Attendance', icon: UserCheck },
                    { id: 'history', label: 'Past Records Search', icon: History }
                ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{ 
                            padding: '10px 24px', borderRadius: '14px', fontSize: '13px', fontWeight: 800, 
                            border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.3s ease',
                            background: tab === t.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.02)',
                            color: tab === t.id ? 'white' : 'var(--color-text-muted)',
                            display: 'flex', alignItems: 'center', gap: '10px'
                        }}
                    >
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {/* 3. Primary Controls */}
            <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', background: 'rgba(255,255,255,0.01)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                        <LayoutGrid size={14} /> Selected Batch Profile
                    </div>
                    <select className="form-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} style={{ borderRadius: '12px', height: '52px', fontWeight: 700, fontSize: '15px' }}>
                        <option value="">Choose your coaching batch...</option>
                        {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                        <CalendarDays size={14} /> Scheduled Session Date
                    </div>
                    <input className="form-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ borderRadius: '12px', height: '52px', fontWeight: 700, fontSize: '15px' }} />
                </div>
            </div>

            {tab === 'mark' ? (
                <div className="animate-fade-in">
                    {!selectedBatch ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                                <Info size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Batch Selection Required</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Choose a batch profile to view its student enrollment list.</p>
                        </div>
                    ) : batchStudents.length === 0 ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>No Enrolled Students Found</h3>
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>There are currently no active students assigned to this batch group.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', padding: '0 8px' }}>
                                <h4 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ClipboardCheck size={20} /> Student Enrollment ({batchStudents.length})
                                </h4>
                                <button className="btn btn-ghost" onClick={markAllPresent} style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 800, padding: '8px 16px', borderRadius: '10px' }}>
                                    <Check size={14} /> Fast-Mark All Present
                                </button>
                            </div>

                            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                                {batchStudents.map((student, idx) => {
                                    const status = records[student.id];
                                    const isSelected = status !== undefined;
                                    
                                    return (
                                        <div key={student.id} style={{ 
                                            padding: '16px 24px', 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                            borderBottom: idx === batchStudents.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                                            background: isSelected ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                                            transition: 'all 0.2s ease'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                                <div style={{ 
                                                    width: '44px', height: '44px', borderRadius: '14px', 
                                                    background: 'rgba(255, 255, 255, 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '18px', fontWeight: 900, color: 'var(--color-primary)', border: '1px solid rgba(255, 255, 255, 0.04)'
                                                }}>
                                                    {student.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>{student.name}</div>
                                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                        {student.studentId || 'ID#---'} • GRADE {student.grade}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {[
                                                    { id: 'present', label: 'P', color: '#38a169', bg: '#f0fff4' },
                                                    { id: 'absent', label: 'A', color: '#e53e3e', bg: '#fff5f5' },
                                                    { id: 'late', label: 'L', color: '#d69e2e', bg: '#fffff0' }
                                                ].map(btn => (
                                                    <button
                                                        key={btn.id}
                                                        onClick={() => setStatus(student.id, btn.id)}
                                                        className="tooltip-wrapper"
                                                        style={{ 
                                                            width: '42px', height: '42px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                                            background: status === btn.id ? btn.bg : 'rgba(255, 255, 255, 0.03)',
                                                            color: status === btn.id ? btn.color : 'rgba(255, 255, 255, 0.2)',
                                                            fontWeight: 900, fontSize: '15px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            boxShadow: status === btn.id ? `0 4px 12px ${btn.color}30` : 'none',
                                                            transform: status === btn.id ? 'scale(1.05)' : 'none'
                                                        }}
                                                    >
                                                        {btn.label}
                                                        <span className="tooltip">{btn.id.charAt(0).toUpperCase() + btn.id.slice(1)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: 'var(--space-10)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '24px' }}>
                                {existingAttendance && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-teal)', fontSize: '13px', fontWeight: 700 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-teal)' }} />
                                        Update existing record for {format(new Date(selectedDate), 'MMM d')}
                                    </div>
                                )}
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ 
                                    padding: '0 48px', height: '56px', borderRadius: '16px', fontSize: '16px', fontWeight: 900, 
                                    boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', gap: '12px'
                                }}>
                                    {saving ? <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : <Save size={20} />}
                                    {saving ? 'Saving Data...' : 'Submit Attendance'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="animate-fade-in">
                    {history.length === 0 ? (
                        <div className="glass-panel" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
                            <History size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.1, marginBottom: 'var(--space-4)' }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-muted)' }}>No historical logs found</h3>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {history.map((att) => {
                                const isExpanded = expandedId === att.id;
                                const dateVal = new Date(att.date);
                                const attRecords = att.records || [];
                                const p = attRecords.filter((r) => r.status === 'present').length;
                                const a = attRecords.filter((r) => r.status === 'absent').length;
                                const rate = attRecords.length > 0 ? Math.round((p / attRecords.length) * 100) : 0;
                                
                                return (
                                    <div key={att.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', transition: 'all 0.3s ease' }}>
                                        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : att.id)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>{format(dateVal, 'MMM')}</span>
                                                    <span style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1 }}>{format(dateVal, 'dd')}</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '16px' }}>{format(dateVal, 'EEEE, d MMM')}</div>
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#38a169' }}>{p} PRESENT</span>
                                                        <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', opacity: 0.3 }}>•</span>
                                                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#e53e3e' }}>{a} ABSENT</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${rate}%`, height: '100%', background: rate > 80 ? '#38a169' : rate > 50 ? '#d69e2e' : '#e53e3e' }} />
                                                    </div>
                                                    <span style={{ fontSize: '14px', fontWeight: 900, minWidth: '35px' }}>{rate}%</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn btn-ghost btn-icon" style={{ width: '32px', height: '32px' }} onClick={(e) => { e.stopPropagation(); handleEdit(att); }}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon" style={{ width: '32px', height: '32px', color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(att.id); }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease', opacity: 0.3 }}>
                                                    <ChevronDown size={20} />
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="animate-slide-down" style={{ padding: '0 24px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
                                                    {[
                                                        { id: 'present', label: 'Present', color: '#38a169' },
                                                        { id: 'absent', label: 'Absent', color: '#e53e3e' },
                                                        { id: 'late', label: 'Late', color: '#d69e2e' }
                                                    ].map(group => {
                                                        const groupRecs = attRecords.filter(r => r.status === group.id);
                                                        return (
                                                            <div key={group.id}>
                                                                <h5 style={{ fontSize: '10px', fontWeight: 900, color: group.color, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>
                                                                    {group.label} ({groupRecs.length})
                                                                </h5>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    {groupRecs.length === 0 ? (
                                                                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', opacity: 0.5, fontStyle: 'italic' }}>None</div>
                                                                    ) : (
                                                                        groupRecs.map(r => (
                                                                            <div key={r.studentId} style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                                                                {getStudentName(r.studentId)}
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
