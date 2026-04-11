import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import { useState } from 'react';
import AuroraBackground from '../common/AuroraBackground';

export default function AppLayout() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="app-layout">
            <AuroraBackground />
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            
            <main className="app-main">
                <TopHeader onMenuClick={() => setMobileOpen(true)} />
                <div className="app-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
