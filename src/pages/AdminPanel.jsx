import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, Check, X, Trash2, Users, Database, ShieldAlert, Zap, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminPanel() {
    const { userProfile, isAdmin } = useAuth();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [isMigrating, setIsMigrating] = useState(false);
    const [dbStats, setDbStats] = useState({ total: 0, owned: 0, orphans: 0 });

    useEffect(() => {
        loadUsers();
        if (isAdmin) loadDiagnostics();
    }, [userProfile]);

    async function loadDiagnostics() {
        try {
            const { data: allBatches, error } = await supabase
                .from('batches')
                .select('id, teacher_id');
            
            if (error) throw error;
            
            const owned = allBatches.filter(b => b.teacher_id === userProfile.id).length;
            const orphans = allBatches.filter(b => !b.teacher_id).length;
            
            setDbStats({
                total: allBatches.length,
                owned: owned,
                orphans: orphans
            });
        } catch (err) {
            console.error('Diag Error:', err);
        }
    }

    async function loadUsers() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*');
            
            if (error) throw error;
            
            setPendingUsers(data.filter((u) => u.role === 'pending' && u.role !== 'admin'));
            setApprovedUsers(data.filter((u) => u.role === 'teacher' && u.role !== 'admin'));
        } catch (err) {
            console.error('Error loading users:', err);
        } finally {
            setLoading(false);
        }
    }

    async function approveUser(userId) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'teacher' })
                .eq('id', userId);
            
            if (error) throw error;
            loadUsers();
            toast.success('Access Granted');
        } catch (err) {
            console.error('Auth Error:', err);
            toast.error('Approval Failed');
        }
    }

    async function rejectUser(userId) {
        if (!confirm('Delete this registration request? (Note: This only removes the profile, not the Auth user)')) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);
            
            if (error) throw error;
            loadUsers();
            toast.success('Request deleted');
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    }

    async function revokeAccess(userId) {
        if (!confirm('Remove access for this tutor?')) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'pending' })
                .eq('id', userId);
            
            if (error) throw error;
            loadUsers();
            toast.success('Access removed');
        } catch (err) {
            console.error('Error removing access:', err);
        }
    }

    async function runInitialSync() {
        if (!confirm('Update your database to the latest version? This will restore any "missing" data by fixing consistency issues.')) return;
        setIsMigrating(true);
        const toastId = toast.loading('Performing deep scan and repair...');
        try {
            let batchCount = 0;
            let studentCount = 0;
            let orphanedCount = 0;

            // 1. Fetch batches
            const { data: batches, error: batchError } = await supabase.from('batches').select('*');
            if (batchError) throw batchError;
            
            const batchMap = {};
            for (const b of batches) {
                batchMap[b.id] = b.teacher_id;
            }

            // 2. Fix students (ensure status)
            const { data: students, error: studentError } = await supabase.from('students').select('*');
            if (studentError) throw studentError;
            for (const s of students) {
                if (!s.status) {
                    await supabase.from('students').update({ status: 'enrolled' }).eq('id', s.id);
                    studentCount++;
                }
            }

            // 3. Fix Orphaned Records (Exams, Attendance, Homework, etc. missing teacher_id)
            const tablesToFix = ['exams', 'attendance_records', 'homeworks', 'lessons', 'schedules', 'session_logs'];
            for (const tableName of tablesToFix) {
                const { data: records, error: recError } = await supabase.from(tableName).select('*');
                if (recError) continue;
                
                for (const r of records) {
                    if (!r.teacher_id && r.batch_id && batchMap[r.batch_id]) {
                        await supabase.from(tableName).update({ teacher_id: batchMap[r.batch_id] }).eq('id', r.id);
                        orphanedCount++;
                    }
                }
            }

            toast.success(`Scan Complete: ${studentCount} students fixed, ${orphanedCount} orphaned records restored.`, { id: toastId });
            loadDiagnostics();
        } catch (err) {
            console.error('Deep Sync Error:', err);
            toast.error('Repair process failed. See console for details.', { id: toastId });
        } finally {
            setIsMigrating(false);
        }
    }

    async function claimAllData() {
        const msg = `WARNING: This will re-assign ALL ${dbStats.orphans} records in the system to your current ID (${userProfile.id}). \n\nOnly do this if you are the owner and your ID has changed. Continue?`;
        if (!confirm(msg)) return;
        
        setIsMigrating(true);
        const toastId = toast.loading('Re-assigning ownership...');
        try {
            let count = 0;
            const tables = ['batches', 'students', 'exams', 'attendance_records', 'homeworks', 'lessons', 'schedules', 'session_logs'];
            
            for (const tableName of tables) {
                const { data: records, error: recError } = await supabase.from(tableName).select('*');
                if (recError) continue;
                
                for (const r of records) {
                    if (r.teacher_id !== userProfile.id) {
                        await supabase.from(tableName).update({ teacher_id: userProfile.id }).eq('id', r.id);
                        count++;
                    }
                }
            }
            toast.success(`Success! ${count} records are now assigned to you.`, { id: toastId });
            loadDiagnostics();
        } catch (err) {
            console.error('Claim Error:', err);
            toast.error('Ownership transfer failed');
        } finally {
            setIsMigrating(false);
        }
    }

    if (!isAdmin) {
        return (
            <div className="animate-fade-in" style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
                <div className="glass-panel" style={{ maxWidth: '500px', margin: 'auto', padding: '40px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Lock size={40} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>Admin Access Required</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', lineHeight: 1.6 }}>You need admin permissions to view this page.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Only</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Admin Panel</h1>
                    <p className="page-subtitle">Manage tutors and system data</p>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '8px', marginBottom: 'var(--space-8)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                    { id: 'pending', label: 'Requests', icon: <ShieldAlert size={16} />, count: pendingUsers.length },
                    { id: 'approved', label: 'Tutors', icon: <Check size={16} />, count: approvedUsers.length },
                    { id: 'maintenance', label: 'Maintenance', icon: <Database size={16} /> }
                ].map((t) => (
                    <button 
                        key={t.id}
                        className={`tab ${tab === t.id ? 'active' : ''}`} 
                        onClick={() => setTab(t.id)}
                        style={{ 
                            padding: '10px 18px', 
                            borderRadius: '10px',
                            display: 'flex',
                            flex: '1',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 800,
                            background: tab === t.id ? 'var(--color-accent)' : 'transparent',
                            color: tab === t.id ? 'white' : 'var(--color-text-secondary)',
                            border: 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            minWidth: '120px'
                        }}
                    >
                        {t.icon}
                        {t.label} {t.count !== undefined && <span style={{ opacity: 0.6 }}>({t.count})</span>}
                    </button>
                ))}
            </div>

            <div className="tab-content">
                {tab === 'pending' && (
                    <div className="animate-fade-in">
                        {pendingUsers.length === 0 ? (
                            <div className="glass-card" style={{ padding: '80px 0', textAlign: 'center' }}>
                                <div style={{ width: '80px', height: '80px', background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={32} />
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>No Pending Requests</h3>
                            </div>
                        ) : (
                            <div className="responsive-grid">
                                {pendingUsers.map((user) => (
                                    <div key={user.id} className="glass-card" style={{ padding: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                            <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'var(--color-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px' }}>
                                                {user.displayName?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>{user.displayName || 'Anonymous'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{user.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button className="btn btn-primary" onClick={() => approveUser(user.id)} style={{ flex: 1, height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                                APPROVE
                                            </button>
                                            <button className="btn btn-ghost" onClick={() => rejectUser(user.id)} style={{ flex: 1, color: '#ef4444', height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                                REJECT
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'approved' && (
                    <div className="animate-fade-in">
                        {approvedUsers.length === 0 ? (
                            <div className="glass-card" style={{ padding: '80px 0', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>No Active Tutors</h3>
                            </div>
                        ) : (
                            <div className="responsive-grid">
                                {approvedUsers.map((user) => (
                                    <div key={user.id} className="glass-card" style={{ padding: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                            <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-glass)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px' }}>
                                                {user.displayName?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>{user.displayName || 'Tutor'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{user.email}</div>
                                            </div>
                                        </div>
                                        <button className="btn btn-ghost" onClick={() => revokeAccess(user.id)} style={{ width: '100%', color: '#ef4444', height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                            REVOKE ACCESS
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'maintenance' && (
                    <div className="animate-fade-in">
                        <div className="glass-card" style={{ padding: 'clamp(20px, 5vw, 40px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)', padding: '12px', borderRadius: '16px' }}>
                                    <Database size={28} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 900 }}>System Maintenance</h3>
                                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Keep all records consistent and updated</p>
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />
                                        <div style={{ fontWeight: 800, fontSize: '16px' }}>Database Deep Scan</div>
                                    </div>
                                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, maxWidth: '500px' }}>
                                        Repairs structural inconsistencies and re-links records to the latest schema version.
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={runInitialSync}
                                    disabled={isMigrating}
                                    style={{ padding: '0 32px', height: '48px', fontWeight: 900, boxShadow: 'var(--shadow-lg)' }}
                                >
                                    {isMigrating ? <span className="loading-spinner" style={{ width: 16, height: 16 }} /> : <><Zap size={16} /> RUN REPAIR</>}
                                </button>
                            </div>

                            <div className="responsive-grid" style={{ marginTop: '32px' }}>
                                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Records</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900 }}>{dbStats.total}</div>
                                </div>
                                <div style={{ background: 'var(--color-success-soft)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--color-success)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '8px' }}>Your Records</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-success)' }}>{dbStats.owned}</div>
                                </div>
                                <div style={{ background: 'var(--color-danger-soft)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--color-danger)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px' }}>Mismatched</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444' }}>{dbStats.orphans}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '32px', padding: '24px', borderRadius: '16px', background: 'var(--color-danger-soft)', border: '1px solid var(--color-danger)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '12px' }}>
                                            <ShieldAlert size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: '15px', color: '#ef4444', marginBottom: '2px' }}>Ownership Recovery</div>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Use this if batches belong to a different account ID.</p>
                                        </div>
                                    </div>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={claimAllData}
                                        disabled={isMigrating || dbStats.orphans === 0}
                                        style={{ background: '#ef4444', border: 'none', padding: '0 24px', height: '44px', fontWeight: 900, fontSize: '12px', flex: '1', minWidth: '200px' }}
                                    >
                                        CLAIM ALL SYSTEM DATA
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
