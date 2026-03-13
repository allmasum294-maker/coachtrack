import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';

export default function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar />
            <main className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <div className="app-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
