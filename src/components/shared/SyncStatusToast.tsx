'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useSyncStatusStore } from '@/store/syncStatusStore';

export function SyncStatusToast() {
    const { lastError, lastErrorAt, clearError } = useSyncStatusStore();

    if (!lastError) return null;

    const timeLabel = lastErrorAt
        ? new Date(lastErrorAt).toLocaleString('id-ID')
        : '';

    return (
        <div className="fixed bottom-4 right-4 z-[60] w-[92vw] max-w-md">
            <div className="flex gap-3 items-start rounded-xl border border-red-200 bg-red-50 shadow-lg px-4 py-3">
                <div className="mt-0.5 shrink-0 rounded-lg bg-red-100 p-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">Sinkronisasi gagal</p>
                    <p className="text-xs text-red-700 break-words">{lastError}</p>
                    {timeLabel && (
                        <p className="text-[10px] text-red-500 mt-1">Terjadi: {timeLabel}</p>
                    )}
                </div>
                <button
                    onClick={clearError}
                    className="text-red-500 hover:text-red-700 p-1 rounded-md"
                    aria-label="Tutup"
                    title="Tutup"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
