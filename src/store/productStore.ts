import { create } from 'zustand';
import { db, OfflineProduct, OfflineProductSyncQueue, OfflineUnitConversion } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useBranchStore } from '@/store/branchStore';
import { useSupplierStore } from '@/store/supplierStore';

export interface ProductState {
    products: OfflineProduct[];
    unitConversions: OfflineUnitConversion[];
    loading: boolean;
    lastSyncError: string | null;
    syncProgress: { current: number; total: number } | null;
    loadProducts: (options?: { silent?: boolean }) => Promise<void>;
    addProduct: (product: Omit<OfflineProduct, 'id'>, conversions: Omit<OfflineUnitConversion, 'id' | 'product_id'>[]) => Promise<void>;
    updateProduct: (id: string, product: Partial<Omit<OfflineProduct, 'id'>>, conversions: Omit<OfflineUnitConversion, 'id' | 'product_id'>[]) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    receiveStock: (productId: string, qtyAdded: number, notes: string, userId: string, priceUpdates?: { newBasePrice?: number; newSellPrice?: number; newSmallUnitPrice?: number }, options?: { supplier_id?: string; payment_status?: 'lunas' | 'tempo' }) => Promise<void>;
    updateStock: (productId: string, newStock: number) => void;
    deleteMovements: (ids: string[]) => Promise<void>;
}


const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const sanitizeProductForCloud = (product: OfflineProduct): OfflineProduct => ({
    ...product,
    category_id: isUuid(product.category_id) ? product.category_id : null,
    branch_id: isUuid(product.branch_id) ? product.branch_id : undefined,
    image_url: product.image_url || undefined,
    base64_offline: product.base64_offline || undefined,
});

const queueProductSync = async (
    productId: string,
    action: 'upsert' | 'delete',
    productPayload?: OfflineProduct,
    conversionsPayload: OfflineUnitConversion[] = [],
    lastError?: string
) => {
    const payload: OfflineProductSyncQueue = {
        id: productId,
        product_id: productId,
        action,
        product_payload: productPayload,
        conversions_payload: conversionsPayload,
        status: 'pending_sync',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: lastError,
    };
    await db.product_sync_queue.put(payload);
};

const syncSingleProductToCloud = async (
    productId: string,
    action: 'upsert' | 'delete',
    productPayload?: OfflineProduct,
    conversionsPayload: OfflineUnitConversion[] = []
) => {
    if (!navigator.onLine) return false;

    if (action === 'delete') {
        const { error: deleteConvError } = await supabase.from('unit_conversions').delete().eq('product_id', productId);
        if (deleteConvError) throw deleteConvError;
        const { error: deleteProductError } = await supabase.from('products').delete().eq('id', productId);
        if (deleteProductError) throw deleteProductError;
        await db.product_sync_queue.delete(productId);
        return true;
    }

    if (!productPayload) throw new Error('Payload produk kosong');

    const safeProduct = sanitizeProductForCloud(productPayload);
    const { error: upsertProductError } = await supabase.from('products').upsert([safeProduct], { onConflict: 'id' });
    if (upsertProductError) throw upsertProductError;

    const { error: deleteConvError } = await supabase.from('unit_conversions').delete().eq('product_id', productId);
    if (deleteConvError) throw deleteConvError;

    if (conversionsPayload.length > 0) {
        const { error: insertConvError } = await supabase.from('unit_conversions').insert(conversionsPayload);
        if (insertConvError) throw insertConvError;
    }

    await db.product_sync_queue.delete(productId);
    return true;
};

export const useProductStore = create<ProductState>((set, get) => ({
    products: [],
    unitConversions: [],
    loading: true,
    lastSyncError: null,
    syncProgress: null,

    loadProducts: async (options?: { silent?: boolean }) => {
        // silent=true  → auto background sync (Delta Sync, no progress bar)
        // silent=false → manual button press  (Full Sync, show progress bar)
        // silent=undefined → first load (Full Sync if DB empty, Delta otherwise)
        const manualSync = options?.silent === false;
        const isSilent = options?.silent ?? (get().products.length > 0);
        if (!isSilent) set({ loading: true });
        try {
            const sameProducts = (a: OfflineProduct[], b: OfflineProduct[]) => {
                if (a.length !== b.length) return false;
                const map = new Map(a.map(p => [p.id, p]));
                for (const p of b) {
                    const o = map.get(p.id);
                    if (!o) return false;
                    if (
                        o.name !== p.name ||
                        o.barcode !== p.barcode ||
                        o.category_id !== p.category_id ||
                        o.base_unit !== p.base_unit ||
                        o.base_price !== p.base_price ||
                        o.sell_price !== p.sell_price ||
                        o.current_stock !== p.current_stock ||
                        o.min_stock !== p.min_stock ||
                        o.branch_id !== p.branch_id ||
                        o.image_url !== p.image_url ||
                        o.updated_at !== p.updated_at ||
                        o.created_at !== p.created_at
                    ) {
                        return false;
                    }
                }
                return true;
            };

            const sameConversions = (a: OfflineUnitConversion[], b: OfflineUnitConversion[]) => {
                if (a.length !== b.length) return false;
                const map = new Map(a.map(c => [c.id, c]));
                for (const c of b) {
                    const o = map.get(c.id);
                    if (!o) return false;
                    if (
                        o.product_id !== c.product_id ||
                        o.unit_name !== c.unit_name ||
                        o.multiplier !== c.multiplier ||
                        o.price !== c.price
                    ) {
                        return false;
                    }
                }
                return true;
            };

            // First try to load from local IndexedDB for speed & offline
            const localProducts = await db.products.toArray();
            const localConversions = await db.unit_conversions.toArray();

            const currentProducts = get().products;
            const currentConversions = get().unitConversions;
            if (!sameProducts(currentProducts, localProducts) || !sameConversions(currentConversions, localConversions)) {
                set({ products: localProducts, unitConversions: localConversions });
            }

            // In production, sync from Supabase if online here
            if (navigator.onLine) {
                // Reset progress bar before starting
                set({ syncProgress: null, lastSyncError: null });

                // Determine sync strategy:
                // - manualSync (button pressed)  → ALWAYS full sync + show progress
                // - DB local empty               → ALWAYS full sync
                // - auto background sync         → Delta sync (only newer items)
                const isFullSync = manualSync || localProducts.length === 0;

                const latestProduct = await db.products.orderBy('updated_at').last();
                const lastUpdatedTime = latestProduct?.updated_at || '1970-01-01T00:00:00Z';

                set({ syncProgress: { current: 0, total: 1 } }); // Show "loading" indicator

                const CHUNK_SIZE = 20;
                let allDbProducts: OfflineProduct[] = [];
                let from = 0;
                let hasMore = true;

                while (hasMore) {
                    try {
                        let chunkQuery = supabase
                            .from('products')
                            .select('id, barcode, name, category_id, base_unit, base_price, sell_price, current_stock, min_stock, branch_id, image_url, updated_at, created_at')
                            .order('created_at', { ascending: true })
                            .range(from, from + CHUNK_SIZE - 1);

                        if (!isFullSync) {
                            chunkQuery = chunkQuery.gt('updated_at', lastUpdatedTime);
                        }

                        const { data: chunk, error: pError } = await chunkQuery;

                        if (pError) throw pError;

                        if (chunk && chunk.length > 0) {
                            allDbProducts = [...allDbProducts, ...chunk];
                            from += chunk.length;
                            // Update progress bar incrementally
                            set({ syncProgress: { current: from, total: Math.max(from + 1, from) } });
                            if (chunk.length < CHUNK_SIZE) hasMore = false;
                        } else {
                            hasMore = false;
                        }
                    } catch (pErr: any) {
                        const errMsg = pErr.message || String(pErr);
                        console.error("Failed to fetch products chunk:", errMsg);
                        set({ lastSyncError: `Gagal menarik data produk: ${errMsg}`, loading: false, syncProgress: null });
                        return;
                    }
                }

                console.log(`[Sync] isFullSync=${isFullSync}, fetched=${allDbProducts.length} products`);

                if (manualSync && allDbProducts.length === 0) {
                    // Fetched nothing - check if cloud is truly empty
                    const { data: testData, error: testError } = await supabase
                        .from('products').select('id').limit(1);
                    if (testError) {
                        set({ lastSyncError: `Tidak bisa terhubung ke database: ${testError.message}` });
                    } else if (!testData || testData.length === 0) {
                        set({ lastSyncError: 'Database cloud kosong. Silakan tambah produk terlebih dahulu.' });
                    } else {
                        set({ lastSyncError: 'Produk ada di server tapi gagal ditarik. Coba klik tombol "Hapus Cache & Restart" lalu coba lagi.' });
                    }
                    set({ loading: false, syncProgress: null });
                    return;
                }

                // Fetch conversions (usually small, so one request is fine)
                const { data: dbConversions, error: cError } = await supabase
                    .from('unit_conversions')
                    .select('*');

                if (cError) {
                    const errMsg = cError.message;
                    console.error("Failed to fetch conversions from cloud:", errMsg);
                    set({ lastSyncError: errMsg, loading: false });
                    return;
                }
                set({ lastSyncError: null });

                // Re-read latest local state AFTER remote fetch finishes to preserve checkouts made during network delay.
                const latestLocalProducts = await db.products.toArray();
                const latestLocalConversions = await db.unit_conversions.toArray();

                if (allDbProducts.length > 0) {
                    if (isFullSync) {
                        const localMap = new Map(latestLocalProducts.map((p: OfflineProduct) => [p.id, p]));
                        const merged = allDbProducts.map((p: OfflineProduct) => {
                            const local = localMap.get(p.id);
                            if (!local) return p;
                            const lts = local.updated_at ? new Date(local.updated_at).getTime() : 0;
                            const rts = p.updated_at ? new Date(p.updated_at).getTime() : 0;
                            return lts > rts ? local : p;
                        });
                        const shouldUpdateProducts = !sameProducts(get().products, merged);
                        if (shouldUpdateProducts) {
                            await db.products.clear();
                            await db.products.bulkAdd(merged);
                            set({ products: merged });
                        }
                    } else {
                        // For Delta sync, we just UPSERT changed items
                        await db.products.bulkPut(allDbProducts);
                        const newFullList = await db.products.toArray();
                        set({ products: newFullList });
                    }
                } else if (allDbProducts.length === 0 && latestLocalProducts.length > 0) {
                    console.log("Cloud products are empty. Keeping local data (migration mode).");
                }

                if (dbConversions && dbConversions.length > 0) {
                    const mergedConversions = dbConversions.map(c => {
                        return latestLocalConversions.find(local => local.id === c.id) || c;
                    });
                    const shouldUpdateConversions = !sameConversions(get().unitConversions, mergedConversions);
                    if (shouldUpdateConversions) {
                        await db.unit_conversions.clear();
                        await db.unit_conversions.bulkAdd(mergedConversions);
                        set({ unitConversions: mergedConversions });
                    }
                }
            }
        } catch (e) {
            console.error("Error loading products:", e);
        } finally {
            set({ loading: false, syncProgress: null });
        }
    },

    addProduct: async (productData, conversionsData) => {
        const id = crypto.randomUUID();
        const newProduct: OfflineProduct = { ...productData, id };

        const newConversions: OfflineUnitConversion[] = conversionsData.map(c => ({
            ...c,
            id: crypto.randomUUID(),
            product_id: id
        }));

        // Optimistic UI update
        set((state) => ({
            products: [...state.products, newProduct],
            unitConversions: [...state.unitConversions, ...newConversions],
        }));

        // Save to Local DB
        await db.products.add(newProduct);
        if (newConversions.length > 0) {
            await db.unit_conversions.bulkAdd(newConversions);
        }

        await queueProductSync(id, 'upsert', newProduct, newConversions);

        if (navigator.onLine) {
            try {
                await syncSingleProductToCloud(id, 'upsert', newProduct, newConversions);
            } catch (error) {
                console.error('Gagal sinkronisasi produk baru ke cloud:', error);
                await db.product_sync_queue.update(id, {
                    status: 'pending_sync',
                    updated_at: new Date().toISOString(),
                    last_error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    },

    updateProduct: async (id, productData, conversionsData) => {
        const existing = get().products.find(p => p.id === id);
        if (!existing) return;

        const updated: OfflineProduct = { ...existing, ...productData, updated_at: new Date().toISOString() };

        // Replace conversions: delete old, add new
        const newConversions: OfflineUnitConversion[] = conversionsData.map(c => ({
            ...c,
            id: crypto.randomUUID(),
            product_id: id,
        }));

        // Optimistic UI
        set(state => ({
            products: state.products.map(p => p.id === id ? updated : p),
            unitConversions: [
                ...state.unitConversions.filter(c => c.product_id !== id),
                ...newConversions
            ],
        }));

        await db.products.put(updated);
        await db.unit_conversions.where('product_id').equals(id).delete();
        if (newConversions.length > 0) {
            await db.unit_conversions.bulkAdd(newConversions);
        }

        await queueProductSync(id, 'upsert', updated, newConversions);

        if (navigator.onLine) {
            try {
                await syncSingleProductToCloud(id, 'upsert', updated, newConversions);
            } catch (error) {
                console.error(`Gagal sinkronisasi update produk ${id}:`, error);
                await db.product_sync_queue.update(id, {
                    status: 'pending_sync',
                    updated_at: new Date().toISOString(),
                    last_error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    },

    deleteProduct: async (id) => {
        // Optimistic
        set((state) => ({
            products: state.products.filter(p => p.id !== id),
            unitConversions: state.unitConversions.filter(c => c.product_id !== id)
        }));

        await db.products.delete(id);
        await db.unit_conversions.where('product_id').equals(id).delete();

        await queueProductSync(id, 'delete');

        if (navigator.onLine) {
            try {
                await syncSingleProductToCloud(id, 'delete');
            } catch (error) {
                console.error(`Gagal sinkronisasi hapus produk ${id}:`, error);
                await db.product_sync_queue.update(id, {
                    status: 'pending_sync',
                    updated_at: new Date().toISOString(),
                    last_error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    },

    receiveStock: async (productId, qtyAdded, notes, userId, priceUpdates, options) => {
        const product = get().products.find(p => p.id === productId);
        if (!product) return;

        const newStock = Number((product.current_stock + qtyAdded).toFixed(3));
        const updatedProduct: OfflineProduct = {
            ...product,
            current_stock: newStock,
            // Update prices if provided
            ...(priceUpdates?.newBasePrice && { base_price: priceUpdates.newBasePrice }),
            ...(priceUpdates?.newSellPrice && { sell_price: priceUpdates.newSellPrice }),
            updated_at: new Date().toISOString()
        };

        const activeBranchId = useBranchStore.getState().activeBranch?.id;
        const movement = {
            id: crypto.randomUUID(),
            branch_id: activeBranchId,
            product_id: productId,
            user_id: userId,
            movement_type: 'IN' as const,
            qty: qtyAdded,
            notes,
            reference_id: `IN-${Date.now()}`,
            supplier_id: options?.supplier_id,
            payment_status: options?.payment_status,
            status: 'pending_sync' as const,
            created_at: new Date().toISOString()
        };

        const effectiveBasePrice = priceUpdates?.newBasePrice ?? product.base_price ?? 0;
        const purchaseValue = Number((qtyAdded * effectiveBasePrice).toFixed(2));

        // Optimistic UI
        set((state) => ({
            products: state.products.map(p => p.id === productId ? updatedProduct : p)
        }));

        await db.products.put(updatedProduct);
        await db.inventory_movements.add(movement);

        if (options?.payment_status === 'tempo' && options?.supplier_id && purchaseValue > 0) {
            try {
                await useSupplierStore.getState().updateDebt(options.supplier_id, purchaseValue);
            } catch (supplierDebtErr) {
                console.error('Failed to update supplier debt after receive stock:', supplierDebtErr);
            }
        }

        // --- NEW: Sync to Supabase if Online ---
        if (navigator.onLine) {
            try {
                const safeMovement = {
                    ...movement,
                    branch_id: isUuid(movement.branch_id) ? movement.branch_id : '00000000-0000-0000-0000-000000000000',
                    user_id: isUuid(movement.user_id) ? movement.user_id : null,
                    supplier_id: isUuid(movement.supplier_id) ? movement.supplier_id : null,
                    status: 'completed' as const,
                };

                const { error: productError } = await supabase.from('products')
                    .update({
                        current_stock: updatedProduct.current_stock,
                        base_price: updatedProduct.base_price,
                        sell_price: updatedProduct.sell_price,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', productId);
                if (productError) throw productError;

                const { error: movementError } = await supabase.from('inventory_movements')
                    .upsert([safeMovement], { onConflict: 'id' });
                if (movementError) throw movementError;

                await db.inventory_movements.update(movement.id, { status: 'completed' });

                console.log("Stock update synced to Supabase successfully.");
            } catch (err) {
                console.error("Failed to sync stock update to Supabase:", err);
                await db.inventory_movements.update(movement.id, { status: 'pending_sync' });
            }
        }

        // Update unit_conversion prices if provided
        if (priceUpdates?.newSmallUnitPrice) {
            const conversions = get().unitConversions.filter(c => c.product_id === productId);
            for (const conv of conversions) {
                const updated = { ...conv, price: priceUpdates.newSmallUnitPrice! };
                await db.unit_conversions.put(updated);

                // Sync conversion price to Supabase too
                if (navigator.onLine) {
                    await supabase.from('unit_conversions')
                        .update({ price: updated.price })
                        .eq('id', conv.id);
                }

                set(state => ({
                    unitConversions: state.unitConversions.map(c => c.id === conv.id ? updated : c)
                }));
            }
        }
    },

    updateStock: (productId, newStock) => {
        set((state) => ({
            products: state.products.map(p =>
                p.id === productId ? { ...p, current_stock: newStock } : p
            )
        }));
    },

    deleteMovements: async (ids) => {
        const movements = await db.inventory_movements.bulkGet(ids);
        const validMovements = movements.filter((m): m is any => !!m);

        if (validMovements.length === 0) return;

        // Group by product to update stock
        const productChanges = new Map<string, number>();
        validMovements.forEach(m => {
            if (m.movement_type === 'IN') {
                const current = productChanges.get(m.product_id) || 0;
                productChanges.set(m.product_id, current + m.qty);
            }
        });

        // Update each product's stock
        const currentProducts = get().products;
        const updatedProducts = [...currentProducts];

        for (const [productId, totalQtyAdded] of Array.from(productChanges.entries())) {
            const index = updatedProducts.findIndex(p => p.id === productId);
            if (index !== -1) {
                const product = updatedProducts[index];
                const newStock = Number((product.current_stock - totalQtyAdded).toFixed(3));
                const updated = { ...product, current_stock: newStock, updated_at: new Date().toISOString() };
                updatedProducts[index] = updated;

                // Sync to Local DB
                await db.products.put(updated);

                // Sync to Supabase
                if (navigator.onLine) {
                    await supabase.from('products').update({
                        current_stock: newStock,
                        updated_at: updated.updated_at
                    }).eq('id', productId);
                }
            }
        }

        // Update state
        set({ products: updatedProducts });

        // Delete movements
        try {
            await db.inventory_movements.bulkDelete(ids);
            if (navigator.onLine) {
                const { error: delErr } = await supabase.from('inventory_movements').delete().in('id', ids);
                if (delErr) console.error("Supabase delete failed:", delErr);
            }
        } catch (err) {
            console.error("Dexie delete failed:", err);
            throw err;
        }
    }
}));
