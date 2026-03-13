import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ShieldCheck, Check, X, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminPanel() {
    const { isAdmin } = useAuth();
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        try {
            const snap = await getDocs(collection(db, 'users'));
            const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setPendingUsers(users.filter((u) => !u.isApproved && u.role !== 'admin'));
            setApprovedUsers(users.filter((u) => u.isApproved && u.role !== 'admin'));
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function approveUser(userId) {
        try {
            await updateDoc(doc(db, 'users', userId), { isApproved: true });
            loadUsers();
            toast.success('User approved!');
        } catch (err) {
            console.error('Error:', err);
            toast.error('Failed to approve.');
        }
    }

    async function rejectUser(userId) {
        if (!confirm('Reject and remove this user?')) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            loadUsers();
            toast.success('User rejected.');
        } catch (err) {
            console.error('Error:', err);
        }
    }

    async function revokeAccess(userId) {
        if (!confirm('Revoke this user\'s access?')) return;
        try {
            await updateDoc(doc(db, 'users', userId), { isApproved: false });
            loadUsers();
            toast.success('Access revoked.');
        } catch (err) {
            console.error('Error:', err);
        }
    }

    if (!isAdmin) {
        return (
            <div className="card" style={{ marginTop: 'var(--space-8)' }}>
                <div className="empty-state">
                    <ShieldCheck size={48} className="empty-state-icon" />
                    <div className="empty-state-title">Admin Access Required</div>
                    <div className="empty-state-text">You don't have permission to access this page.</div>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Admin Panel</h1>
                    <p className="page-subtitle">Manage tutor registrations and access</p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
                    Pending ({pendingUsers.length})
                </button>
                <button className={`tab ${tab === 'approved' ? 'active' : ''}`} onClick={() => setTab('approved')}>
                    Approved ({approvedUsers.length})
                </button>
            </div>

            {tab === 'pending' && (
                <div>
                    {pendingUsers.length === 0 ? (
                        <div className="card"><div className="empty-state">
                            <Users size={48} className="empty-state-icon" />
                            <div className="empty-state-title">No pending registrations</div>
                            <div className="empty-state-text">New tutor registrations will appear here for approval.</div>
                        </div></div>
                    ) : (
                        <div className="admin-pending-list">
                            {pendingUsers.map((user) => (
                                <div key={user.id} className="admin-user-card">
                                    <div className="admin-user-info">
                                        <div className="sidebar-avatar" style={{ width: 40, height: 40, fontSize: 'var(--font-size-sm)' }}>
                                            {user.displayName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{user.displayName || 'Unknown'}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {user.email} · Registered {user.createdAt?.toDate ? format(user.createdAt.toDate(), 'MMM d, yyyy') : 'recently'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="admin-user-actions">
                                        <button className="btn btn-primary btn-sm" onClick={() => approveUser(user.id)}>
                                            <Check size={14} /> Approve
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => rejectUser(user.id)}>
                                            <X size={14} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'approved' && (
                <div>
                    {approvedUsers.length === 0 ? (
                        <div className="card"><div className="empty-state">
                            <Users size={48} className="empty-state-icon" />
                            <div className="empty-state-title">No approved tutors</div>
                        </div></div>
                    ) : (
                        <div className="admin-pending-list">
                            {approvedUsers.map((user) => (
                                <div key={user.id} className="admin-user-card">
                                    <div className="admin-user-info">
                                        <div className="sidebar-avatar" style={{ width: 40, height: 40, fontSize: 'var(--font-size-sm)' }}>
                                            {user.displayName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{user.displayName || 'Unknown'}</div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {user.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="admin-user-actions">
                                        <button className="btn btn-danger btn-sm" onClick={() => revokeAccess(user.id)}>
                                            Revoke Access
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
