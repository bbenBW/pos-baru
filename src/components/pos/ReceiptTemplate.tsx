'use client';

import { useStoreProfileStore } from '@/store/storeProfileStore';

interface ReceiptItem {
    name: string;
    unit_name: string;
    qty: number;
    price_per_unit: number;
    discount?: number;
    subtotal: number;
}

interface ReceiptData {
    receipt_number: string;
    created_at: string;
    cashier_name?: string;
    customer_name?: string;
    items: ReceiptItem[];
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    paid: number;
    change: number;
    payment_method: string;
    payment_breakdown?: { cash?: number; transfer?: number; qris?: number };
}

interface Props {
    data: ReceiptData;
    paperSize?: '58mm' | '80mm';
}

export function ReceiptTemplate({ data, paperSize = '80mm' }: Props) {
    const profile = useStoreProfileStore();

    const maxWidth = paperSize === '58mm' ? '58mm' : '80mm';

    const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
    const dt = new Date(data.created_at);
    const dateStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return (
        <div
            id="receipt-print-area"
            className="receipt-print-area font-mono text-black bg-white"
            style={{
                width: maxWidth,
                maxWidth,
                fontSize: paperSize === '58mm' ? '10px' : '11px',
                padding: '8px 6px',
                lineHeight: '1.4',
            }}
        >
            {/* Store Header */}
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                {profile.logo && (
                    <img src={profile.logo} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain', margin: '0 auto 4px' }} />
                )}
                <div style={{ fontWeight: 900, fontSize: paperSize === '58mm' ? '12px' : '14px', fontFamily: 'sans-serif' }}>
                    {profile.storeName || 'TOKO BANGUNAN'}
                </div>
                {profile.address && <div style={{ fontSize: '9px', marginTop: '2px' }}>{profile.address}</div>}
                {profile.phone && <div style={{ fontSize: '9px' }}>Telp: {profile.phone}</div>}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Receipt info */}
            <div style={{ fontSize: '9px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>No: {data.receipt_number}</span>
                    <span>{dateStr} {timeStr}</span>
                </div>
                {data.cashier_name && <div>Kasir: {data.cashier_name}</div>}
                {data.customer_name && <div>Pelanggan: {data.customer_name}</div>}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Items */}
            <div style={{ marginBottom: '4px' }}>
                {data.items.map((item, i) => (
                    <div key={i} style={{ marginBottom: '3px' }}>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px', fontSize: '9px' }}>
                            <span>{item.qty} {item.unit_name} × {fmt(item.price_per_unit)}</span>
                            <span>{fmt(item.subtotal)}</span>
                        </div>
                        {item.discount && item.discount > 0 ? (
                            <div style={{ paddingLeft: '4px', fontSize: '9px', color: '#666' }}>
                                Diskon: -{fmt(item.discount)}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Totals */}
            <div style={{ fontSize: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span><span>{fmt(data.subtotal)}</span>
                </div>
                {data.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Diskon</span><span>-{fmt(data.discount)}</span>
                    </div>
                )}
                {data.tax && data.tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Biaya Tambahan</span><span>{fmt(data.tax)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '11px', margin: '3px 0' }}>
                    <span>TOTAL</span><span>{fmt(data.total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bayar ({data.payment_method.toUpperCase()})</span><span>{fmt(data.paid)}</span>
                </div>
                {data.payment_breakdown?.transfer && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', fontSize: '9px' }}>
                        <span>— Transfer</span><span>{fmt(data.payment_breakdown.transfer)}</span>
                    </div>
                )}
                {data.change > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Kembalian</span><span>{fmt(data.change)}</span>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '9px', marginBottom: '6px' }}>
                <div>{profile.tagline || 'Terima kasih atas kepercayaan Anda!'}</div>
                <div style={{ marginTop: '2px', fontSize: '8px', color: '#555' }}>
                    Barang yang sudah dibeli tidak dapat dikembalikan
                </div>
            </div>

            {/* Print styles — only shown when printing */}
            <style>{`
                @media print {
                    body > *:not(#receipt-wrapper) { display: none !important; }
                    #receipt-wrapper {
                        position: fixed !important;
                        top: 0 !important; left: 0 !important;
                        width: 100% !important;
                        display: flex !important;
                        justify-content: center !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }
                    @page { margin: 0; size: ${paperSize} auto; }
                }
            `}</style>
        </div>
    );
}

// Utility to trigger print
export function printReceipt(data: ReceiptData, paperSize?: '58mm' | '80mm') {
    // Create wrapper
    let wrapper = document.getElementById('receipt-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'receipt-wrapper';
        document.body.appendChild(wrapper);
    }

    // Dynamically import React DOM to render
    import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(wrapper!);
        const { ReceiptTemplate } = require('@/components/pos/ReceiptTemplate');
        root.render(<ReceiptTemplate data={data} paperSize={paperSize} />);
        setTimeout(() => {
            window.print();
            setTimeout(() => root.unmount(), 1000);
        }, 200);
    });
}
