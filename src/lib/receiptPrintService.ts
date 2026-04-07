import { printReceipt as printReceiptViaBrowser } from '@/components/pos/ReceiptTemplate';
import { printTextToBluetoothPrinter, isNativeBluetoothPrintingSupported } from '@/lib/bluetoothPrinter';
import { useReceiptSettingsStore } from '@/store/receiptSettingsStore';
import { useSettingStore } from '@/store/settingStore';
import { useStoreProfileStore } from '@/store/storeProfileStore';

export interface PrintableReceiptItem {
    name: string;
    unit_name: string;
    qty: number;
    price_per_unit: number;
    discount?: number;
    subtotal: number;
}

export interface PrintableReceiptData {
    receipt_number: string;
    created_at: string;
    cashier_name?: string;
    customer_name?: string;
    items: PrintableReceiptItem[];
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    paid: number;
    change: number;
    payment_method: string;
    payment_breakdown?: { cash?: number; transfer?: number; qris?: number };
}

const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    tempo: 'Kasbon',
    split: 'Split',
    qris: 'QRIS'
};

const sanitizeAscii = (value: string) =>
    value
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n');

const wrapText = (value: string, width: number) => {
    const words = sanitizeAscii(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            current = word;
            continue;
        }
        if (`${current} ${word}`.length <= width) {
            current = `${current} ${word}`;
        } else {
            lines.push(current);
            current = word;
        }
    }

    if (current) lines.push(current);
    return lines.length ? lines : [''];
};

const lineLeftRight = (left: string, right: string, width: number) => {
    const safeLeft = sanitizeAscii(left);
    const safeRight = sanitizeAscii(right);

    if (safeLeft.length + safeRight.length + 1 <= width) {
        return `${safeLeft}${' '.repeat(width - safeLeft.length - safeRight.length)}${safeRight}`;
    }

    const leftWidth = Math.max(8, width - safeRight.length - 1);
    const leftLines = wrapText(safeLeft, leftWidth);
    const lines = leftLines.map((line, index) => {
        if (index === leftLines.length - 1) {
            return `${line}${' '.repeat(Math.max(1, width - line.length - safeRight.length))}${safeRight}`;
        }
        return line;
    });

    return lines.join('\n');
};

const separator = (width: number) => '-'.repeat(width);

export const buildReceiptText = (data: PrintableReceiptData, paperSize?: '58mm' | '80mm') => {
    const settings = useSettingStore.getState().settings;
    const receiptSettings = useReceiptSettingsStore.getState();
    const profile = useStoreProfileStore.getState();
    const width = (paperSize || settings.paperSize) === '58mm' ? 32 : 48;
    const visible = new Set(receiptSettings.fields.filter(field => field.visible).map(field => field.key));
    const lines: string[] = [];
    const fmt = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    const dt = new Date(data.created_at);
    const paymentLabel = PAYMENT_LABELS[data.payment_method] || data.payment_method;
    const storeName = sanitizeAscii(receiptSettings.storeName || profile.storeName || 'TOKO BANGUNAN');
    const storeAddress = sanitizeAscii(receiptSettings.storeAddress || profile.address || '');
    const storePhone = sanitizeAscii(receiptSettings.storePhone || profile.phone || '');
    const footerMessage = sanitizeAscii(receiptSettings.footerMessage || profile.tagline || 'Terima kasih atas kepercayaan Anda!');

    if (visible.has('store_name')) lines.push(...wrapText(storeName.toUpperCase(), width));
    if (visible.has('store_address') && storeAddress) lines.push(...wrapText(storeAddress, width));
    if (visible.has('store_phone') && storePhone) lines.push(...wrapText(`Telp: ${storePhone}`, width));
    if (visible.has('divider')) lines.push(separator(width));
    if (visible.has('receipt_number')) lines.push(...wrapText(`No: ${data.receipt_number}`, width));
    if (visible.has('date_time')) lines.push(...wrapText(`Waktu: ${dt.toLocaleString('id-ID')}`, width));
    if (visible.has('cashier_name') && data.cashier_name) lines.push(...wrapText(`Kasir: ${data.cashier_name}`, width));
    if (visible.has('customer_name') && data.customer_name) lines.push(...wrapText(`Pelanggan: ${data.customer_name}`, width));
    if (visible.has('divider')) lines.push(separator(width));

    data.items.forEach(item => {
        lines.push(...wrapText(item.name, width));
        const detailLine = visible.has('item_unit')
            ? `${item.qty} ${item.unit_name} x ${Math.round(item.price_per_unit).toLocaleString('id-ID')}`
            : `${item.qty} x ${Math.round(item.price_per_unit).toLocaleString('id-ID')}`;
        lines.push(lineLeftRight(detailLine, Math.round(item.subtotal).toLocaleString('id-ID'), width));
        if (visible.has('item_discount') && item.discount && item.discount > 0) {
            lines.push(...wrapText(`Disc: -${fmt(item.discount)}`, width));
        }
    });

    if (visible.has('divider')) lines.push(separator(width));
    if (visible.has('subtotal')) lines.push(lineLeftRight('Subtotal', fmt(data.subtotal), width));
    if (visible.has('total_discount') && data.discount > 0) lines.push(lineLeftRight('Diskon', `-${fmt(data.discount)}`, width));
    if (data.tax && data.tax > 0) lines.push(lineLeftRight('Biaya Tambahan', fmt(data.tax), width));
    if (visible.has('grand_total')) lines.push(lineLeftRight('TOTAL', fmt(data.total), width));
    if (visible.has('payment_method')) lines.push(lineLeftRight('Metode', paymentLabel, width));
    if (visible.has('paid_amount')) lines.push(lineLeftRight('Bayar', fmt(data.paid), width));
    if (data.payment_breakdown?.cash) lines.push(lineLeftRight('- Tunai', fmt(data.payment_breakdown.cash), width));
    if (data.payment_breakdown?.transfer) lines.push(lineLeftRight('- Transfer', fmt(data.payment_breakdown.transfer), width));
    if (data.payment_breakdown?.qris) lines.push(lineLeftRight('- QRIS', fmt(data.payment_breakdown.qris), width));
    if (visible.has('change')) lines.push(lineLeftRight('Kembali', fmt(data.change), width));
    if (visible.has('divider')) lines.push(separator(width));
    if (visible.has('footer_message')) lines.push(...wrapText(footerMessage, width));

    return sanitizeAscii(lines.join('\n') + '\n');
};

export const printReceiptWithConfiguredMode = async (data: PrintableReceiptData) => {
    const settings = useSettingStore.getState().settings;
    const paperSize = settings.paperSize || '58mm';

    if (settings.printMode === 'bluetooth' && settings.bluetoothMacAddress && isNativeBluetoothPrintingSupported()) {
        const receiptText = buildReceiptText(data, paperSize);
        await printTextToBluetoothPrinter(settings.bluetoothMacAddress, receiptText);
        return 'bluetooth';
    }

    printReceiptViaBrowser(data, paperSize);
    return 'browser';
};
