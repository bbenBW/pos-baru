import { create } from 'zustand';
import { db, OfflineSupplier } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

interface SupplierLoadOptions {
    silent?: boolean;
}

interface SupplierState {
    suppliers: OfflineSupplier[];
    loading: boolean;
    loadSuppliers: (options?: SupplierLoadOptions) => Promise<void>;
    addSupplier: (data: Omit<OfflineSupplier, 'id' | 'created_at'>) => Promise<void>;
    updateSupplier: (id: string, data: Partial<OfflineSupplier>) => Promise<void>;
    updateDebt: (id: string, amount: number) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
}

let supplierLoadSeq = 0;

export const useSupplierStore = create<SupplierState>((set, get) => ({
    suppliers: [],
    loading: false,

    loadSuppliers: async (options) => {
        const requestId = ++supplierLoadSeq;
        // Auto-silent jika data sudah ada (menghindari kedip), kecuali override
        const silent = options?.silent ?? get().suppliers.length > 0;
        if (!silent) set({ loading: true });
        try {
            let localSuppliers = await db.suppliers.toArray();

            // Render data lokal dulu agar tampilan tidak kosong
            if (requestId !== supplierLoadSeq) return;
            set(state => ({ suppliers: localSuppliers, loading: silent ? state.loading : false }));

            if (navigator.onLine) {
                const { data: remoteSuppliers, error } = await supabase.from('suppliers').select('*');
                if (!error && remoteSuppliers) {
                    await db.suppliers.bulkPut(remoteSuppliers);
                    const map = new Map();
                    [...localSuppliers, ...remoteSuppliers].forEach(s => map.set(s.id, s));
                    localSuppliers = Array.from(map.values());
                }
            }

            // Update dengan data final dari cloud (silent, tidak mengubah loading state)
            if (requestId !== supplierLoadSeq) return;
            set({ suppliers: localSuppliers });
        } finally {
            if (requestId === supplierLoadSeq) {
                set({ loading: false });
            }
        }
    },

    addSupplier: async (data) => {
        const supplier: OfflineSupplier = {
            ...data,
            id: crypto.randomUUID(),
            debt_balance: 0,
            created_at: new Date().toISOString()
        };
        await db.suppliers.add(supplier);
        set(state => ({ suppliers: [...state.suppliers, supplier] }));

        if (navigator.onLine) {
            await supabase.from('suppliers').insert([supplier]);
        }
    },

    updateSupplier: async (id, data) => {
        await db.suppliers.update(id, data);
        set(state => ({
            suppliers: state.suppliers.map(s => s.id === id ? { ...s, ...data } : s)
        }));

        if (navigator.onLine) {
            await supabase.from('suppliers').update(data).eq('id', id);
        }
    },

    deleteSupplier: async (id) => {
        await db.suppliers.delete(id);
        set(state => ({ suppliers: state.suppliers.filter(s => s.id !== id) }));

        if (navigator.onLine) {
            await supabase.from('suppliers').delete().eq('id', id);
        }
    },

    updateDebt: async (id, amount) => {
        const supplier = get().suppliers.find(s => s.id === id);
        if (!supplier) return;

        const newBalance = (supplier.debt_balance || 0) + amount;
        const updated = { ...supplier, debt_balance: newBalance };

        await db.suppliers.put(updated);
        set(state => ({ suppliers: state.suppliers.map(s => s.id === id ? updated : s) }));

        if (navigator.onLine) {
            await supabase.from('suppliers').update({ debt_balance: newBalance }).eq('id', id);
        }
    }
}));
