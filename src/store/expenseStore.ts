import { create } from 'zustand';
import { db, OfflineExpense } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

interface ExpenseState {
    expenses: OfflineExpense[];
    loading: boolean;
    loadExpenses: (branchId?: string, options?: { silent?: boolean }) => Promise<void>;
    addExpense: (expenseData: Omit<OfflineExpense, 'id' | 'status' | 'created_at'>) => Promise<void>;
    updateExpense: (id: string, expenseData: Partial<OfflineExpense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
    expenses: [],
    loading: true,

    loadExpenses: async (branchId, options) => {
        if (!options?.silent) {
            set({ loading: true });
        }
        try {
            // 1. Local
            let query = db.expenses.orderBy('expense_date').reverse();
            if (branchId) {
                query = db.expenses.where('branch_id').equals(branchId);
            }
            let data = await query.toArray();

            // 2. Remote
            if (navigator.onLine) {
                let sbQuery = supabase.from('expenses').select('*');
                if (branchId) {
                    sbQuery = sbQuery.eq('branch_id', branchId);
                }
                const { data: remoteData, error } = await sbQuery;
                if (!error && remoteData) {
                    await db.expenses.bulkPut(remoteData);
                    const map = new Map();
                    [...data, ...remoteData].forEach(e => map.set(e.id, e));
                    data = Array.from(map.values());
                }
            }

            // Sort manually
            const sortedData = data.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

            set({ expenses: sortedData });
        } catch (error) {
            console.error('Failed to load expenses:', error);
        } finally {
            if (!options?.silent) {
                set({ loading: false });
            }
        }
    },

    addExpense: async (expenseData) => {
        const newExpense: OfflineExpense = {
            ...expenseData,
            id: crypto.randomUUID(),
            status: 'pending_sync',
            created_at: new Date().toISOString()
        };

        if (navigator.onLine) {
            const { error } = await supabase.from('expenses').insert([{ ...newExpense, status: 'completed' }]);
            if (!error) {
                newExpense.status = 'completed';
            }
        }

        await db.expenses.add(newExpense);

        // Trigger event for Dashboard refresh and immediate sync
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expenses-changed'));
            window.dispatchEvent(new CustomEvent('trigger-sync'));
        }

        set((state) => ({
            expenses: [newExpense, ...state.expenses].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        }));
    },

    updateExpense: async (id, expenseData) => {
        const existing = await db.expenses.get(id);
        if (!existing) return;

        const updatedExpense: OfflineExpense = {
            ...existing,
            ...expenseData,
            status: 'pending_sync'
        };

        if (navigator.onLine) {
            const { error } = await supabase.from('expenses').upsert([{ ...updatedExpense, status: 'completed' }]);
            if (!error) {
                updatedExpense.status = 'completed';
            }
        }

        await db.expenses.put(updatedExpense);

        // Trigger event for Dashboard refresh and immediate sync
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expenses-changed'));
            window.dispatchEvent(new CustomEvent('trigger-sync'));
        }

        set((state) => ({
            expenses: state.expenses.map(e => e.id === id ? updatedExpense : e)
        }));
    },

    deleteExpense: async (id) => {
        await db.expenses.delete(id);
        set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }));

        // Trigger event for Dashboard refresh and immediate sync
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('expenses-changed'));
            window.dispatchEvent(new CustomEvent('trigger-sync'));
        }

        if (navigator.onLine) {
            await supabase.from('expenses').delete().eq('id', id);
        }
    }
}));
