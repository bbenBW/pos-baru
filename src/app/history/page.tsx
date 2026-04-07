'use client';

import { useEffect, useState } from 'react';
import { db, OfflineSaleQueue } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useProductStore } from '@/store/productStore';
import { useAuthStore } from '@/store/authStore';
import { useCustomerStore } from '@/store/customerStore';
import { printReceiptWithConfiguredMode } from '@/lib/receiptPrintService';
import {
    History, Search, Calendar, ChevronDown, ChevronUp,
    X, AlertTriangle, Package, CreditCard, Printer
} from 'lucide-react';

type SaleDetail = OfflineSaleQueue['details'][number];
type VoidItemTarget = { sale: OfflineSaleQueue; detail: SaleDetail; detailIndex: number };

const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    tempo: 'Kasbon',
    split: 'Split',
    qris: 'QRIS'
};

const roundMoney = (value: number) => Math.round(value);
const roundStock = (value: number) => Number(value.toFixed(3));

const dedupeRemoteDetails = <T extends Record<string, any>>(details: T[]) => {
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

export default function HistoryPage() {
    const { user } = useAuthStore();
    const { products } = useProductStore();
    const updateDebt = useCustomerStore(state => state.updateDebt);
    const customers = useCustomerStore(state => state.customers);
    const loadCustomers = useCustomerStore(state => state.loadCustomers);
    const [sales, setSales] = useState<OfflineSaleQueue[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [voidConfirm, setVoidConfirm] = useState<OfflineSaleQueue | null>(null);
    const [voidItemConfirm, setVoidItemConfirm] = useState<VoidItemTarget | null>(null);
    const [voidLoading, setVoidLoading] = useState(false);

    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [methodFilter, setMethodFilter] = useState('all');
    const [showVoided, setShowVoided] = useState(false);

    useEffect(() => {
        void loadSales();
    }, [startDate, endDate]);

    useEffect(() => {
        void loadCustomers(undefined, { silent: true });
    }, [loadCustomers]);

    const saleKey = (sale: OfflineSaleQueue) => sale.local_id != null ? `local-${sale.local_id}` : `remote-${sale.receipt_number}`;

    const getBaseQty = (detail: SaleDetail) => {
        if (typeof detail.base_qty === 'number' && !Number.isNaN(detail.base_qty)) {
            return detail.base_qty;
        }
        if (detail.qty && detail.unit_multiplier) {
            return roundStock(detail.qty / detail.unit_multiplier);
        }
        return 0;
    };

    const adjustTempoDebt = async (previousSale: OfflineSaleQueue, nextTotal: number, nextPaid: number) => {
        if (previousSale.payment_method !== 'tempo' || !previousSale.customer_id) return;
        const oldOutstanding = Math.max(0, previousSale.total - previousSale.paid);
        const nextOutstanding = Math.max(0, nextTotal - nextPaid);
        const delta = roundMoney(nextOutstanding - oldOutstanding);
        if (delta !== 0) {
            await updateDebt(previousSale.customer_id, delta);
        }
    };

    const restoreItemStock = async (sale: OfflineSaleQueue, detail: SaleDetail, note: string) => {
        const product = await db.products.get(detail.product_id);
        const qty = getBaseQty(detail);

        if (product) {
            const newStock = roundStock(product.current_stock + qty);
            product.current_stock = newStock;
            product.updated_at = new Date().toISOString();
            await db.products.put(product);
            useProductStore.getState().updateStock(detail.product_id, newStock);
        }

        await db.inventory_movements.add({
            id: crypto.randomUUID(),
            product_id: detail.product_id,
            user_id: user?.id || undefined,
            movement_type: 'ADJUSTMENT',
            qty,
            notes: note,
            reference_id: `VOID-${sale.receipt_number}`,
            status: 'pending_sync',
            created_at: new Date().toISOString()
        });
    };

    const rebuildPaymentBreakdown = (sale: OfflineSaleQueue, ratio: number, nextTotal: number) => {
        if (!sale.payment_breakdown) return undefined;

        const next = {
            cash: roundMoney((sale.payment_breakdown.cash || 0) * ratio),
            transfer: roundMoney((sale.payment_breakdown.transfer || 0) * ratio),
            qris: roundMoney((sale.payment_breakdown.qris || 0) * ratio),
        };

        const currentSum = (next.cash || 0) + (next.transfer || 0) + (next.qris || 0);
        const diff = roundMoney(nextTotal - currentSum);
        if (diff !== 0) {
            const dominantKey = (['cash', 'transfer', 'qris'] as const).reduce((best, key) => {
                return (next[key] || 0) >= (next[best] || 0) ? key : best;
            }, 'cash');
            next[dominantKey] = Math.max(0, (next[dominantKey] || 0) + diff);
        }

        return next;
    };

    const buildUpdatedSaleAfterItemVoid = (sale: OfflineSaleQueue, detailIndex: number) => {
        const remainingDetails = sale.details.filter((_, index) => index !== detailIndex);
        const nextSubtotal = roundMoney(remainingDetails.reduce((sum, detail) => sum + detail.subtotal, 0));
        const ratio = sale.subtotal > 0 ? nextSubtotal / sale.subtotal : 0;
        const nextDiscount = roundMoney(sale.discount * ratio);
        const nextTax = roundMoney(sale.tax * ratio);
        const nextTotal = Math.max(0, roundMoney(nextSubtotal - nextDiscount + nextTax));
        const nextBreakdown = rebuildPaymentBreakdown(sale, ratio, nextTotal);

        let nextPaid = sale.paid;
        let nextChange = sale.change;

        if (sale.payment_method === 'split') {
            nextPaid = (nextBreakdown?.cash || 0) + (nextBreakdown?.transfer || 0) + (nextBreakdown?.qris || 0);
            nextChange = 0;
        } else if (sale.payment_method === 'cash') {
            nextPaid = sale.paid;
            nextChange = Math.max(0, roundMoney(nextPaid - nextTotal));
        } else if (sale.payment_method === 'tempo') {
            nextPaid = Math.min(sale.paid, nextTotal);
            nextChange = 0;
        } else {
            nextPaid = nextTotal;
            nextChange = 0;
        }

        return {
            details: remainingDetails,
            subtotal: nextSubtotal,
            discount: nextDiscount,
            tax: nextTax,
            total: nextTotal,
            paid: nextPaid,
            change: nextChange,
            payment_breakdown: nextBreakdown,
            status: 'pending_sync' as const,
            voided: false,
            voided_at: undefined,
            voided_by: undefined,
        };
    };

    const loadSales = async () => {
        setLoading(true);
        try {
            const local = await db.sale_queue.toArray();

            let remote: OfflineSaleQueue[] = [];
            if (navigator.onLine) {
                const startStr = new Date(startDate + 'T00:00:00').toISOString();
                const endStr = new Date(endDate + 'T23:59:59').toISOString();

                const { data: remoteSales, error } = await supabase
                    .from('sales')
                    .select('*, details:sale_details(*)')
                    .gte('created_at', startStr)
                    .lte('created_at', endStr)
                    .order('created_at', { ascending: false });

                if (!error && remoteSales) {
                    remote = remoteSales.map((sale: any) => ({
                        ...sale,
                        details: dedupeRemoteDetails(sale.details.map((detail: any) => ({
                            ...detail,
                            _productName: detail.product_name || detail._productName
                        })))
                    }));
                }
            }

            const combined = [...local];
            const localReceipts = new Set(local.map(sale => sale.receipt_number));
            for (const sale of remote) {
                if (!localReceipts.has(sale.receipt_number)) {
                    combined.push(sale);
                }
            }

            const startMs = new Date(startDate + 'T00:00:00').getTime();
            const endMs = new Date(endDate + 'T23:59:59').getTime();

            const final = combined
                .filter(sale => {
                    const time = new Date(sale.created_at).getTime();
                    return time >= startMs && time <= endMs;
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setSales(final);
        } catch (error) {
            console.error('Failed to load hybrid sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(sale => {
        if (!showVoided && sale.voided) return false;
        if (methodFilter !== 'all' && sale.payment_method !== methodFilter) return false;
        if (!search) return true;

        const query = search.toLowerCase();
        const matchReceipt = sale.receipt_number?.toLowerCase().includes(query);
        const matchItems = sale.details.some(detail => {
            const product = products.find(item => item.id === detail.product_id);
            return (detail._productName || product?.name || '').toLowerCase().includes(query);
        });
        return matchReceipt || matchItems;
    });

    const handleVoid = async (sale: OfflineSaleQueue) => {
        if (sale.local_id == null) {
            alert('Transaksi cloud-only belum bisa di-void dari perangkat ini. Coba lakukan dari perangkat asal transaksi.');
            return;
        }

        setVoidLoading(true);
        try {
            await db.transaction('rw', db.products, db.inventory_movements, db.sale_queue, async () => {
                for (const detail of sale.details) {
                    await restoreItemStock(sale, detail, `VOID transaksi #${sale.receipt_number}`);
                }

                await db.sale_queue.update(sale.local_id!, {
                    voided: true,
                    voided_at: new Date().toISOString(),
                    voided_by: user?.name || 'unknown',
                    status: 'pending_sync'
                });
            });

            await adjustTempoDebt(sale, 0, 0);
            await loadSales();
            await useProductStore.getState().loadProducts({ silent: true });
            setVoidConfirm(null);
        } catch (error) {
            console.error(error);
            alert('Gagal void transaksi');
        } finally {
            setVoidLoading(false);
        }
    };

    const handleVoidItem = async (target: VoidItemTarget) => {
        const { sale, detail, detailIndex } = target;

        if (sale.local_id == null) {
            alert('Transaksi cloud-only belum bisa diubah dari perangkat ini. Coba lakukan dari perangkat asal transaksi.');
            return;
        }

        setVoidLoading(true);
        try {
            const nextSale = buildUpdatedSaleAfterItemVoid(sale, detailIndex);
            const remainingCount = sale.details.length - 1;

            await db.transaction('rw', db.products, db.inventory_movements, db.sale_queue, async () => {
                await restoreItemStock(sale, detail, `VOID item ${detail._productName || detail.product_id} dari #${sale.receipt_number}`);

                if (remainingCount <= 0) {
                    await db.sale_queue.update(sale.local_id!, {
                        voided: true,
                        voided_at: new Date().toISOString(),
                        voided_by: user?.name || 'unknown',
                        status: 'pending_sync'
                    });
                } else {
                    await db.sale_queue.update(sale.local_id!, {
                        ...nextSale,
                        details: nextSale.details.map(item => ({ ...item }))
                    });
                }
            });

            if (remainingCount <= 0) {
                await adjustTempoDebt(sale, 0, 0);
            } else {
                await adjustTempoDebt(sale, nextSale.total, nextSale.paid);
            }

            await loadSales();
            await useProductStore.getState().loadProducts({ silent: true });
            setVoidItemConfirm(null);
        } catch (error) {
            console.error(error);
            alert('Gagal void item transaksi');
        } finally {
            setVoidLoading(false);
        }
    };

    const getProductName = (productId: string, fallback?: string) =>
        fallback || products.find(product => product.id === productId)?.name || `${productId.slice(0, 12)}...`;

    const buildPrintableReceipt = (sale: OfflineSaleQueue) => {
        const customerName = sale.customer_id
            ? customers.find(customer => customer.id === sale.customer_id)?.name
            : undefined;

        return {
            receipt_number: sale.receipt_number,
            created_at: sale.created_at,
            cashier_name: user?.name,
            customer_name: customerName,
            items: sale.details.map(detail => ({
                name: getProductName(detail.product_id, detail._productName),
                unit_name: detail.unit_name,
                qty: detail.qty,
                price_per_unit: detail.price_per_unit,
                discount: detail.discount,
                subtotal: detail.subtotal,
            })),
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            paid: sale.paid,
            change: sale.change,
            payment_method: sale.payment_method,
            payment_breakdown: sale.payment_breakdown,
        };
    };

    const handlePrintSale = async (sale: OfflineSaleQueue) => {
        try {
            await printReceiptWithConfiguredMode(buildPrintableReceipt(sale));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal mencetak ulang struk.';
            alert(message);
        }
    };

    const totalRevenue = filteredSales
        .filter(sale => !sale.voided)
        .reduce((sum, sale) => sum + sale.total, 0);

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <History className="w-6 h-6 text-primary" /> Riwayat Transaksi
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">Semua transaksi - klik baris untuk detail, void penuh, atau void per item.</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
                    <p className="text-xs text-emerald-600 font-medium">Total Omset (filter)</p>
                    <p className="text-lg font-black text-emerald-700">Rp {totalRevenue.toLocaleString('id-ID')}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-sm bg-transparent" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-sm bg-transparent" />
                    </div>
                    <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Cari no. struk / nama barang..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label="Hapus pencarian"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary">
                        <option value="all">Semua Metode</option>
                        <option value="cash">Tunai</option>
                        <option value="transfer">Transfer</option>
                        <option value="tempo">Kasbon</option>
                        <option value="split">Split</option>
                        <option value="qris">QRIS</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} className="rounded" />
                        Tampilkan Void
                    </label>
                </div>
            </div>

            <div className="flex gap-3 flex-wrap text-sm">
                <span className="bg-white border rounded-lg px-3 py-1.5 font-semibold text-gray-700">{filteredSales.length} transaksi</span>
                <span className="bg-white border rounded-lg px-3 py-1.5 text-gray-500">{filteredSales.filter(sale => sale.voided).length} di-void</span>
                <span className="bg-white border rounded-lg px-3 py-1.5 text-gray-500">
                    {filteredSales.filter(sale => sale.payment_method === 'tempo' && !sale.voided).length} kasbon aktif
                </span>
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-gray-400">Memuat riwayat...</div>
                ) : filteredSales.length === 0 ? (
                    <div className="py-16 text-center text-gray-400">
                        <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Tidak ada transaksi dalam periode ini</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredSales.map((sale) => {
                            const key = saleKey(sale);
                            const isExpanded = expandedId === key;
                            const date = new Date(sale.created_at);
                            return (
                                <div key={key} className={`transition-colors ${sale.voided ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                                    <div
                                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                                        onClick={() => setExpandedId(isExpanded ? null : key)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-bold text-gray-800 text-sm">{sale.receipt_number}</span>
                                                {sale.voided && <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">VOID</span>}
                                                <span className="text-xs bg-slate-100 text-gray-600 px-2 py-0.5 rounded-full">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} - {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-base ${sale.voided ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                Rp {sale.total.toLocaleString('id-ID')}
                                            </p>
                                            <p className="text-xs text-gray-400">{sale.details.length} item</p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <button
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    void handlePrintSale(sale);
                                                }}
                                                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-2.5 py-1.5 rounded-lg transition-colors border border-blue-200 flex items-center gap-1"
                                                title="Cetak ulang struk transaksi"
                                            >
                                                <Printer className="w-3 h-3" /> Print Struk
                                            </button>
                                            {!sale.voided && (
                                                <button
                                                    onClick={event => {
                                                        event.stopPropagation();
                                                        setVoidConfirm(sale);
                                                    }}
                                                    className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-2.5 py-1.5 rounded-lg transition-colors border border-red-200"
                                                    title="Void seluruh transaksi"
                                                >
                                                    Void Semua
                                                </button>
                                            )}
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 bg-slate-50/50 border-t">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                                <div className="md:col-span-2">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Item Dibeli</p>
                                                    <div className="space-y-1.5">
                                                        {sale.details.map((detail, index) => (
                                                            <div key={`${sale.receipt_number}-${detail.product_id}-${index}`} className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg px-3 py-2 border">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="font-medium text-gray-700">{getProductName(detail.product_id, detail._productName)}</span>
                                                                    <span className="text-gray-400 ml-2">x {detail.qty} {detail.unit_name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="font-semibold text-gray-800 font-mono">Rp {detail.subtotal.toLocaleString('id-ID')}</span>
                                                                    {!sale.voided && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setVoidItemConfirm({ sale, detail, detailIndex: index })}
                                                                            className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold px-2.5 py-1.5 rounded-lg border border-orange-200"
                                                                            title="Void item ini saja"
                                                                        >
                                                                            Void Item
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Pembayaran</p>
                                                    <div className="bg-white rounded-lg border p-3 space-y-1.5 text-sm">
                                                        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>Rp {sale.subtotal.toLocaleString('id-ID')}</span></div>
                                                        {sale.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>- Rp {sale.discount.toLocaleString('id-ID')}</span></div>}
                                                        {sale.tax > 0 && <div className="flex justify-between text-gray-500"><span>Biaya Tambahan</span><span>Rp {sale.tax.toLocaleString('id-ID')}</span></div>}
                                                        <div className="flex justify-between font-bold border-t pt-1.5"><span>Total</span><span>Rp {sale.total.toLocaleString('id-ID')}</span></div>
                                                        <div className="flex justify-between text-gray-500"><span>Bayar</span><span>Rp {sale.paid.toLocaleString('id-ID')}</span></div>
                                                        <div className="flex justify-between text-emerald-700"><span>Kembali</span><span>Rp {sale.change.toLocaleString('id-ID')}</span></div>
                                                        {sale.payment_breakdown && (
                                                            <div className="rounded-lg bg-slate-50 border px-2 py-2 text-xs text-gray-500 space-y-1">
                                                                <div className="font-semibold text-gray-600">Rincian Split</div>
                                                                <div className="flex justify-between"><span>Tunai</span><span>Rp {(sale.payment_breakdown.cash || 0).toLocaleString('id-ID')}</span></div>
                                                                <div className="flex justify-between"><span>Transfer</span><span>Rp {(sale.payment_breakdown.transfer || 0).toLocaleString('id-ID')}</span></div>
                                                                <div className="flex justify-between"><span>QRIS</span><span>Rp {(sale.payment_breakdown.qris || 0).toLocaleString('id-ID')}</span></div>
                                                            </div>
                                                        )}
                                                        {sale.voided && (
                                                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                                                <p className="text-xs text-red-700 font-semibold">VOID oleh: {sale.voided_by}</p>
                                                                <p className="text-xs text-red-500">{sale.voided_at ? new Date(sale.voided_at).toLocaleString('id-ID') : ''}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {voidConfirm && (
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Void seluruh transaksi?</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Transaksi <span className="font-mono font-bold">{voidConfirm.receipt_number}</span> senilai{' '}
                                    <span className="font-bold text-red-600">Rp {voidConfirm.total.toLocaleString('id-ID')}</span> akan dibatalkan
                                    dan stok semua barang dikembalikan.
                                </p>
                                <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded-lg p-2">Aksi ini tidak dapat dibatalkan.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setVoidConfirm(null)} className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-slate-50">
                                Batal
                            </button>
                            <button
                                onClick={() => void handleVoid(voidConfirm)}
                                disabled={voidLoading}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-60"
                            >
                                {voidLoading ? 'Memproses...' : 'Ya, void transaksi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {voidItemConfirm && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Void item ini saja?</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Item <span className="font-semibold">{getProductName(voidItemConfirm.detail.product_id, voidItemConfirm.detail._productName)}</span>{' '}
                                    dari transaksi <span className="font-mono font-bold">{voidItemConfirm.sale.receipt_number}</span> akan dibatalkan dan stok item ini saja yang dikembalikan.
                                </p>
                                <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded-lg p-2">
                                    Total transaksi akan dihitung ulang otomatis. Jika ini item terakhir, transaksi akan menjadi VOID penuh.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setVoidItemConfirm(null)} className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-slate-50">
                                Batal
                            </button>
                            <button
                                onClick={() => void handleVoidItem(voidItemConfirm)}
                                disabled={voidLoading}
                                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-60"
                            >
                                {voidLoading ? 'Memproses...' : 'Ya, void item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
