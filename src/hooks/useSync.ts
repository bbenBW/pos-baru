'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/lib/dexie';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useOffline } from './useOffline';
import { useProductStore } from '@/store/productStore';
import { useStoreProfileStore } from '@/store/storeProfileStore';
import { useCustomerStore } from '@/store/customerStore';
import { useSupplierStore } from '@/store/supplierStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBranchStore } from '@/store/branchStore';
import { useSyncStatusStore } from '@/store/syncStatusStore';
import { useAuthStore } from '@/store/authStore';
import { useShiftStore } from '@/store/shiftStore';

const dedupeSaleDetails = <T extends Record<string, any>>(details: T[]) => {
    const seen = new Set<string>();
    return details.filter((detail) => {
        const key = [
            detail.product_id,
            detail.unit_name,
            detail.unit_multiplier,
            detail.qty,
            detail.base_qty,
            detail.price_per_unit,
            detail.discount,
            detail.subtotal,
            detail.cogs_subtotal
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export function useSync() {
    const isOffline = useOffline();
    const [isSyncing, setIsSyncing] = useState(false);
    // Ref agar useCallback bisa punya empty deps tapi tetap baca value terbaru
    const isSyncingRef = useRef(false);
    const isOfflineRef = useRef(isOffline);
    useEffect(() => { isOfflineRef.current = isOffline; }, [isOffline]);

    const syncOfflineData = useCallback(async () => {
        if (isSyncingRef.current) return;
        if (isOfflineRef.current) return;

        const syncStatus = useSyncStatusStore.getState();
        const isUuid = (value?: string | null) =>
            !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        const sanitizeUuids = <T extends Record<string, any>>(payload: T, fields: Array<keyof T>) => {
            const safe: T = { ...payload };
            for (const f of fields) {
                const v = safe[f];
                if (v !== undefined && v !== null && !isUuid(v)) {
                    // MIGRATION: If it's the legacy main-branch ID, map it to the zero-uuid standard
                    if (v === 'main-branch') {
                        (safe as any)[f] = '00000000-0000-0000-0000-000000000000';
                    } else if (f === 'user_id') {
                        // User IDs like 'admin-1' are not UUIDs but we can't set them to null if it's a required field.
                        // For now, allow null but log it.
                        (safe as any)[f] = null;
                    } else {
                        (safe as any)[f] = null;
                    }
                }
            }
            return safe;
        };
        let hadError = false;

        const reportError = (context: string, err?: any) => {
            hadError = true;
            const message = err?.message ? `${context}: ${err.message}` : context;
            console.error(message, err);
            syncStatus.setError(message);
        };

        try {
            isSyncingRef.current = true;
            setIsSyncing(true);
            syncStatus.setSyncing(true);

            if (!supabaseConfigured) {
                reportError('Supabase belum dikonfigurasi (cek ENV di Vercel)');
                return;
            }

            const pendingSales = await db.sale_queue.where('status').equals('pending_sync').toArray();
            const pendingProductSync = await db.product_sync_queue.where('status').equals('pending_sync').toArray();

            // Refresh all stores and profile from cloud whenever sync is triggered, 
            // even if no pending sales, to ensure this device is up to date with others.
            if (!isOfflineRef.current) {
                console.log("Refreshing stores from cloud...");
                // --- EMERGENCY MIGRATION: Fix 'main-branch' records before push ---
                try {
                    const realBranches = await db.branches.toArray();
                    const realBranchId = realBranches.find(b => isUuid(b.id))?.id || realBranches[0]?.id;

                    if (realBranchId && isUuid(realBranchId)) {
                        // 1. Fix Sale Queue
                        const legacySales = await db.sale_queue.where('branch_id').equals('main-branch').toArray();
                        if (legacySales.length > 0) {
                            console.log(`Migrating ${legacySales.length} legacy sales to real branch: ${realBranchId}`);
                            for (const s of legacySales) {
                                await db.sale_queue.update(s.local_id!, { branch_id: realBranchId });
                            }
                        }
                        // 2. Fix Expense Queue
                        const legacyExpenses = await db.expenses.where('branch_id').equals('main-branch').toArray();
                        if (legacyExpenses.length > 0) {
                            for (const e of legacyExpenses) {
                                await db.expenses.update(e.id, { branch_id: realBranchId });
                            }
                        }
                    }
                } catch (migErr) { console.error("Migration failed", migErr); }

                try {
                    await useProductStore.getState().loadProducts({ silent: true });
                } catch (e) { console.error("Failed to refresh products", e); }

                try {
                    await useStoreProfileStore.getState().loadFromCloud();
                } catch (e) { console.error("Failed to refresh store profile", e); }

                try {
                    await useCustomerStore.getState().loadCustomers();
                } catch (e) { console.error("Failed to refresh customers", e); }

                try {
                    await useSupplierStore.getState().loadSuppliers({ silent: true });
                } catch (e) { console.error("Failed to refresh suppliers", e); }

                try {
                    await useExpenseStore.getState().loadExpenses(useBranchStore.getState().activeBranch?.id, { silent: true });
                } catch (e) { console.error("Failed to refresh expenses", e); }

                try {
                    await useBranchStore.getState().loadBranches();
                } catch (e) { console.error("Failed to refresh branches", e); }

                try {
                    const user = useAuthStore.getState().user;
                    const activeBranchId = useBranchStore.getState().activeBranch?.id;
                    if (user && activeBranchId) {
                        await useShiftStore.getState().loadActiveShift(user.id, activeBranchId);
                    }
                } catch (e) { console.error("Failed to refresh shift status", e); }

                // --- EMERGENCY DEEP RECOVERY: Push EVERYTHING to ensure cloud is up to date ---
                // This handles cases where local data thinks it's already pushed but cloud doesn't have it.
                if (!isOfflineRef.current) {
                    // 1. Recover Branches
                    const localBranches = await db.branches.toArray();
                    const { data: remoteBranches, error: bError } = await supabase.from('branches').select('id');
                    if (!bError && remoteBranches && remoteBranches.length === 0 && localBranches.length > 0) {
                        console.log("Recovery: Pushing local branches to cloud...");
                        await supabase.from('branches').upsert(localBranches);
                    }

                    // 2. Recover Products
                    const localProducts = await db.products.toArray();
                    const { data: remoteProducts, error: pError } = await supabase.from('products').select('id');
                    if (!pError && remoteProducts && remoteProducts.length === 0 && localProducts.length > 0) {
                        console.log(`Recovery: Pushing ${localProducts.length} local products...`);
                        for (let i = 0; i < localProducts.length; i += 100) {
                            await supabase.from('products').upsert(localProducts.slice(i, i + 100));
                        }
                    }

                    // 3. Recover Inventory Movements (ONLY if cloud is completely empty)
                    const { data: remoteMovementsExist, error: mError } = await supabase.from('inventory_movements').select('id').limit(1);

                    if (!mError && remoteMovementsExist && remoteMovementsExist.length === 0) {
                        const localMovements = await db.inventory_movements.toArray();
                        if (localMovements.length > 0) {
                            console.log(`Recovery: Migration Mode - Pushing ${localMovements.length} movements to cloud...`);
                            for (const m of localMovements) {
                                const { status, ...movementPayload } = m;
                                const safePayload = sanitizeUuids(movementPayload as any, ['user_id', 'branch_id', 'product_id', 'supplier_id']);
                                await supabase.from('inventory_movements').upsert([safePayload]);
                            }
                        }
                    }
                }
            }

            if (pendingProductSync.length > 0) {
                console.log(`Syncing ${pendingProductSync.length} pending product changes...`);
                for (const item of pendingProductSync) {
                    try {
                        if (item.action === 'delete') {
                            const { error: deleteConvError } = await supabase.from('unit_conversions').delete().eq('product_id', item.product_id);
                            if (deleteConvError) throw deleteConvError;
                            const { error: deleteProductError } = await supabase.from('products').delete().eq('id', item.product_id);
                            if (deleteProductError) throw deleteProductError;
                        } else {
                            if (!item.product_payload) throw new Error('Payload produk kosong');
                            const base64 = item.product_payload.base64_offline || null;
                            const isTooLarge = base64 && base64.length > 200000; // > 200KB limit for cloud sync

                            const safeProduct = {
                                ...item.product_payload,
                                category_id: isUuid(item.product_payload.category_id) ? item.product_payload.category_id : null,
                                branch_id: isUuid(item.product_payload.branch_id) ? item.product_payload.branch_id : null,
                                image_url: item.product_payload.image_url || null,
                                base64_offline: isTooLarge ? null : base64,
                            };

                            if (isTooLarge) {
                                console.warn(`Payload foto produk ${item.product_id} terlalu besar (${Math.round(base64.length / 1024)}KB). Menyinkronkan data tanpa foto untuk menghindari timeout.`);
                            }

                            const { error: productError } = await supabase.from('products').upsert([safeProduct], { onConflict: 'id' });
                            if (productError) throw productError;

                            const { error: deleteConvError } = await supabase.from('unit_conversions').delete().eq('product_id', item.product_id);
                            if (deleteConvError) throw deleteConvError;

                            const conversions = item.conversions_payload || [];
                            if (conversions.length > 0) {
                                const { error: insertConvError } = await supabase.from('unit_conversions').insert(conversions);
                                if (insertConvError) throw insertConvError;
                            }
                        }

                        await db.product_sync_queue.delete(item.id);
                    } catch (productSyncErr) {
                        await db.product_sync_queue.update(item.id, {
                            status: 'pending_sync',
                            updated_at: new Date().toISOString(),
                            last_error: productSyncErr instanceof Error ? productSyncErr.message : String(productSyncErr)
                        });
                        reportError(`Gagal sync produk ${item.product_id}`, productSyncErr);
                    }
                }
            }

            if (pendingSales.length === 0) {
                const pendingMovements = await db.inventory_movements.where('status').equals('pending_sync').toArray();
                const pendingProductsLeft = await db.product_sync_queue.where('status').equals('pending_sync').count();
                if (pendingMovements.length === 0 && pendingProductsLeft === 0) {
                    console.log("No pending items found. Sync finished.");
                    return;
                }
            }

            console.log(`Found ${pendingSales.length} pending transactions to sync...`);

            // --- Sync Sales ---
            for (const sale of pendingSales) {
                try {
                    // Prepare Sale payload for Supabase - ONLY send standard columns
                    const { details, local_id, status, payment_breakdown, ...rest } = sale;
                    const safeSale = sanitizeUuids(rest, ['user_id', 'customer_id', 'branch_id', 'voided_by']);

                    // 1. Insert into Sales (upsert to avoid duplicate receipt_number)
                    const { data: insertedSale, error: saleError } = await supabase
                        .from('sales')
                        .upsert([safeSale], { onConflict: 'receipt_number' })
                        .select()
                        .single();

                    if (saleError) {
                        reportError(`Gagal sync header transaksi ${sale.receipt_number}`, saleError);
                        continue;
                    }

                    // 2. Insert into Sale Details - Clean up underscores
                    const saleDetailsPayload = dedupeSaleDetails(details.map(d => {
                        const { _productName, ...cleanDetail } = d as any;
                        return {
                            ...cleanDetail,
                            sale_id: insertedSale.id
                        };
                    }));

                    const { error: deleteDetailsError } = await supabase.from('sale_details').delete().eq('sale_id', insertedSale.id);
                    if (deleteDetailsError) {
                        reportError(`Gagal bersihkan detail lama ${sale.receipt_number}`, deleteDetailsError);
                        continue;
                    }
                    const { error: detailsError } = await supabase
                        .from('sale_details')
                        .insert(saleDetailsPayload);

                    if (detailsError) {
                        reportError(`Gagal sync detail transaksi ${sale.receipt_number}`, detailsError);
                        continue;
                    }

                    await db.sale_queue.update(local_id!, { status: 'completed' as const });
                    console.log(`Synced receipt ${sale.receipt_number} successfully.`);
                } catch (saleLoopErr) {
                    reportError(`Kritis: Error di antrean struk ${sale.receipt_number}`, saleLoopErr);
                }
            }

            // --- Sync Inventory Movements ---
            try {
                const pendingMovements = await db.inventory_movements.where('status').equals('pending_sync').toArray();
                if (pendingMovements.length > 0) {
                    console.log(`Syncing ${pendingMovements.length} pending stock movements...`);
                    for (const movement of pendingMovements) {
                        const { status, ...movementPayload } = movement;
                        // Added product_id and supplier_id to sanitization for extra safety
                        const safeMovementPayload = sanitizeUuids(movementPayload as any, ['user_id', 'branch_id', 'product_id', 'supplier_id']);
                        const { error } = await supabase
                            .from('inventory_movements')
                            .upsert([{
                                ...safeMovementPayload,
                                status: 'completed'
                            }], { onConflict: 'id' });

                        if (!error) {
                            const product = await db.products.get(movement.product_id);
                            if (product) {
                                // Sync current stock to cloud to keep it consistent
                                await supabase.from('products').update({
                                    current_stock: product.current_stock,
                                    updated_at: new Date().toISOString()
                                }).eq('id', product.id);
                            }
                            await db.inventory_movements.update(movement.id, { status: 'completed' });
                        } else {
                            console.error(`Gagal sync movement ${movement.id}:`, error);
                            reportError(`Gagal sync pergerakan stok`, error);
                        }
                    }
                }
            } catch (movementErr) {
                reportError('Gagal sinkronisasi data pergerakan stok', movementErr);
            }

            // --- Sync Receivable Payments ---
            try {
                const pendingReceivablePayments = await db.receivables_payments.where('status').equals('pending_sync').toArray();
                if (pendingReceivablePayments.length > 0) {
                    console.log(`Syncing ${pendingReceivablePayments.length} pending receivable payments...`);
                    for (const payment of pendingReceivablePayments) {
                        const payload = sanitizeUuids({
                            id: payment.id,
                            customer_id: payment.customer_id,
                            branch_id: payment.branch_id,
                            user_id: payment.user_id,
                            amount: payment.amount,
                            payment_method: payment.payment_method,
                            notes: payment.notes,
                            created_at: payment.created_at,
                        }, ['customer_id', 'branch_id', 'user_id']);

                        const { error } = await supabase
                            .from('receivables_payments')
                            .upsert([payload], { onConflict: 'id' });

                        if (!error) {
                            const customer = await db.customers.get(payment.customer_id);
                            if (customer) {
                                await supabase.from('customers').update({
                                    debt_balance: customer.debt_balance,
                                    updated_at: customer.updated_at || new Date().toISOString()
                                }).eq('id', customer.id);
                            }
                            await db.receivables_payments.update(payment.id, { status: 'completed' });
                        } else {
                            reportError('Gagal sync pembayaran kasbon', error);
                        }
                    }
                }
            } catch (receivableErr) {
                reportError('Gagal sinkronisasi pembayaran kasbon', receivableErr);
            }

            // --- Sync Expenses ---
            try {
                const pendingExpenses = await db.expenses.where('status').equals('pending_sync').toArray();
                if (pendingExpenses.length > 0) {
                    console.log(`Syncing ${pendingExpenses.length} pending expenses...`);
                    for (const expense of pendingExpenses) {
                        const { status, ...expensePayload } = expense;
                        const safePayload = sanitizeUuids(expensePayload as any, ['user_id', 'branch_id']);
                        const { error } = await supabase
                            .from('expenses')
                            .upsert([{
                                ...safePayload,
                                status: 'completed'
                            }], { onConflict: 'id' });

                        if (!error) {
                            await db.expenses.update(expense.id, { status: 'completed' });
                        } else {
                            reportError(`Gagal sync pengeluaran ${expense.id}`, error);
                        }
                    }
                }
            } catch (expenseErr) {
                reportError('Gagal sinkronisasi data pengeluaran', expenseErr);
            }

            // --- Sync Cash Shifts ---
            try {
                const pendingShifts = await db.cash_shifts.where('status').equals('pending_sync').toArray();
                if (pendingShifts.length > 0) {
                    console.log(`Syncing ${pendingShifts.length} pending shift records...`);
                    for (const shift of pendingShifts) {
                        const payload = sanitizeUuids({
                            ...shift,
                            branch_id: shift.branch_id,
                            user_id: shift.user_id,
                        }, ['branch_id', 'user_id']);

                        const { error } = await supabase
                            .from('cash_shifts')
                            .upsert([payload], { onConflict: 'id' });

                        if (!error) {
                            await db.cash_shifts.update(shift.id, { status: 'closed' });
                        } else {
                            reportError('Gagal sinkronisasi histori shift', error);
                        }
                    }
                }
            } catch (shiftErr) {
                reportError('Gagal sinkronisasi histori shift kasir', shiftErr);
            }

            console.log("Sync sequence finished.");
        } catch (error) {
            reportError("Critical sync error", error);
        } finally {
            if (!hadError) {
                syncStatus.markSuccess();
            }
            syncStatus.setSyncing(false);
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Autostart sync on mount and online status change
    useEffect(() => {
        if (!isOffline) {
            syncOfflineData();
        }
    }, [isOffline, syncOfflineData]);

    // Real-time listener for shift status changes
    useEffect(() => {
        if (!supabaseConfigured || isOffline) return;

        const channel = supabase
            .channel('realtime:cash_shifts')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'cash_shifts'
            }, () => {
                const user = useAuthStore.getState().user;
                const activeBranchId = useBranchStore.getState().activeBranch?.id;
                if (user && activeBranchId) {
                    console.log("Real-time shift update detected. Reloading...");
                    useShiftStore.getState().loadActiveShift(user.id, activeBranchId);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOffline]);

    return { isSyncing, syncOfflineData };
}
