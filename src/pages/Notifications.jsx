import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Bell, CheckCircle, AlertCircle, Calendar, Info, Settings, Check } from 'lucide-react';
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
            console.error('Error:', err);
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
            console.error('Error:', err);
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
            console.error('Error:', err);
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

    function getIconColor(type) {
        switch (type) {
            case 'schedule': return { bg: 'var(--color-info-soft)', color: 'var(--color-info)' };
            case 'attendance': return { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)' };
            case 'success': return { bg: 'var(--color-success-soft)', color: 'var(--color-success)' };
            default: return { bg: 'var(--color-accent-soft)', color: 'var(--color-accent)' };
        }
    }

    const filteredNotifications = tab === 'unread'
        ? notifications.filter((n) => !n.isRead)
        : notifications;

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notifications</h1>
                    <p className="page-subtitle">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-secondary" onClick={markAllRead}>
                        <Check size={16} /> Mark All Read
                    </button>
                )}
            </div>

            <div className="tabs">
                <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
                    All ({notifications.length})
                </button>
                <button className={`tab ${tab === 'unread' ? 'active' : ''}`} onClick={() => setTab('unread')}>
                    Unread ({unreadCount})
                </button>
            </div>

            {filteredNotifications.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Bell size={48} className="empty-state-icon" />
                        <div className="empty-state-title">
                            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                        </div>
                        <div className="empty-state-text">
                            Notifications about your classes, attendance, and schedules will appear here.
                        </div>
                    </div>
                </div>
            ) : (
                <div className="notification-list">
                    {filteredNotifications.map((notif) => {
                        const iconStyle = getIconColor(notif.type);
                        const timeAgo = notif.createdAt?.toDate
                            ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })
                            : 'recently';
                        return (
                            <div
                                key={notif.id}
                                className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                                onClick={() => !notif.isRead && markAsRead(notif.id)}
                            >
                                <div className="notification-item-icon" style={{ background: iconStyle.bg, color: iconStyle.color }}>
                                    {getIcon(notif.type)}
                                </div>
                                <div className="notification-item-content">
                                    <div className="notification-item-title">{notif.title}</div>
                                    <div className="notification-item-text">{notif.message}</div>
                                    <div className="notification-item-time">{timeAgo}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
