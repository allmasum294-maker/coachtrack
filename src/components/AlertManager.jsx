import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { scheduleService } from '../services/scheduleService';
import { supabase } from '../services/supabaseClient';
import { Bell, X, Calendar, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';

export default function AlertManager() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [upcomingAlerts, setUpcomingAlerts] = useState([]);
    const [showCancelModal, setShowCancelModal] = useState(null); // schedule object
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        if (!userProfile?.id) return;

        // Perform initial check
        checkAlerts();

        // Smart Interval: Check every 10 minutes
        const interval = setInterval(checkAlerts, 10 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, [userProfile]);

    async function checkAlerts() {
        if (!userProfile?.id) return;
        
        // 1. Sync upcoming classes to notifications table
        await notificationService.generateUpcomingClassAlerts(userProfile.id);
        
        // 2. Load latest alerts
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('teacher_id', userProfile.id)
            .eq('type', 'schedule_prompt')
            .eq('is_read', false)
            .order('created_at', { ascending: false });
        
        setUpcomingAlerts(data || []);
    }

    async function handleDismiss(id) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setUpcomingAlerts(prev => prev.filter(a => a.id !== id));
    }

    async function handleConfirmCancel() {
        if (!showCancelModal) return;
        try {
            setIsCancelling(true);
            const scheduleId = showCancelModal.id;
            
            // 1. Update schedule status
            await scheduleService.updateScheduleStatus(scheduleId, 'cancelled');
            
            // 2. Remove notifications
            await notificationService.deleteNotificationBySchedule(scheduleId);
            
            toast.success('Class has been cancelled.');
            setUpcomingAlerts(prev => prev.filter(a => a.schedule_id !== scheduleId));
            setShowCancelModal(null);
            
            // If we have a local Refresh event or signal, we could trigger it here
            // For now, simple success is enough.
        } catch (err) {
            console.error(err);
            toast.error('Failed to cancel class');
        } finally {
            setIsCancelling(false);
        }
    }

    if (upcomingAlerts.length === 0 && !showCancelModal) return null;

    return (
        <>
            {/* Actionable Prompt Overlay (Toast-like but persistent until acted upon) */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                maxWidth: '380px',
                width: 'calc(100% - 48px)'
            }}>
                {upcomingAlerts.map((alert) => (
                    <div key={alert.id} className="glass-panel animate-slide-up" style={{
                        padding: '16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                        borderRadius: '16px'
                    }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Clock size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '2px' }}>{alert.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.4, marginBottom: '12px' }}>
                                    {alert.message}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={() => {
                                            handleDismiss(alert.id);
                                            navigate('/schedule');
                                        }}
                                        style={{ fontSize: '11px', padding: '0 12px', height: '32px', flex: 1 }}
                                    >
                                        CHECK
                                    </button>
                                    <button 
                                        className="btn btn-ghost" 
                                        onClick={() => setShowCancelModal({ id: alert.schedule_id })}
                                        style={{ fontSize: '11px', padding: '0 12px', height: '32px', color: 'var(--color-danger)' }}
                                    >
                                        CANCEL
                                    </button>
                                    <button 
                                        className="btn-icon-sm" 
                                        onClick={() => handleDismiss(alert.id)}
                                        style={{ background: 'transparent' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal for Cancellation */}
            <Modal
                isOpen={!!showCancelModal}
                onClose={() => setShowCancelModal(null)}
                title="Cancel Session?"
                maxWidth="400px"
            >
                <div style={{ textAlign: 'center', padding: '12px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'var(--color-danger-soft)', color: 'var(--color-danger)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px'
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>Confirm Cancellation</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
                        Are you sure you want to cancel this class? This action will remove the reminder and update your calendar.
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCancelModal(null)} disabled={isCancelling}>
                            Back
                        </button>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleConfirmCancel} disabled={isCancelling}>
                            {isCancelling ? 'Cancelling...' : 'Yes, Cancel Class'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
