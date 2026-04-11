import { Shield, Lock, Eye, FileText, Info } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="support-page" style={{ padding: '160px 24px 100px', maxWidth: '800px', margin: '0 auto', color: 'var(--color-text-primary)' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em' }}>Privacy Policy</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '18px', marginBottom: '48px', fontWeight: 600 }}>Last updated: {new Date().toLocaleDateString()}</p>

            <div style={{ display: 'grid', gap: '32px' }}>
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', borderRadius: '8px' }}><Shield size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Information Collection</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        We collect only the most essential information needed to provide you with the best coaching management experience. This includes your email address, display name, and any data relevant to your teaching (batches, students, attendance).
                    </p>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px' }}><Lock size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Data Protection</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        Security is our top priority. We use Supabase and PostgreSQL to store your data with enterprise-grade encryption. Your personal information and student records are never shared with third parties.
                    </p>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-gold)', borderRadius: '8px' }}><Eye size={20} /></div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Your Rights</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '16px' }}>
                        You have full control over your data. You can delete your records or exports your data at any time from the settings or export panel. We follow a "privacy by design" approach.
                    </p>
                </section>

                <div style={{ 
                    marginTop: '40px', 
                    padding: '32px', 
                    background: 'var(--color-bg-secondary)', 
                    borderRadius: '24px', 
                    border: '1px solid var(--color-border)'
                }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <Info className="text-primary" />
                        <span style={{ fontWeight: 700 }}>Contact for Data Queries: coachtrack-support@example.com</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
