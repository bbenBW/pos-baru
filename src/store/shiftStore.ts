import { create } from 'zustand';
import { db, OfflineCashShift } from '@/lib/dexie';
import { supabase, supabaseConfigured } from '@/lib/supabase';

interface ShiftState {
    activeShift: OfflineCashShift | null;
    loading: boolean;
    loadActiveShift: (userId: string, branchId?: string) => Promise<void>;
    openShift: (userId: string, openingCash: number, branchId?: string, deviceId?: string, deviceName?: string, userRole?: string | null, userName?: string | null) => Promise<void>;
    closeShift: (actualCash: number, expectedCash: number, difference: number, notes: string, cashDeposited?: number, cashKept?: number) => Promise<void>;
    adjustShiftCash: (amount: number, note: string) => Promise<void>;
}

const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const syncShiftToCloud = async (shift: OfflineCashShift) => {
    if (!navigator.onLine || !supabaseConfigured) return;

    const sanitizeBranchId = (id?: string | null) => {
        if (!id || id === 'main-branch' || id === '00000000-0000-0000-0000-000000000000')
            return '00000000-0000-0000-0000-000000000000';
        return isUuid(id) ? id : null;
    };

    const payload = {
        ...shift,
        branch_id: sanitizeBranchId(shift.branch_id),
        user_id: isUuid(shift.user_id) ? shift.user_id : null,
        user_role: shift.user_role || null,
        user_name: shift.user_name || null,
        device_id: shift.device_id || null,
        device_name: shift.device_name || null,
    };

    const { error } = await supabase
        .from('cash_shifts')
        .upsert([payload], { onConflict: 'id' });

    if (error) {
        console.warn('Gagal sync histori shift ke cloud:', error.message);
    }
};

export const useShiftStore = create<ShiftState>((set, get) => ({
    activeShift: null,
    loading: true,

    loadActiveShift: async (_userId, branchId) => {
        // Only show loading if we don't have data yet to prevent "preparing" flash during polling
        if (!get().activeShift) set({ loading: true });
        try {
            // 1. Ambil semua data shift lokal yang belum tuntas (open atau pending sync)
            const localShifts = await db.cash_shifts.where('status').anyOf(['open', 'pending_sync']).toArray();
            localShifts.sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime());

            let currentShift = localShifts.length > 0 ? localShifts[0] : null;

            // 2. Ambil data shift dari Cloud untuk verifikasi status terbaru
            if (navigator.onLine && supabaseConfigured && branchId) {
                const branchFilter = (branchId === 'main-branch' || branchId === '00000000-0000-0000-0000-000000000000')
                    ? 'branch_id.is.null,branch_id.eq.00000000-0000-0000-0000-000000000000'
                    : `branch_id.eq.${branchId}`;

                const { data: cloudShifts, error: cloudError } = await supabase
                    .from('cash_shifts')
                    .select('*')
                    .eq('status', 'open')
                    .or(branchFilter)
                    .order('opening_time', { ascending: false });

                if (!cloudError && cloudShifts && cloudShifts.length > 0) {
                    const latestCloud = cloudShifts[0] as OfflineCashShift;
                    const exactLocalMatch = await db.cash_shifts.get(latestCloud.id);

                    // ZOMBIE CHECK: Hanya blokir jika ID yang sama persis sedang dalam status pending_sync di lokal
                    if (exactLocalMatch && exactLocalMatch.status === 'pending_sync' && currentShift?.id !== latestCloud.id) {
                        console.log("Blocking zombie shift re-open: Cloud is stale for THIS ID.");
                        currentShift = null;
                    } else {
                        // Selalu perbarui salinan lokal dengan versi cloud terbaru agar adjustment/shared drawer tersinkron antar-device.
                        await db.cash_shifts.put({
                            ...(exactLocalMatch || {}),
                            ...latestCloud,
                        });
                        currentShift = {
                            ...(exactLocalMatch || {}),
                            ...latestCloud,
                        } as OfflineCashShift;
                    }
                }
                // Jika di awan TIDAK ADA shift open, tapi di lokal masih ada yang statusnya 'open'
                else if (!cloudError && currentShift && currentShift.status === 'open') {
                    const { data: verifyCloud, error: verifyError } = await supabase
                        .from('cash_shifts')
                        .select('status')
                        .eq('id', currentShift.id)
                        .maybeSingle();

                    if (!verifyError && verifyCloud && verifyCloud.status === 'closed') {
                        await db.cash_shifts.update(currentShift.id, { status: 'closed' });
                        currentShift = null;
                    }
                }
            }

            set({ activeShift: currentShift?.status === 'open' ? currentShift : null });
        } catch (error) {
            console.error('Error loading shift:', error);
        } finally {
            set({ loading: false });
        }
    },

    openShift: async (userId, openingCash, branchId, deviceId, deviceName, userRole, userName) => {
        const sanitizeBranchId = (id?: string | null) => {
            if (!id || id === 'main-branch' || id === '00000000-0000-0000-0000-000000000000') {
                return '00000000-0000-0000-0000-000000000000';
            }
            return id;
        };

        const targetBranchId = sanitizeBranchId(branchId);

        const existingLocal = (await db.cash_shifts.where('status').equals('open').toArray())
            .filter(shift => sanitizeBranchId(shift.branch_id) === targetBranchId)
            .sort((a, b) => new Date(b.opening_time).getTime() - new Date(a.opening_time).getTime())[0];

        if (existingLocal) {
            set({ activeShift: existingLocal, loading: false });
            return;
        }

        if (navigator.onLine && supabaseConfigured) {
            const branchFilter = targetBranchId === '00000000-0000-0000-0000-000000000000'
                ? 'branch_id.is.null,branch_id.eq.00000000-0000-0000-0000-000000000000'
                : `branch_id.eq.${targetBranchId}`;

            const { data: cloudShift, error: cloudError } = await supabase
                .from('cash_shifts')
                .select('*')
                .eq('status', 'open')
                .or(branchFilter)
                .order('opening_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!cloudError && cloudShift) {
                await db.cash_shifts.put(cloudShift as OfflineCashShift);
                set({ activeShift: cloudShift as OfflineCashShift, loading: false });
                return;
            }
        }

        const newShift: OfflineCashShift = {
            id: crypto.randomUUID(),
            user_id: userId,
            user_role: userRole || undefined,
            user_name: userName || undefined,
            branch_id: targetBranchId,
            device_id: deviceId,
            device_name: deviceName,
            opening_time: new Date().toISOString(),
            opening_cash: openingCash,
            status: 'open',
        };
        await db.cash_shifts.put(newShift);
        set({ activeShift: newShift, loading: false });
        await syncShiftToCloud(newShift);
    },

    closeShift: async (actualCash, expectedCash, difference, notes, cashDeposited, cashKept) => {
        const { activeShift } = get();
        if (!activeShift) return;

        const updatedShift = {
            ...activeShift,
            closing_time: new Date().toISOString(),
            expected_closing_cash: expectedCash,
            actual_closing_cash: actualCash,
            difference,
            notes,
            cash_deposited: cashDeposited,
            cash_kept: cashKept,
            status: 'pending_sync' as const // Use pending_sync to ensure useSync picks it up if manual push fails
        };

        await db.cash_shifts.update(activeShift.id, updatedShift);
        set({ activeShift: null });

        // Try manual push immediately for better UX
        try {
            await syncShiftToCloud(updatedShift);
        } catch (e) {
            console.warn("Manual shift sync failed, will retry in background.", e);
        }
    },

    adjustShiftCash: async (amount, note) => {
        const { activeShift } = get();
        if (!activeShift) return;

        const adj = {
            amount,
            time: new Date().toISOString(),
            note
        };

        const updatedShift = {
            ...activeShift,
            adjustments: [...(activeShift.adjustments || []), adj]
        };

        await db.cash_shifts.update(activeShift.id, updatedShift);
        set({ activeShift: updatedShift });
        await syncShiftToCloud(updatedShift);
    },
}));
