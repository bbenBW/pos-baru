import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Login - ERP Bangunan',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    // Simple layout without Sidebar or BottomNav
    return (
        <div className="min-h-screen bg-slate-50">
            {children}
        </div>
    );
}
