'use client';

import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import { useCustomerStore } from '@/store/customerStore';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { Trash2, Trash, CreditCard, Receipt, LogOut, Printer, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSettingStore } from '@/store/settingStore';
import { ReceiptTemplate } from '@/components/pos/ReceiptTemplate';
import { printReceiptWithConfiguredMode } from '@/lib/receiptPrintService';
import { useSyncStatusStore } from '@/store/syncStatusStore';
import { useBranchStore } from '@/store/branchStore';

export function CartPanel() {
    const { items, updateQty, updateUnit, removeItem, clearCart, setPayment } = useCartStore();
    const unitConversions = useProductStore(state => state.unitConversions);
    const user = useAuthStore(state => state.user);
    const { customers, loadCustomers, updateDebt } = useCustomerStore();
    const { settings } = useSettingStore();
    const activeBranchId = useBranchStore(state => state.activeBranch?.id);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void loadCustomers(activeBranchId, { silent: true });
    }, [loadCustomers, activeBranchId]);

    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [splitCash, setSplitCash] = useState<string>('');
    const [splitTransfer, setSplitTransfer] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [manualCustomerName, setManualCustomerName] = useState('');
    const [lastReceipt, setLastReceipt] = useState<any>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [showCloseShift, setShowCloseShift] = useState(false);
    const [orderDiscountType, setOrderDiscountType] = useState<'rp' | 'pct'>('rp');
    const [orderDiscountValue, setOrderDiscountValue] = useState<string>('0');
    const [additionalFeeValue, setAdditionalFeeValue] = useState<string>('0');

    const subtotalBeforeDiscount = items.reduce((acc, item) => acc + (item.qty * item.pricePerUnit), 0);
    const itemsDiscountTotal = items.reduce((acc, item) => acc + (item.discountPerItem || 0), 0);
    const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
    const orderDiscountRp = orderDiscountType === 'rp'
        ? Math.min(parseFloat(orderDiscountValue) || 0, subtotal)
        : Math.round(subtotal * ((parseFloat(orderDiscountValue) || 0) / 100));
    const additionalFee = Math.max(0, parseFloat(additionalFeeValue) || 0);
    const total = Math.max(0, subtotal - orderDiscountRp + additionalFee);
    // For split payment: total paid = cash + transfer
    const splitTotal = paymentMethod === 'split'
        ? (parseFloat(splitCash) || 0) + (parseFloat(splitTransfer) || 0)
        : parseFloat(paymentAmount) || 0;
    const change = Math.max(0, splitTotal - total);

    const normalizeCustomerName = (value: string) => value.trim().replace(/\s+/g, ' ');

    const syncStockChangesToCloud = async (jobs: Array<{ movement: any; finalStock: number; productId: string; branchId?: string }>) => {
        if (!navigator.onLine || jobs.length === 0) return;

        const isUuid = (value?: string | null) =>
            !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const syncStatus = useSyncStatusStore.getState();

        await Promise.allSettled(jobs.map(async ({ movement, finalStock, productId, branchId }) => {
            const safeMovement = {
                ...movement,
                user_id: isUuid(movement.user_id) ? movement.user_id : null,
                branch_id: branchId || null,
                status: 'completed' as const
            };

            const [{ error: moveErr }, { error: prodErr }] = await Promise.all([
                supabase.from('inventory_movements').upsert([safeMovement], { onConflict: 'id' }),
                supabase.from('products').update({
                    current_stock: finalStock,
                    updated_at: new Date().toISOString()
                }).eq('id', productId)
            ]);

            if (!moveErr && !prodErr) {
                await db.inventory_movements.update(movement.id, { status: 'completed' });
            } else {
                const msg = moveErr?.message || prodErr?.message || 'Gagal update stok ke cloud';
                syncStatus.setError(`Gagal update stok produk ${productId}: ${msg}`);
            }
        }));
    };

    const handleCheckout = async () => {
        if (items.length === 0) return alert('Keranjang kosong!');
        if (isProcessingPayment) return;

        const paid = paymentMethod === 'split' ? splitTotal : (parseFloat(paymentAmount) || 0);
        const breakdown = paymentMethod === 'split'
            ? { cash: parseFloat(splitCash) || 0, transfer: parseFloat(splitTransfer) || 0 }
            : paymentMethod === 'tempo' && paid > 0
                ? { cash: paid }
                : undefined;

        if (paymentMethod === 'tempo') {
            if (!selectedCustomerId && !normalizeCustomerName(manualCustomerName)) return alert('Pilih pelanggan atau isi nama pelanggan terlebih dahulu untuk fitur Kasbon (Tempo)!');
            if (paid >= total) return alert('Nominal terlalu besar untuk Kasbon. Gunakan metode Tunai/Transfer.');
        } else if (paymentMethod === 'split') {
            if (paid < total) return alert(`Pembayaran kurang Rp ${(total - paid).toLocaleString('id-ID')}`);
        } else {
            if (paid < total) return alert('Uang bayar kurang dari total belanja!');
        }

        setIsProcessingPayment(true);

        try {
            const receipt_number = `INV-${Date.now()}`;
            const typedCustomerName = normalizeCustomerName(manualCustomerName);
            let customer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) || null : null;
            let customerId = customer?.id || selectedCustomerId || null;

            if (!customerId && typedCustomerName) {
                customer = customers.find(c =>
                    normalizeCustomerName(c.name).toLowerCase() === typedCustomerName.toLowerCase()
                    && ((c.branch_id || '') === (activeBranchId || ''))
                ) || null;

                if (!customer) {
                    customer = {
                        id: crypto.randomUUID(),
                        branch_id: activeBranchId || undefined,
                        name: typedCustomerName,
                        phone: '',
                        address: '',
                        debt_balance: 0,
                        updated_at: new Date().toISOString(),
                    };

                    await db.customers.add(customer);
                    if (navigator.onLine) {
                        const { error: customerError } = await supabase.from('customers').insert([customer]);
                        if (customerError) {
                            console.warn('Gagal sync pelanggan manual ke cloud:', customerError.message);
                        }
                    }
                    void loadCustomers(activeBranchId, { silent: true });
                }

                customerId = customer.id;
                setSelectedCustomerId(customer.id);
            }

            const newSale = {
                receipt_number,
                branch_id: activeBranchId || undefined,
                user_id: user?.id || null,
                customer_id: customerId,
                subtotal,
                discount: orderDiscountRp,
                tax: additionalFee,
                total,
                paid,
                change: paymentMethod === 'tempo' ? 0 : change,
                payment_method: paymentMethod,
                payment_breakdown: breakdown,
                status: 'pending_sync' as const,
                created_at: new Date().toISOString(),
                details: items.map(item => {
                    const base_qty_calc = Number((item.qty / item.unitMultiplier).toFixed(3));
                    const cogs_subtotal = item.product.base_price * base_qty_calc;
                    return {
                        product_id: item.product.id,
                        _productName: item.product.name,
                        unit_name: item.selectedUnit,
                        unit_multiplier: item.unitMultiplier,
                        qty: item.qty,
                        base_qty: base_qty_calc,
                        price_per_unit: item.pricePerUnit,
                        discount: item.discountPerItem || 0,
                        subtotal: item.subtotal,
                        cogs_subtotal,
                    };
                })
            };

            const receiptForPrint = {
                ...newSale,
                cashier_name: user?.name,
                customer_name: customer?.name || typedCustomerName || undefined,
                items: items.map(item => ({
                    name: item.product.name,
                    unit_name: item.selectedUnit,
                    qty: item.qty,
                    price_per_unit: item.pricePerUnit,
                    discount: item.discountPerItem || 0,
                    subtotal: item.subtotal,
                }))
            };

            const stockSyncJobs: Array<{ movement: any; finalStock: number; productId: string; branchId?: string }> = [];

            await db.transaction('rw', db.sale_queue, db.products, db.inventory_movements, async () => {
                await db.sale_queue.add(newSale);

                for (const item of items) {
                    const p = await db.products.get(item.product.id);
                    if (!p) continue;

                    const baseQtySold = item.qty / item.unitMultiplier;
                    const finalStock = Number((p.current_stock - baseQtySold).toFixed(3));
                    p.current_stock = finalStock;
                    p.updated_at = new Date().toISOString();
                    await db.products.put(p);
                    useProductStore.getState().updateStock(item.product.id, finalStock);

                    const movement = {
                        id: crypto.randomUUID(),
                        product_id: item.product.id,
                        user_id: user?.id || undefined,
                        movement_type: 'OUT' as const,
                        qty: baseQtySold,
                        notes: `Penjualan #${receipt_number}`,
                        reference_id: receipt_number,
                        status: 'pending_sync' as const,
                        created_at: new Date().toISOString()
                    };
                    await db.inventory_movements.add(movement);
                    stockSyncJobs.push({ movement, finalStock, productId: item.product.id, branchId: activeBranchId || undefined });
                }
            });

            if (paymentMethod === 'tempo' && customerId) {
                const addedDebt = total - paid;
                await updateDebt(customerId, addedDebt);
            }

            // Show success modal immediately after local transaction is safe
            setLastReceipt(receiptForPrint);
            setShowSuccessModal(true);

            // Refresh local product cache so stok langsung terlihat berkurang di UI
            await useProductStore.getState().loadProducts({ silent: true });

            // Clear state
            clearCart();
            setPaymentAmount('');
            setSplitCash('');
            setSplitTransfer('');
            setAdditionalFeeValue('0');
            setSelectedCustomerId('');
            setManualCustomerName('');

            void syncStockChangesToCloud(stockSyncJobs);

            // Trigger event for Dashboard refresh and immediate sync
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sales-changed'));
                window.dispatchEvent(new CustomEvent('trigger-sync'));
            }

        } catch (error) {
            console.error(error);
            alert('Gagal memproses transaksi.');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handlePrint = async () => {
        if (!lastReceipt) return;
        try {
            await printReceiptWithConfiguredMode(lastReceipt);
            setShowSuccessModal(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal mencetak struk.';
            alert(message);
        }
    };

    const [showSuccessModal, setShowSuccessModal] = useState(false);

    return (
        <>
            <div className="flex flex-col h-full bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 w-full relative print:hidden overflow-x-hidden">
                <div className="px-3 py-2 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="text-sm font-bold flex items-center gap-1.5 text-gray-800">
                        <Receipt className="w-3.5 h-3.5 text-primary" /> Pesanan Saat Ini
                    </h2>
                    <div className="flex gap-1">
                        {items.length > 0 && (
                            <button onClick={clearCart} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Kosongkan Keranjang">
                                <Trash className="w-3 h-3" />
                            </button>
                        )}
                        <button onClick={() => setShowCloseShift(true)} className="flex items-center gap-1 text-[11px] bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-700 font-semibold px-2 py-1 rounded-lg transition-colors" title="Catat & Tutup Kasir Hari Ini">
                            <LogOut className="w-2.5 h-2.5" /> Tutup Shift
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                            <ShoppingCart className="w-16 h-16 mb-4 text-gray-200" />
                            <p>Keranjang masih kosong</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <CartItemRow
                                key={item.id}
                                item={item}
                                unitConversions={unitConversions}
                                updateQty={updateQty}
                                updateUnit={updateUnit}
                                removeItem={removeItem}
                            />
                        ))
                    )}
                </div>

                <div className="border-t bg-slate-50 p-3 space-y-3 flex-none overflow-y-auto max-h-[42%] lg:max-h-[42vh] pb-4">

                    {/* Total Diskon Satuan (per-item discounts total) */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                            Total Diskon Satuan
                            <span className="text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5">Otomatis</span>
                        </span>
                        <span className="font-semibold text-red-500">- Rp {itemsDiscountTotal.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Order-level discount */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b">
                            <span className="text-xs font-semibold text-gray-600 flex-1">Diskon Pesanan</span>
                            <div className="flex bg-white rounded border overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { setOrderDiscountType('rp'); setOrderDiscountValue('0'); }}
                                    className={`px-2.5 py-1 text-xs font-bold transition-colors ${orderDiscountType === 'rp' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-slate-100'}`}
                                >Rp</button>
                                <button
                                    type="button"
                                    onClick={() => { setOrderDiscountType('pct'); setOrderDiscountValue('0'); }}
                                    className={`px-2.5 py-1 text-xs font-bold transition-colors ${orderDiscountType === 'pct' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-slate-100'}`}
                                >%</button>
                            </div>
                        </div>
                        <div className="px-3 py-2 flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max={orderDiscountType === 'pct' ? 100 : undefined}
                                value={orderDiscountValue}
                                onChange={e => setOrderDiscountValue(e.target.value)}
                                placeholder="0"
                                className="flex-1 p-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-primary font-mono"
                            />
                            {orderDiscountRp > 0 && (
                                <span className="text-xs text-red-500 font-semibold whitespace-nowrap">- Rp {orderDiscountRp.toLocaleString('id-ID')}</span>
                            )}
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b">
                            <span className="text-xs font-semibold text-gray-600 flex-1">Biaya Tambahan (Ongkir/Lainnya)</span>
                        </div>
                        <div className="px-3 py-2 flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                value={additionalFeeValue}
                                onChange={e => setAdditionalFeeValue(e.target.value)}
                                placeholder="0"
                                className="flex-1 p-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-primary font-mono"
                            />
                            {additionalFee > 0 && (
                                <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">+ Rp {additionalFee.toLocaleString('id-ID')}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-xl border-t pt-2">
                        <span className="font-bold text-gray-800">Total</span>
                        <span className="font-black text-primary">Rp {total.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-2">
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Pelanggan {paymentMethod === 'tempo' ? '(Wajib)' : '(Opsional)'}</label>
                            <input
                                type="text"
                                value={manualCustomerName}
                                onChange={e => {
                                    setManualCustomerName(e.target.value);
                                    if (e.target.value.trim()) setSelectedCustomerId('');
                                }}
                                placeholder="Ketik nama pelanggan manual..."
                                className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary bg-white text-sm ${(paymentMethod === 'tempo' && !selectedCustomerId && !normalizeCustomerName(manualCustomerName)) ? 'border-red-400 focus:ring-red-500' : ''}`}
                            />
                            <select
                                value={selectedCustomerId}
                                onChange={e => {
                                    const nextValue = e.target.value;
                                    setSelectedCustomerId(nextValue);
                                    if (nextValue) setManualCustomerName('');
                                }}
                                className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary bg-white text-sm ${(paymentMethod === 'tempo' && !selectedCustomerId && !normalizeCustomerName(manualCustomerName)) ? 'border-red-400 focus:ring-red-500' : ''}`}
                            >
                                <option value="">-- Pelanggan Umum / Pilih pelanggan tersimpan --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-400">Bisa ketik nama manual langsung, atau pilih pelanggan tersimpan jika ingin pakai data yang sudah ada.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Metode Bayar</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                            >
                                <option value="cash">Tunai</option>
                                <option value="transfer">Transfer Bank</option>
                                <option value="qris">QRIS</option>
                                <option value="split">Split (Tunai + Transfer)</option>
                                <option value="tempo">Tempo (Kredit)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                {paymentMethod === 'split' ? 'Jumlah Bayar (otomatis dari split)' : paymentMethod === 'tempo' ? 'Dibayar Sekarang' : 'Jumlah Bayar'}
                            </label>
                            <input
                                type="number"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                placeholder={paymentMethod === 'split' ? 'Diisi via Tunai/Transfer' : paymentMethod === 'tempo' ? 'Isi nominal yang dibayar sekarang' : '0'}
                                disabled={paymentMethod === 'split'}
                            />
                        </div>
                    </div>

                    {paymentMethod === 'split' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Tunai</label>
                                <input
                                    type="number"
                                    value={splitCash}
                                    onChange={e => setSplitCash(e.target.value)}
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Transfer</label>
                                <input
                                    type="number"
                                    value={splitTransfer}
                                    onChange={e => setSplitTransfer(e.target.value)}
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    )}

                    {(paymentMethod === 'split' ? splitTotal > 0 : !!paymentAmount) && splitTotal >= total ? (
                        <div className="flex justify-between items-center text-sm bg-emerald-50 text-emerald-700 p-2.5 rounded-lg border border-emerald-200">
                            <span className="font-medium">Kembalian</span>
                            <span className="font-bold text-lg">Rp {change.toLocaleString('id-ID')}</span>
                        </div>
                    ) : null}

                    {paymentMethod === 'tempo' && (
                        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
                            Uang yang Anda isi di kolom <strong>Dibayar Sekarang</strong> akan dianggap <strong>tunai masuk laci</strong>. Sisanya otomatis menjadi kasbon pelanggan.
                        </div>
                    )}

                    {items.length > 0 && paymentMethod !== 'tempo' && (paymentMethod === 'split' ? splitTotal <= 0 : !paymentAmount) && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                            ⚠️ Isi <strong>{paymentMethod === 'split' ? 'Tunai / Transfer' : 'Jumlah Bayar'}</strong> terlebih dahulu
                        </p>
                    )}

                    <button
                        onClick={handleCheckout}
                        disabled={isProcessingPayment || items.length === 0 || (paymentMethod !== 'tempo' && (paymentMethod === 'split' ? splitTotal <= 0 : (!paymentAmount || parseFloat(paymentAmount) <= 0)))}
                        className="w-full py-3.5 bg-primary hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CreditCard className="w-5 h-5" />
                        {isProcessingPayment ? 'Memproses...' : 'Proses Pembayaran'}
                    </button>

                </div>
            </div>

            {/* HIDDEN PRINT RECEIPT (58mm) */}
            {lastReceipt && (
                <div className="hidden print:block absolute top-0 left-0 w-[58mm] bg-white text-black font-mono text-[11px] z-50 p-2" id="printSection">
                    <div className="text-center font-bold text-sm mb-1 uppercase">Toko Bangunan ERP</div>
                    <div className="text-center text-[10px] mb-2 border-b pb-2 border-dashed border-black">Jl. Contoh Bangunan No. 123<br />Telp: 08123456789</div>

                    <div className="text-[10px] mb-2 flex justify-between">
                        <span>{new Date(lastReceipt.created_at).toLocaleString('id-ID')}</span>
                        <span>Opr: {user?.name?.split(' ')[0] || 'Admin'}</span>
                    </div>
                    <div className="text-[10px] mb-2 border-b pb-1 border-dashed border-black">
                        Nota: {lastReceipt.receipt_number}
                    </div>

                    <div className="py-1 border-b border-dashed border-black mb-2">
                        {lastReceipt.details.map((detail: any, i: number) => (
                            <div key={i} className="mb-1">
                                <div className="text-[10px] uppercase truncate">{detail._productName}</div>
                                <div className="text-[10px] flex justify-between mt-0.5">
                                    <span>{detail.qty} {detail.unit_name} x {detail.price_per_unit.toLocaleString('id-ID')}</span>
                                    <span>{detail.subtotal.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {lastReceipt.tax > 0 && (
                        <div className="text-[10px] flex justify-between mb-1">
                            <span>BIAYA TAMBAHAN</span>
                            <span>Rp {lastReceipt.tax.toLocaleString('id-ID')}</span>
                        </div>
                    )}
                    <div className="text-[10px] flex justify-between font-bold mb-1">
                        <span>TOTAL</span>
                        <span>Rp {lastReceipt.total.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-[10px] flex justify-between">
                        <span>BAYAR ({lastReceipt.payment_method.toUpperCase()})</span>
                        <span>Rp {lastReceipt.paid.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-[10px] flex justify-between mb-2">
                        <span>KEMBALI</span>
                        <span>Rp {lastReceipt.change.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="text-center text-[10px] border-t border-dashed border-black pt-2 uppercase mt-2">
                        Terima Kasih<br />Tetap Membangun Bersama Kami
                    </div>
                </div>
            )}

            {/* CLOSE SHIFT MODAL LAUNCHER */}
            {showCloseShift && <CloseShiftModal onClose={() => setShowCloseShift(false)} />}

            {/* TRANSACTION SUCCESS MODAL */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="bg-emerald-500 p-8 text-white text-center">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-2xl font-black mb-1">Transaksi Sukses!</h3>
                            <p className="text-emerald-50 opacity-90">Pembayaran telah diterima</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
                                <span className="text-slate-500 font-medium text-sm text-gray-500">Kembalian</span>
                                <span className="text-2xl font-black text-emerald-600">Rp {lastReceipt?.change?.toLocaleString('id-ID')}</span>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => void handlePrint()}
                                    className="w-full py-4 bg-primary hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-100"
                                >
                                    <Printer className="w-5 h-5" />
                                    Cetak Struk (58mm)
                                </button>
                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all"
                                >
                                    Selesai (Tanpa Cetak)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: CartItemRow (to handle local string state for Qty)
// ─────────────────────────────────────────────────────────────────────────────
function CartItemRow({ item, unitConversions, updateQty, updateUnit, removeItem }: {
    item: any;
    unitConversions: any[];
    updateQty: (id: string, qty: number) => void;
    updateUnit: (id: string, newUnit: string, conversions: any[]) => void;
    removeItem: (id: string) => void;
}) {
    const [localQty, setLocalQty] = useState<string>(item.qty.toString());
    const productConversions = unitConversions.filter(c => c.product_id === item.product.id);

    // Sync from store if store changes externally (like clicking card again)
    useEffect(() => {
        setLocalQty(item.qty.toString());
    }, [item.qty]);

    return (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col group transition-shadow hover:shadow-md">
            <div className="px-3 py-2 flex justify-between gap-2 border-b bg-slate-50/80 group-hover:bg-slate-50">
                <span className="font-bold text-gray-800 flex-1 leading-tight text-sm line-clamp-1">{item.product.name}</span>
                <span className="font-black text-primary text-sm whitespace-nowrap">Rp {item.subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="p-2.5 flex items-center gap-2 bg-white">
                <div className="w-16 shrink-0">
                    <input
                        type="number"
                        step="any"
                        value={localQty}
                        onChange={(e) => {
                            setLocalQty(e.target.value);
                            const parsed = parseFloat(e.target.value);
                            if (!isNaN(parsed)) {
                                updateQty(item.id, parsed);
                            }
                        }}
                        placeholder="0"
                        className="w-full text-center border-2 border-slate-100 rounded-lg py-1 text-sm font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <select
                        value={item.selectedUnit}
                        onChange={(e) => updateUnit(item.id, e.target.value, productConversions)}
                        className="w-full border-2 border-slate-100 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white text-xs font-semibold text-gray-600 truncate"
                    >
                        <option value={item.product.base_unit}>{item.product.base_unit}</option>
                        {productConversions.map((c: any) => (
                            <option key={c.id} value={c.unit_name}>{c.unit_name}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    title="Hapus"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

import { CloseShiftModal } from '@/components/pos/CloseShiftModal';
