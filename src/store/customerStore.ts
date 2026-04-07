import { create } from 'zustand';
import { db, OfflineCustomer, OfflineReceivablePayment } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

interface CustomerLoadOptions {
    silent?: boolean;
}

interface CustomerState {
    customers: OfflineCustomer[];
    loading: boolean;
    loadCustomers: (branchId?: string, options?: CustomerLoadOptions) => Promise<void>;
    addCustomer: (customerData: Omit<OfflineCustomer, 'id' | 'debt_balance' | 'updated_at'>) => Promise<void>;
    updateDebt: (customerId: string, amount: number) => Promise<void>;
    loadReceivablePayments: (customerId: string) => Promise<OfflineReceivablePayment[]>;
    recordReceivablePayment: (input: {
        customerId: string;
        amount: number;
        paymentMethod: OfflineReceivablePayment['payment_method'];
        notes?: string;
        branchId?: string;
        userId?: string;
    }) => Promise<void>;
}

let customerLoadSeq = 0;

const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const useCustomerStore = create<CustomerState>((set, get) => ({
    customers: [],
    loading: true,

    loadCustomers: async (branchId, options) => {
        const requestId = ++customerLoadSeq;
        const silent = options?.silent ?? get().customers.length > 0;
        if (!silent) set({ loading: true });
        try {
            // 1. Get Local Data
            let query = db.customers.toCollection();
            if (branchId) {
                query = db.customers.where('branch_id').equals(branchId);
            }
            let data = await query.toArray();

            if (requestId !== customerLoadSeq) return;
            set(state => ({ customers: data, loading: silent ? state.loading : false }));

            // 2. Fetch Remote Data if Online
            if (navigator.onLine) {
                let sbQuery = supabase.from('customers').select('*');
                if (branchId) {
                    sbQuery = sbQuery.eq('branch_id', branchId);
                }
                const { data: remoteData, error } = await sbQuery;

                if (!error && remoteData) {
                    // Update local cache with remote data
                    await db.customers.bulkPut(remoteData);

                    // Merge and deduplicate
                    const map = new Map();
                    [...data, ...remoteData].forEach(c => map.set(c.id, c));
                    data = Array.from(map.values());
                }
            }

            if (requestId !== customerLoadSeq) return;
            set({ customers: data });
        } catch (error) {
            console.error('Failed to load customers:', error);
        } finally {
            if (requestId === customerLoadSeq) {
                set({ loading: false });
            }
        }
    },

    addCustomer: async (customerData) => {
        const newCustomer: OfflineCustomer = {
            ...customerData,
            id: crypto.randomUUID(),
            debt_balance: 0,
            updated_at: new Date().toISOString()
        };

        await db.customers.add(newCustomer);

        set((state) => ({
            customers: [...state.customers, newCustomer]
        }));

        if (navigator.onLine) {
            // supabase sync
            await supabase.from('customers').insert([newCustomer]);
        }
    },

    updateDebt: async (customerId, amount) => {
        const customer = get().customers.find(c => c.id === customerId);
        if (!customer) return;

        const newBalance = customer.debt_balance + amount;
        const updatedCustomer = { ...customer, debt_balance: newBalance, updated_at: new Date().toISOString() };

        await db.customers.put(updatedCustomer);

        set(state => ({
            customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c)
        }));

        if (navigator.onLine) {
            await supabase.from('customers').update({ debt_balance: newBalance }).eq('id', customerId);
        }
    },

    loadReceivablePayments: async (customerId) => {
        const localPayments = await db.receivables_payments
            .where('customer_id')
            .equals(customerId)
            .toArray();

        return [...localPayments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    recordReceivablePayment: async ({ customerId, amount, paymentMethod, notes, branchId, userId }) => {
        const customer = get().customers.find(c => c.id === customerId);
        if (!customer || amount <= 0) return;

        const appliedAmount = Math.min(customer.debt_balance, amount);
        const safeBranchId = isUuid(branchId) ? branchId : undefined;
        const safeUserId = isUuid(userId) ? userId : undefined;
        const updatedCustomer = {
            ...customer,
            debt_balance: Math.max(0, customer.debt_balance - appliedAmount),
            updated_at: new Date().toISOString()
        };

        const payment: OfflineReceivablePayment = {
            id: crypto.randomUUID(),
            customer_id: customerId,
            branch_id: safeBranchId,
            user_id: safeUserId,
            amount: appliedAmount,
            payment_method: paymentMethod,
            notes,
            status: navigator.onLine ? 'completed' : 'pending_sync',
            created_at: new Date().toISOString()
        };

        await db.transaction('rw', db.customers, db.receivables_payments, async () => {
            await db.customers.put(updatedCustomer);
            await db.receivables_payments.add(payment);
        });

        set(state => ({
            customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c)
        }));

        if (navigator.onLine) {
            await supabase.from('customers').update({ debt_balance: updatedCustomer.debt_balance }).eq('id', customerId);
            const { error } = await supabase.from('receivables_payments').insert([{
                id: payment.id,
                customer_id: payment.customer_id,
                branch_id: payment.branch_id,
                user_id: payment.user_id,
                amount: payment.amount,
                payment_method: payment.payment_method,
                notes: payment.notes,
                created_at: payment.created_at,
            }]);

            if (!error) {
                await db.receivables_payments.update(payment.id, { status: 'completed' });
            } else {
                console.warn('Gagal sync pembayaran kasbon ke cloud:', error.message);
                await db.receivables_payments.update(payment.id, { status: 'pending_sync' });
            }
        }
    }
}));


