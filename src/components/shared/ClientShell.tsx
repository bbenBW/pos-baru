'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useSync } from '@/hooks/useSync';
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

export function ClientShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname?.startsWith('/login');
    const { syncOfflineData } = useSync();
    const hasHydrated = useAuthStore(state => state.hasHydrated);
    useRealtimeProducts();

    // Apply persisted font scale on mount
    useEffect(() => {
        const stored = localStorage.getItem('pos_font_scale');
        if (stored) {
            document.documentElement.style.fontSize = `${stored}%`;
        }
    }, []);

    // Jalankan auto-sync di latar belakang (syncOfflineData stabil, tidak akan retrigger saat navigasi)
    useEffect(() => {
        if (!isAuthPage) {
            syncOfflineData();
            const interval = setInterval(() => {
                syncOfflineData();
            }, 60000);

            const handleFocusSync = () => {
                syncOfflineData();
            };

            const handleDataChangeSync = () => {
                syncOfflineData();
            };

            const handleVisibilitySync = () => {
                if (document.visibilityState === 'visible') {
                    syncOfflineData();
                }
            };

            window.addEventListener('focus', handleFocusSync);
            window.addEventListener('expenses-changed', handleDataChangeSync);
            window.addEventListener('sales-changed', handleDataChangeSync);
            window.addEventListener('trigger-sync', handleDataChangeSync);
            document.addEventListener('visibilitychange', handleVisibilitySync);

            return () => {
                clearInterval(interval);
                window.removeEventListener('focus', handleFocusSync);
                window.removeEventListener('expenses-changed', handleDataChangeSync);
                window.removeEventListener('sales-changed', handleDataChangeSync);
                window.removeEventListener('trigger-sync', handleDataChangeSync);
                document.removeEventListener('visibilitychange', handleVisibilitySync);
            };
        }
    }, [isAuthPage, syncOfflineData]);

    if (isAuthPage) {
        return <main className="flex-1 w-full">{children}</main>;
    }

    if (!hasHydrated) {
        return <main className="flex-1 w-full h-full bg-slate-50" />;
    }

    return (
        <div className="fixed inset-0 flex bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className={`flex-1 w-full min-w-0 flex flex-col pt-4 data-[offline=true]:pt-12 pb-3 h-full overflow-y-auto overscroll-y-contain pointer-events-auto`} style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="w-full px-2 md:px-4 h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
