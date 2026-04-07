'use client';

import { useSyncStatusStore } from '@/store/syncStatusStore';
import { Trash2 } from 'lucide-react';

export function SyncLogPanel() {
    const { history, clearHistory } = useSyncStatusStore();

    return (
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Log Sinkronisasi</h3>
                {history.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                        title="Hapus log"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                )}
            </div>
            {history.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada log sinkronisasi.</p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {history.map(entry => (
                        <div
                            key={entry.id}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                                entry.type === 'error'
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                        >
                            <div className="font-semibold">
                                {entry.type === 'error' ? 'Gagal' : 'Berhasil'}
                            </div>
                            <div className="break-words">{entry.message}</div>
                            <div className="text-[10px] opacity-70 mt-1">
                                {new Date(entry.at).toLocaleString('id-ID')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
