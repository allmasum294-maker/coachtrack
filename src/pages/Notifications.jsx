import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Bell, CheckCircle, AlertCircle, Calendar, Info, Check, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Notifications() {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');

    useEffect(() => {
        if (currentUser) loadNotifications();
    }, [currentUser]);

    async function loadNotifications() {
        try {
            const snap = await getDocs(
                query(collection(db, 'notifications'), where('teacherId', '==', currentUser.uid))
            );
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setNotifications(data.sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return db2 - da;
            }));
        } catch (err) {
            console.error('Core Signaling Error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function markAsRead(notificationId) {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
            );
        } catch (err) {
            console.error('Signal Update Error:', err);
        }
    }

    async function markAllRead() {
        try {
            const unread = notifications.filter((n) => !n.isRead);
            await Promise.all(
                unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { isRead: true }))
            );
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('Global Signal Reset Error:', err);
        }
    }

    function getIcon(type) {
        switch (type) {
            case 'schedule': return <Calendar size={18} />;
            case 'attendance': return <AlertCircle size={18} />;
            case 'success': return <CheckCircle size={18} />;
            default: return <Info size={18} />;
        }
    }

    function getThemeColor(type) {
        switch (type) {
            case 'schedule': return '#3b82f6';
            case 'attendance': return '#f59e0b';
            case 'success': return '#10b981';
            default: return 'var(--color-primary)';
        }
    }

    const filteredNotifications = tab === 'unread'
        ? notifications.filter((n) => !n.isRead)
        : notifications;

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-8)' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Communication Hub</div>
                    </div>
                    <h1 className="page-title" style={{ fontSize: '32px', fontWeight: 900 }}>Notifications</h1>
                    <p className="page-subtitle" style={{ color: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                        {unreadCount > 0 ? `${unreadCount} Pending Signals` : 'System Synchronized: All clear'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-primary" onClick={markAllRead} style={{ padding: '0 24px', height: '44px', fontWeight: 900, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)' }}>
                        <Check size={16} /> CLEAR ALL
                    </button>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '6px', marginBottom: 'var(--space-8)', display: 'inline-flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)' }}>
                <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 800 }}>
                    Chronicle ({notifications.length})
                </button>
                <button className={`tab ${tab === 'unread' ? 'active' : ''}`} onClick={() => setTab('unread')} style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 800 }}>
                    Critical {unreadCount > 0 && <span className="badge badge-red" style={{ marginLeft: '8px', fontSize: '10px' }}>{unreadCount}</span>}
                </button>
            </div>

            {filteredNotifications.length === 0 ? (
                <div className="glass-card" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bell size={40} opacity={0.3} />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900 }}>Signal Silence</h3>
                    <p style={{ color: 'var(--color-text-muted)', maxWidth: '340px', margin: '8px auto', fontWeight: 500 }}>No telemetry or event triggers found in this frequency segment.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredNotifications.map((notif, i) => {
                        const accent = getThemeColor(notif.type);
                        const timeAgo = notif.createdAt?.toDate
                            ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })
                            : 'recently';
                        return (
                            <div
                                key={notif.id}
                                className={`glass-panel hover-lift animate-fade-in-up ${!notif.isRead ? 'unread' : ''}`}
                                onClick={() => !notif.isRead && markAsRead(notif.id)}
                                style={{ 
                                    padding: '24px', 
                                    display: 'flex', 
                                    gap: '24px', 
                                    cursor: notif.isRead ? 'default' : 'pointer',
                                    borderLeft: `5px solid ${notif.isRead ? 'transparent' : accent}`,
                                    background: notif.isRead ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                                    animationDelay: `${i * 0.05}s`
                                }}
                            >
                                <div style={{ 
                                    width: '48px', height: '48px', borderRadius: '14px', 
                                    background: `${accent}15`, color: accent,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {getIcon(notif.type)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                        <div style={{ fontWeight: 800, fontSize: '16px', color: notif.isRead ? 'var(--color-text-primary)' : accent }}>
                                            {notif.title}
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {timeAgo}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6, fontWeight: 500 }}>
                                        {notif.message}
                                    </div>
                                    {!notif.isRead && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: accent, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}>
                                            <Sparkles size={12} /> New Transmission
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
