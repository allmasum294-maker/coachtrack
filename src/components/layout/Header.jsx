import { useAuth } from '../../context/AuthContext';
import { Bell } from 'lucide-react';
import { Menu } from 'lucide-react';

export default function Header({ title, subtitle }) {
    const { userProfile } = useAuth();

    return (
        <header className="app-header">
            <div className="header-left">
                <div>
                    {title && (
                        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                            {title}
                        </h2>
                    )}
                    {subtitle && (
                        <p
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            <div className="header-right">
                <button className="btn btn-ghost btn-icon" title="Notifications">
                    <Bell size={20} />
                </button>
            </div>
        </header>
    );
}
