'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Store } from 'lucide-react';

export default function OfflinePage() {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-reload after a short delay when connection is restored
            setTimeout(() => window.location.reload(), 1500);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-emerald-50 flex flex-col items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-xl p-10 max-w-sm w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                        <WifiOff className="w-10 h-10 text-slate-400" />
                    </div>
                </div>

                {/* Branding */}
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <Store className="w-5 h-5" />
                    <span className="font-black text-sm uppercase tracking-widest">POS Bangunan</span>
                </div>

                {/* Message */}
                <div>
                    <h1 className="text-2xl font-black text-gray-800 mb-2">Sedang Offline</h1>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Tidak ada koneksi internet. Halaman yang sudah pernah dibuka sebelumnya
                        tetap bisa diakses secara offline.
                    </p>
                </div>

                {isOnline ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-700 text-sm font-medium">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Koneksi pulih! Memuat ulang...
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-400">
                            Aplikasi akan otomatis melanjutkan saat internet tersedia kembali.
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                        >
                            ← Kembali
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 border border-gray-200 hover:bg-slate-50 text-gray-600 font-medium rounded-xl transition-colors text-sm"
                        >
                            Coba Muat Ulang
                        </button>
                    </div>
                )}
            </div>

            <p className="mt-8 text-xs text-gray-400 text-center">
                Data transaksi tersimpan lokal dan akan tersinkronisasi otomatis saat online.
            </p>
        </div>
    );
}
