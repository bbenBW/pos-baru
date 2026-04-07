'use client';

import { useOffline } from '@/hooks/useOffline';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineIndicator() {
    const isOffline = useOffline();

    if (!isOffline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm">
            <WifiOff className="w-4 h-4" />
            <span>Anda sedang offline. Data akan disinkronkan otomatis saat koneksi kembali.</span>
        </div>
    );
}
