import { FileText, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function Terms() {
    return (
        <div className="support-page" style={{ padding: '1600px 24px 100px', maxWidth: '800px', margin: '0 auto', color: 'var(--color-text-primary)' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em' }}>Terms of Service</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '18px', marginBottom: '48px', fontWeight: 600 }}>Effectve Date: {new Date().toLocaleDateString()}</p>

            <div style={{ display: 'grid', gap: '40px' }}>
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px' }}><CheckCircle size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Acceptance of Terms</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        By accessing and using CoachTrack, you agree to comply with and be bound by these terms. This platform is designed for educational management and should be used lawfully and ethically.
                    </p>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px' }}><ShieldAlert size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>User Responsibilities</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account. You are solely responsible for the content and accuracy of the data you input (student names, phone numbers, records).
                    </p>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-gold)', borderRadius: '8px' }}><AlertTriangle size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Limitation of Liability</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        CoachTrack is provided "as is" without any warranties. While we strive for 100% uptime and data integrity, we are not liable for any data loss, service interruptions, or indirect damages resulting from the use of the service.
                    </p>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px' }}><FileText size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Modification of Rules</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        We reserve the right to modify these terms at any time. Significant changes will be announced via the platform notifications or email. Your continued use of the service constitutes acceptance of the new terms.
                    </p>
                </section>
            </div>
        </div>
    );
}
