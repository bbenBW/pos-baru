import Dexie, { type Table } from 'dexie';

// --- PHASE 1 ENTITIES ---
export interface OfflineProduct {
    id: string; // UUID from Supabase
    barcode: string | null;
    name: string;
    category_id: string | null;
    base_unit: string; // Now acts as LARGE unit (e.g., Sak, Dus)
    base_price: number;
    sell_price: number;
    current_stock: number;
    min_stock?: number;
    branch_id?: string;
    image_url?: string;
    base64_offline?: string;
    updated_at?: string;
    created_at?: string;
}

export interface OfflineUnitConversion {
    id: string;
    product_id: string;
    unit_name: string;
    multiplier: number; // How many small units are in the large unit
    price: number | null;
}

export interface OfflineProductSyncQueue {
    id: string;
    product_id: string;
    action: 'upsert' | 'delete';
    product_payload?: OfflineProduct;
    conversions_payload?: OfflineUnitConversion[];
    status: 'pending_sync' | 'completed';
    created_at: string;
    updated_at?: string;
    last_error?: string;
}

export interface OfflineSaleQueue {
    local_id?: number;
    receipt_number: string;
    user_id: string | null;
    customer_id: string | null;
    branch_id?: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid: number;
    change: number;
    payment_method: string;
    payment_breakdown?: { cash?: number; transfer?: number; qris?: number }; // split payment
    status: 'pending_sync' | 'completed';
    voided?: boolean;
    voided_at?: string;
    voided_by?: string;
    created_at: string;
    details: {
        product_id: string;
        unit_name: string;
        unit_multiplier: number;
        qty: number;
        base_qty: number;
        price_per_unit: number;
        discount: number;
        subtotal: number;
        cogs_subtotal?: number;
        _productName?: string;
    }[];
}

// --- PHASE 2 ENTITIES ---
export interface OfflineBranch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    created_at?: string;
    updated_at?: string;
}

export interface OfflineCustomer {
    id: string;
    branch_id?: string;
    name: string;
    phone: string;
    address: string;
    debt_balance: number;
    credit_limit?: number;
    updated_at?: string;
}

export interface OfflineReceivablePayment {
    id: string;
    customer_id: string;
    branch_id?: string;
    user_id?: string;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'qris' | 'kas_besar';
    notes?: string;
    status: 'pending_sync' | 'completed';
    created_at: string;
}

export interface OfflineExpense {
    id: string;
    branch_id?: string;
    user_id?: string;
    category: string;
    amount: number;
    description: string;
    expense_date: string;
    payment_method: 'cash' | 'transfer' | 'qris' | 'kas_besar';
    status: 'pending_sync' | 'completed';
    created_at: string;
}

export interface OfflineInventoryMovement {
    id: string;
    branch_id?: string;
    product_id: string;
    user_id?: string;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
    qty: number;
    notes: string;
    reference_id: string;
    supplier_id?: string; // NEW
    payment_status?: string; // NEW
    status: 'pending_sync' | 'completed';
    created_at: string;
}

export interface OfflineSupplier {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    debt_balance?: number;
    created_at?: string;
}

export interface OfflineCashShift {
    id: string;
    branch_id?: string;
    user_id?: string;
    user_role?: string;
    user_name?: string;
    device_id?: string;
    device_name?: string;
    opening_time: string;
    closing_time?: string;
    opening_cash: number;
    expected_closing_cash?: number;
    actual_closing_cash?: number;
    difference?: number;
    status: 'open' | 'closed' | 'pending_sync';
    notes?: string;
    cash_deposited?: number; // NEW: Amount moved to safe
    cash_kept?: number;      // NEW: Amount left in drawer
    adjustments?: { amount: number; time: string; note: string }[]; // NEW: Manual float adjustments
}

export interface OfflineStoreSetting {
    id: string;
    branch_id?: string;
    preferences: Record<string, any>; // Store JSON settings
    updated_at?: string;
}

class PosDatabase extends Dexie {
    products!: Table<OfflineProduct, string>;
    unit_conversions!: Table<OfflineUnitConversion, string>;
    sale_queue!: Table<OfflineSaleQueue, number>;
    product_sync_queue!: Table<OfflineProductSyncQueue, string>;

    // Phase 2
    branches!: Table<OfflineBranch, string>;
    customers!: Table<OfflineCustomer, string>;
    receivables_payments!: Table<OfflineReceivablePayment, string>;
    expenses!: Table<OfflineExpense, string>;
    inventory_movements!: Table<OfflineInventoryMovement, string>;
    cash_shifts!: Table<OfflineCashShift, string>;
    store_settings!: Table<OfflineStoreSetting, string>;
    suppliers!: Table<OfflineSupplier, string>;

    constructor() {
        super('PosTokoBangunanDB');
        // Version 2 to run migrations and add new tables
        this.version(2).stores({
            products: 'id, barcode, name, category_id, branch_id',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id',
            branches: 'id',
            customers: 'id, branch_id, name',
            expenses: 'id, branch_id, status, expense_date',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id'
        });
        this.version(3).stores({
            products: 'id, barcode, name, category_id, branch_id',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id, voided',
            branches: 'id',
            customers: 'id, branch_id, name',
            expenses: 'id, branch_id, status, expense_date',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id',
            suppliers: 'id, name'
        });
        this.version(4).stores({
            products: 'id, barcode, name, category_id, branch_id',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id, voided',
            branches: 'id',
            customers: 'id, branch_id, name',
            receivables_payments: 'id, customer_id, branch_id, status, created_at, user_id',
            expenses: 'id, branch_id, status, expense_date',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id',
            suppliers: 'id, name'
        });
        this.version(5).stores({
            products: 'id, barcode, name, category_id, branch_id',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id, voided',
            product_sync_queue: 'id, product_id, status, action, created_at',
            branches: 'id',
            customers: 'id, branch_id, name',
            receivables_payments: 'id, customer_id, branch_id, status, created_at, user_id',
            expenses: 'id, branch_id, status, expense_date',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id',
            suppliers: 'id, name'
        });
        // Version 6: Add updated_at index to products for Delta Sync (orderBy support)
        this.version(6).stores({
            products: 'id, barcode, name, category_id, branch_id, updated_at',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id, voided',
            product_sync_queue: 'id, product_id, status, action, created_at',
            branches: 'id',
            customers: 'id, branch_id, name',
            receivables_payments: 'id, customer_id, branch_id, status, created_at, user_id',
            expenses: 'id, branch_id, status, expense_date',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id',
            suppliers: 'id, name'
        });
        // Version 7: Add payment_method to expenses
        this.version(7).stores({
            products: 'id, barcode, name, category_id, branch_id, updated_at',
            unit_conversions: 'id, product_id',
            sale_queue: '++local_id, receipt_number, status, branch_id, voided',
            product_sync_queue: 'id, product_id, status, action, created_at',
            branches: 'id',
            customers: 'id, branch_id, name',
            receivables_payments: 'id, customer_id, branch_id, status, created_at, user_id',
            expenses: 'id, branch_id, status, expense_date, payment_method',
            inventory_movements: 'id, product_id, branch_id, status',
            cash_shifts: 'id, branch_id, status, user_id',
            store_settings: 'id, branch_id',
            suppliers: 'id, name'
        });
    }
}

export const db = new PosDatabase();
