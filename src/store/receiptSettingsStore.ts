import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ReceiptField {
    key: string;
    label: string;
    visible: boolean;
}

export const DEFAULT_RECEIPT_FIELDS: ReceiptField[] = [
    { key: 'store_name', label: 'Nama Toko', visible: true },
    { key: 'store_address', label: 'Alamat Toko', visible: true },
    { key: 'store_phone', label: 'No. Telp Toko', visible: true },
    { key: 'divider', label: 'Garis Pemisah', visible: true },
    { key: 'receipt_number', label: 'No. Struk / Invoice', visible: true },
    { key: 'cashier_name', label: 'Nama Kasir', visible: true },
    { key: 'date_time', label: 'Tanggal & Waktu', visible: true },
    { key: 'customer_name', label: 'Nama Pelanggan', visible: true },
    { key: 'item_unit', label: 'Satuan per Item', visible: true },
    { key: 'item_discount', label: 'Diskon per Item', visible: true },
    { key: 'subtotal', label: 'Subtotal', visible: true },
    { key: 'total_discount', label: 'Total Diskon', visible: true },
    { key: 'grand_total', label: 'Grand Total', visible: true },
    { key: 'payment_method', label: 'Metode Pembayaran', visible: true },
    { key: 'paid_amount', label: 'Jumlah Bayar', visible: true },
    { key: 'change', label: 'Kembalian', visible: true },
    { key: 'footer_message', label: 'Pesan Penutup Struk', visible: true },
];

interface ReceiptSettingsState {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    footerMessage: string;
    fields: ReceiptField[];
    updateMeta: (data: Partial<Pick<ReceiptSettingsState, 'storeName' | 'storeAddress' | 'storePhone' | 'footerMessage'>>) => void;
    updateFields: (fields: ReceiptField[]) => void;
}

export const useReceiptSettingsStore = create<ReceiptSettingsState>()(
    persist(
        (set) => ({
            storeName: 'Toko Bangunan Saya',
            storeAddress: 'Jl. Contoh No. 1, Kota',
            storePhone: '08xxxxxxxxxx',
            footerMessage: 'Terima kasih atas kepercayaan Anda!',
            fields: DEFAULT_RECEIPT_FIELDS,
            updateMeta: (data) => set(state => ({ ...state, ...data })),
            updateFields: (fields) => set({ fields }),
        }),
        { name: 'receipt-settings' }
    )
);
