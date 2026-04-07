'use client';

import { useState, useEffect } from 'react';
import { useShiftStore } from '@/store/shiftStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useSettingStore } from '@/store/settingStore';

export function ShiftModal() {
    const { activeShift, loading, loadActiveShift, openShift } = useShiftStore();
    const { user } = useAuthStore();
    const activeBranchId = useBranchStore(state => state.activeBranch?.id);
    const { settings } = useSettingStore();

    const [openingCash, setOpeningCash] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            loadActiveShift(user.id, activeBranchId);
        }
    }, [user, activeBranchId, loadActiveShift]);

    // Show loading overlay instead of null to prevent POS "flicker"
    if (loading || !user) {
        return (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Menyiapkan Kasir...</p>
                </div>
            </div>
        );
    }

    // Don't render modal if shift is already open
    if (activeShift) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        // Force minimum 0
        const amount = Math.max(0, parseFloat(openingCash) || 0);
        await openShift(user.id, amount, activeBranchId, settings.deviceId, settings.deviceName, user.role, user.name);
        setSubmitting(false);
    };

    return (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-primary p-6 text-white text-center">
                    <h2 className="text-2xl font-bold mb-1">Buka Kasir (Shift)</h2>
                    <p className="opacity-90 text-sm">Masukkan uang modal awal di dalam laci kasir.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Uang Modal Laci Awal (Rp)</label>
                        <input
                            type="number"
                            required
                            min="0"
                            placeholder="Contoh: 500000"
                            value={openingCash}
                            onChange={e => setOpeningCash(e.target.value)}
                            className="w-full text-2xl p-4 text-center rounded-xl border border-gray-300 focus:ring-4 focus:ring-emerald-100 focus:border-primary outline-none transition-all font-mono font-bold"
                            autoFocus
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800">
                        <p className="font-semibold mb-1">Kenapa ini wajib?</p>
                        <p className="opacity-90">Sistem perlu tahu hitungan uang riil di laci mesin Anda sebelum transaksi dimulai.</p>
                    </div>

                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-primary hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                        >
                            {submitting ? 'Menyimpan...' : 'Buka Kasir Sekarang'}
                        </button>

                        <a
                            href="/"
                            className="block w-full py-3 text-center text-gray-500 hover:text-primary font-bold text-sm transition-colors"
                        >
                            Nanti Saja, Lihat Laporan Dulu
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
