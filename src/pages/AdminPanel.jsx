import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ShieldCheck, Check, X, Trash2, Users, Database, ShieldAlert, Zap, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminPanel() {
    const { isAdmin } = useAuth();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [isMigrating, setIsMigrating] = useState(false);
    const [dbStats, setDbStats] = useState({ total: 0, owned: 0, orphans: 0 });

    useEffect(() => {
        loadUsers();
        if (isAdmin) loadDiagnostics();
    }, [currentUser]);

    async function loadDiagnostics() {
        try {
            const batchSnap = await getDocs(collection(db, 'batches'));
            const all = batchSnap.docs.map(d => d.data());
            const owned = all.filter(b => b.teacherId === currentUser.uid).length;
            const nested = all.filter(b => !b.teacherId && b.studentIds?.teacherId === currentUser.uid).length;
            
            setDbStats({
                total: all.length,
                owned: owned + nested,
                orphans: all.length - (owned + nested)
            });
        } catch (err) {
            console.error('Diag Error:', err);
        }
    }

    async function loadUsers() {
        try {
            const snap = await getDocs(collection(db, 'users'));
            const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setPendingUsers(users.filter((u) => !u.isApproved && u.role !== 'admin'));
            setApprovedUsers(users.filter((u) => u.isApproved && u.role !== 'admin'));
        } catch (err) {
            console.error('Error loading users:', err);
        } finally {
            setLoading(false);
        }
    }

    async function approveUser(userId) {
        try {
            await updateDoc(doc(db, 'users', userId), { isApproved: true });
            loadUsers();
            toast.success('Access Granted');
        } catch (err) {
            console.error('Auth Error:', err);
            toast.error('Approval Failed');
        }
    }

    async function rejectUser(userId) {
        if (!confirm('Delete this registration request?')) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            loadUsers();
            toast.success('Request deleted');
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    }

    async function revokeAccess(userId) {
        if (!confirm('Remove access for this tutor?')) return;
        try {
            await updateDoc(doc(db, 'users', userId), { isApproved: false });
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

            // 1. Load batches and fix top-level fields (including nested teacherId)
            const batchSnap = await getDocs(collection(db, 'batches'));
            const batchMap = {}; // To find teacherId for linked records

            for (const d of batchSnap.docs) {
                const data = d.data();
                const updatePatch = {};
                let needsUpdate = false;

                // FIX: Move teacherId out of nested maps if it got stuck there (e.g. inside studentIds)
                if (!data.teacherId && data.studentIds?.teacherId) {
                    updatePatch.teacherId = data.studentIds.teacherId;
                    needsUpdate = true;
                }
                
                // FIX: Simple consistency fields
                if (data.isClosed === undefined) { updatePatch.isClosed = false; needsUpdate = true; }
                if (!data.subject && data.studentIds?.subject) { updatePatch.subject = data.studentIds.subject; needsUpdate = true; }

                if (needsUpdate) {
                    await updateDoc(doc(db, 'batches', d.id), updatePatch);
                    batchCount++;
                }
                batchMap[d.id] = (updatePatch.teacherId || data.teacherId);
            }

            // 2. Fix students (consistency)
            const studentSnap = await getDocs(collection(db, 'students'));
            for (const d of studentSnap.docs) {
                const data = d.data();
                if (data.status === undefined) {
                    await updateDoc(doc(db, 'students', d.id), { status: 'enrolled' });
                    studentCount++;
                }
            }

            // 3. Fix Orphaned Records (Exams, Attendance, Homework, etc. missing teacherId)
            const collectionsToFix = ['exams', 'attendance', 'homeworks', 'lessons', 'schedules', 'sessionLogs'];
            for (const collName of collectionsToFix) {
                const collSnap = await getDocs(collection(db, collName));
                for (const d of collSnap.docs) {
                    const data = d.data();
                    if (!data.teacherId && data.batchId && batchMap[data.batchId]) {
                        await updateDoc(doc(db, collName, d.id), { teacherId: batchMap[data.batchId] });
                        orphanedCount++;
                    }
                }
            }

            toast.success(`Scan Complete: ${batchCount} batches fixed, ${orphanedCount} orphaned records restored.`, { id: toastId });
            loadDiagnostics();
        } catch (err) {
            console.error('Deep Sync Error:', err);
            toast.error('Repair process failed. See console for details.', { id: toastId });
        } finally {
            setIsMigrating(false);
        }
    }

    async function claimAllData() {
        const msg = `WARNING: This will re-assign ALL ${dbStats.orphans} records in the system to your current ID (${currentUser.uid}). \n\nOnly do this if you are the owner and your ID has changed. Continue?`;
        if (!confirm(msg)) return;
        
        setIsMigrating(true);
        const toastId = toast.loading('Re-assigning ownership...');
        try {
            let count = 0;
            const collections = ['batches', 'students', 'exams', 'attendance', 'homeworks', 'lessons', 'schedules', 'sessionLogs'];
            
            for (const collName of collections) {
                const snap = await getDocs(query(collection(db, collName)));
                for (const d of snap.docs) {
                    const data = d.data();
                    // If it's not mine, OR it has nested teacherId that is mine but not top level
                    if (data.teacherId !== currentUser.uid || (!data.teacherId && data.studentIds?.teacherId === currentUser.uid)) {
                        await updateDoc(doc(db, collName, d.id), { 
                            teacherId: currentUser.uid,
                            // Also fix nested subject/etc if in batches
                            ...(collName === 'batches' && !data.subject && data.studentIds?.subject ? { subject: data.studentIds.subject } : {})
                        });
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

            <div className="glass-panel" style={{ padding: '8px', marginBottom: 'var(--space-8)', display: 'inline-flex', gap: '8px', background: 'rgba(255, 255, 255, 0.03)' }}>
                {[
                    { id: 'pending', label: 'Waiting for Approval', icon: <ShieldAlert size={16} />, count: pendingUsers.length },
                    { id: 'approved', label: 'Tutors', icon: <Check size={16} />, count: approvedUsers.length },
                    { id: 'maintenance', label: 'Data Tools', icon: <Database size={16} /> }
                ].map((t) => (
                    <button 
                        key={t.id}
                        className={`tab ${tab === t.id ? 'active' : ''}`} 
                        onClick={() => setTab(t.id)}
                        style={{ 
                            padding: '10px 18px', 
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 800,
                            background: tab === t.id ? 'var(--color-primary)' : 'transparent',
                            color: tab === t.id ? 'white' : 'var(--color-text-muted)',
                            border: 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
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
                                <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={32} />
                                </div>
                                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>No Pending Requests</h3>
                                <p style={{ color: 'var(--color-text-muted)', maxWidth: '300px', margin: '8px auto' }}>Everything is up to date.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '16px' }}>
                                {pendingUsers.map((user) => (
                                    <div key={user.id} className="glass-card hover-lift" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                            <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px' }}>
                                                {user.displayName?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>{user.displayName || 'Anonymous Tutor'}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                    {user.email} · Registered {user.createdAt?.toDate ? format(user.createdAt.toDate(), 'PPP') : 'Processing...'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button className="btn btn-primary" onClick={() => approveUser(user.id)} style={{ padding: '0 20px', height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                                <Check size={16} /> APPROVE
                                            </button>
                                            <button className="btn btn-ghost" onClick={() => rejectUser(user.id)} style={{ color: '#ef4444', height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                                <X size={16} /> REMOVE
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
                            <div style={{ display: 'grid', gap: '16px' }}>
                                {approvedUsers.map((user) => (
                                    <div key={user.id} className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                            <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '18px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                {user.displayName?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '4px' }}>{user.displayName || 'Authorized Tutor'}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn btn-ghost" onClick={() => revokeAccess(user.id)} style={{ color: '#ef4444', height: '40px', fontSize: '12px', fontWeight: 900 }}>
                                            REMOVE ACCESS
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'maintenance' && (
                    <div className="animate-fade-in">
                        <div className="glass-card" style={{ padding: '40px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', padding: '12px', borderRadius: '16px' }}>
                                    <Database size={28} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '20px', fontWeight: 900 }}>Data Management</h3>
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Keep all records consistent and updated</p>
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: '32px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                                        <div style={{ fontWeight: 800, fontSize: '16px' }}>Update Old Records</div>
                                    </div>
                                    <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.5, maxWidth: '500px' }}>
                                        Adds new features to your older records. This ensures all your batches and students have the latest settings applied.
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={runInitialSync}
                                    disabled={isMigrating}
                                    style={{ padding: '0 32px', height: '48px', fontWeight: 900, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)' }}
                                >
                                    {isMigrating ? <span className="loading-spinner" style={{ width: 16, height: 16, borderWeight: 2 }} /> : <><Zap size={16} /> START UPDATE</>}
                                </button>
                            </div>

                            <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Global Records</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900 }}>{dbStats.total}</div>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', marginBottom: '8px' }}>Your Records</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981' }}>{dbStats.owned}</div>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px' }}>Other/Orphaned</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444' }}>{dbStats.orphans}</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '32px', padding: '24px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '12px' }}>
                                            <ShieldAlert size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: '15px', color: '#ef4444', marginBottom: '2px' }}>Ownership Recovery</div>
                                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>If your User ID changed, use this to re-claim all data in the system.</p>
                                        </div>
                                    </div>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={claimAllData}
                                        disabled={isMigrating || dbStats.orphans === 0}
                                        style={{ background: '#ef4444', border: 'none', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.2)', padding: '0 24px', height: '44px', fontWeight: 900, fontSize: '12px' }}
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
