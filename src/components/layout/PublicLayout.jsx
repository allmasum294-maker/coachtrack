import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayout() {
    return (
        <div style={{ background: 'var(--color-bg-primary)', minHeight: '100vh' }}>
            <Navbar />
            <main>
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
