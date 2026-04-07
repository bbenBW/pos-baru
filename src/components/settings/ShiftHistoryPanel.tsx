'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, OfflineCashShift, OfflineBranch } from '@/lib/dexie';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { AlertCircle, Clock3, ShieldCheck, Wallet, LockKeyhole, Loader2 } from 'lucide-react';
import { useBranchStore } from '@/store/branchStore';

type ShiftItem = OfflineCashShift;

const formatMoney = (value?: number | null) => `Rp ${(value || 0).toLocaleString('id-ID')}`;
const roleLabels: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    kasir: 'Kasir',
    gudang: 'Staff Gudang',
};

const inferRoleFromUserId = (userId?: string | null) => {
    if (!userId) return null;
    const normalized = userId.toLowerCase();
    if (normalized === '00000000-0000-0000-0000-000000000001') return 'Owner';
    if (normalized === '00000000-0000-0000-0000-000000000002') return 'Admin';
    if (normalized === '00000000-0000-0000-0000-000000000003') return 'Kasir';
    if (normalized === '00000000-0000-0000-0000-000000000004') return 'Staff Gudang';
    if (normalized.includes('owner')) return 'Owner';
    if (normalized.includes('admin')) return 'Admin';
    if (normalized.includes('kasir')) return 'Kasir';
    if (normalized.includes('gudang')) return 'Staff Gudang';
    return null;
};

const sameDay = (value?: string) => {
    if (!value) return false;
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

export function ShiftHistoryPanel() {
    const { branches } = useBranchStore();
    const [items, setItems] = useState<ShiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            let data: ShiftItem[] = [];

            const local = (await db.cash_shifts.toArray())
                .sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime());
            data = local as ShiftItem[];

            if (navigator.onLine && supabaseConfigured) {
                const { data: remote, error } = await supabase
                    .from('cash_shifts')
                    .select('*')
                    .order('opening_time', { ascending: false })
                    .limit(50);

                if (!error && remote) {
                    const merged = new Map<string, ShiftItem>();
                    [...local, ...(remote as ShiftItem[])].forEach(item => merged.set(item.id, item));
                    data = Array.from(merged.values()).sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime());
                }
            }

            setItems(data);
        } catch (error) {
            console.error('Gagal memuat histori shift:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleForceClose = async (shift: ShiftItem) => {
        const confirmMsg = `Peringatan: Anda akan menutup paksa shift untuk ${shift.user_name || 'Kasir'}.\n\n` +
            `Tindakan ini dilakukan jika kasir lupa menutup shift atau perangkat tidak bisa diakses.\n\n` +
            `Lanjutkan?`;

        if (!window.confirm(confirmMsg)) return;

        setProcessingId(shift.id);
        try {
            const closingTime = new Date().toISOString();
            const updatePayload = {
                status: 'closed' as const,
                closing_time: closingTime,
                notes: (shift.notes ? shift.notes + ' ' : '') + '[Ditutup Paksa oleh Owner]',
                // Set expected/actual to safe defaults if missing to close the cycle
                actual_closing_cash: shift.actual_closing_cash ?? shift.opening_cash,
                expected_closing_cash: shift.expected_closing_cash ?? shift.opening_cash,
                difference: shift.difference ?? 0
            };

            // 1. Update Supabase (Primary for Owner Remote Action)
            if (supabaseConfigured) {
                const { error: remoteError } = await supabase
                    .from('cash_shifts')
                    .update(updatePayload)
                    .eq('id', shift.id);

                if (remoteError) throw remoteError;
            }

            // 2. Update Local DB if exists (Secondary)
            await db.cash_shifts.update(shift.id, updatePayload);

            alert('Shift berhasil ditutup paksa.');
            await load(); // Reload list
        } catch (err: any) {
            console.error('Gagal tutup paksa shift:', err);
            alert('Gagal tutup paksa: ' + (err.message || String(err)));
        } finally {
            setProcessingId(null);
        }
    };

    const branchMap = useMemo(() => {
        const map = new Map<string, OfflineBranch>();
        branches.forEach(branch => map.set(branch.id, branch));
        return map;
    }, [branches]);

    const openCount = items.filter(item => item.status === 'open').length;
    const closedToday = items.filter(item => item.closing_time && sameDay(item.closing_time)).length;
    const discrepancyToday = items
        .filter(item => item.closing_time && sameDay(item.closing_time))
        .reduce((acc, item) => acc + (item.difference || 0), 0);

    return (
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        Monitor Shift Kasir
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Riwayat buka/tutup shift yang dipantau owner dan admin.</p>
                </div>
                <div className="text-xs rounded-full px-2.5 py-1 bg-indigo-50 text-indigo-700 font-semibold">
                    Owner / Admin
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-amber-50 p-4">
                    <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                        <Clock3 className="w-4 h-4" /> Shift Masih Buka
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">{openCount}</div>
                </div>
                <div className="rounded-xl border bg-emerald-50 p-4">
                    <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" /> Shift Ditutup Hari Ini
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{closedToday}</div>
                </div>
                <div className={`rounded-xl border p-4 ${discrepancyToday === 0 ? 'bg-slate-50' : discrepancyToday > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                    <div className={`text-xs font-semibold flex items-center gap-1 ${discrepancyToday === 0 ? 'text-slate-700' : discrepancyToday > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        <Wallet className="w-4 h-4" /> Total Selisih Hari Ini
                    </div>
                    <div className={`text-2xl font-black mt-2 ${discrepancyToday === 0 ? 'text-slate-700' : discrepancyToday > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {discrepancyToday > 0 ? '+' : ''}{formatMoney(discrepancyToday)}
                    </div>
                </div>
            </div>

            {openCount > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>Ada shift yang masih terbuka. Owner/admin bisa mengecek apakah kasir belum tutup shift atau aplikasi masih aktif di perangkat kasir.</div>
                </div>
            )}

            {loading ? (
                <p className="text-sm text-gray-500">Memuat histori shift...</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada histori shift.</p>
            ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                    {items.map(item => {
                        const branchName = item.branch_id ? branchMap.get(item.branch_id)?.name : null;
                        const operatorLabel =
                            item.user_name ||
                            (item.user_role ? roleLabels[item.user_role] || item.user_role : null) ||
                            inferRoleFromUserId(item.user_id) ||
                            'Perangkat lokal';
                        const statusLabel = item.status === 'open' ? 'Sedang Buka' : item.status === 'pending_sync' ? 'Menunggu Sinkron' : 'Selesai';
                        const statusClass =
                            item.status === 'open'
                                ? 'bg-amber-100 text-amber-800'
                                : item.status === 'pending_sync'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800';

                        return (
                            <div key={item.id} className="rounded-xl border p-4 space-y-3 bg-slate-50">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                    <div>
                                        <div className="font-semibold text-gray-800">
                                            {branchName || 'Semua Cabang'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                                            <div>Kasir: {operatorLabel}</div>
                                            <div>Perangkat: {item.device_name || item.device_id || 'Shift lama / belum diberi nama perangkat'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.status === 'open' && (
                                            <button
                                                onClick={() => handleForceClose(item)}
                                                disabled={processingId === item.id}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                {processingId === item.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <LockKeyhole className="w-3.5 h-3.5" />
                                                )}
                                                Tutup Paksa
                                            </button>
                                        )}
                                        <div className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                            {statusLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Buka Shift</div>
                                        <div className="font-semibold text-gray-800">{new Date(item.opening_time).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Tutup Shift</div>
                                        <div className="font-semibold text-gray-800">{item.closing_time ? new Date(item.closing_time).toLocaleString('id-ID') : 'Belum ditutup'}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Modal Awal</div>
                                        <div className="font-semibold text-gray-800">{formatMoney(item.opening_cash)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Estimasi Sistem</div>
                                        <div className="font-semibold text-gray-800">{formatMoney(item.expected_closing_cash)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Uang Fisik</div>
                                        <div className="font-semibold text-gray-800">{item.actual_closing_cash == null ? '-' : formatMoney(item.actual_closing_cash)}</div>
                                    </div>
                                    <div className="rounded-lg border bg-white px-3 py-2">
                                        <div className="text-gray-500 text-xs">Selisih</div>
                                        <div className={`font-semibold ${(item.difference || 0) === 0 ? 'text-gray-800' : (item.difference || 0) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                            {item.difference == null ? '-' : `${item.difference > 0 ? '+' : ''}${formatMoney(item.difference)}`}
                                        </div>
                                    </div>
                                </div>

                                {item.notes && (
                                    <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
                                        <span className="font-semibold text-gray-700">Catatan:</span> {item.notes}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
