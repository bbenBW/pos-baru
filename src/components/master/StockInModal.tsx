'use client';

import { useState, useEffect } from 'react';
import { useProductStore } from '@/store/productStore';
import { useAuthStore } from '@/store/authStore';
import { useSupplierStore } from '@/store/supplierStore';
import { useBranchStore } from '@/store/branchStore';
import { OfflineProduct, OfflineUnitConversion, OfflineExpense } from '@/lib/dexie';
import { X, ArrowDownCircle, DollarSign, Tag, Truck } from 'lucide-react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

interface Props {
    product: OfflineProduct;
    conversions: OfflineUnitConversion[];
    onClose: () => void;
}

export function StockInModal({ product, conversions, onClose }: Props) {
    const receiveStock = useProductStore(state => state.receiveStock);
    const { suppliers, loadSuppliers, updateDebt } = useSupplierStore();
    const { user } = useAuthStore();
    const { activeBranch } = useBranchStore();

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    const [supplierId, setSupplierId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'lunas' | 'tempo'>('lunas');
    const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'qris'>('cash');

    const [qty, setQty] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Price update fields
    const [newBasePrice, setNewBasePrice] = useState<string>(String(product.base_price || ''));
    const [newSellPrice, setNewSellPrice] = useState<string>(String(product.sell_price || ''));
    const [newSmallUnitPrice, setNewSmallUnitPrice] = useState<string>(
        conversions.length > 0 ? String(conversions[0].price || '') : ''
    );

    const hasSmallUnit = conversions.length > 0;
    const smallUnitName = hasSmallUnit ? conversions[0].unit_name : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const added = parseFloat(qty);
        if (isNaN(added) || added <= 0) {
            return alert(`Jumlah ${product.base_unit} masuk harus lebih dari 0`);
        }

        setLoading(true);
        try {
            const latest = await db.products.get(product.id);
            const latestTs = latest?.updated_at ? new Date(latest.updated_at).getTime() : 0;
            const editTs = product.updated_at ? new Date(product.updated_at).getTime() : 0;
            if (latest && latestTs > editTs) {
                const ok = confirm(
                    'Stok produk ini sudah berubah dari perangkat lain. Lanjutkan akan menimpa perubahan terbaru. Lanjutkan?'
                );
                if (!ok) {
                    setLoading(false);
                    return;
                }
            }

            const priceUpdates = {
                newBasePrice: newBasePrice ? parseFloat(newBasePrice) : undefined,
                newSellPrice: newSellPrice ? parseFloat(newSellPrice) : undefined,
                newSmallUnitPrice: (hasSmallUnit && newSmallUnitPrice) ? parseFloat(newSmallUnitPrice) : undefined,
            };

            await receiveStock(product.id, added, notes, user?.id || 'system', priceUpdates, {
                supplier_id: supplierId || undefined,
                payment_status: supplierId ? paymentMethod : undefined
            });

            const totalCostFinal = added * (newBasePrice ? parseFloat(newBasePrice) : (product.base_price || 0));

            if (supplierId && totalCostFinal > 0) {
                if (paymentMethod === 'tempo') {
                    await updateDebt(supplierId, totalCostFinal);
                } else {
                    const supplier = suppliers.find(s => s.id === supplierId);
                    const expenseId = crypto.randomUUID();
                    const expense: OfflineExpense = {
                        id: expenseId,
                        branch_id: activeBranch?.id,
                        category: 'Pembelian Stok (Tunai)',
                        amount: totalCostFinal,
                        description: `Pembelian stok ${product.name} dari ${supplier?.name || ''}${notes ? ` - ${notes}` : ''}`,
                        expense_date: new Date().toISOString().split('T')[0],
                        payment_method: paymentType,
                        status: 'pending_sync',
                        created_at: new Date().toISOString()
                    };
                    await db.expenses.add(expense);
                    if (navigator.onLine) {
                        supabase.from('expenses').insert([expense]).then();
                    }
                }
            }

            onClose();
        } catch (error) {
            console.error(error);
            alert('Gagal menambah stok');
        } finally {
            setLoading(false);
        }
    };

    const totalCostEstimate = qty && newBasePrice ? parseFloat(qty) * parseFloat(newBasePrice) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b bg-emerald-50">
                    <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                        <ArrowDownCircle className="w-5 h-5" /> Terima Barang Masuk
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
                    {/* Product Info */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-500 mb-1">Produk Target:</p>
                        <p className="font-bold text-slate-800 text-lg">{product.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Stok Saat Ini: <span className="font-bold text-slate-700">{parseFloat(Number(product.current_stock).toFixed(3))} {product.base_unit}</span>
                        </p>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            📦 Jumlah Masuk ({product.base_unit}) *
                        </label>
                        <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            autoFocus
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            className="w-full text-2xl font-bold p-3 text-center rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                            placeholder="0"
                        />
                    </div>

                    {/* Price Update Section */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 border-b flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            <p className="text-sm font-bold text-blue-800">Update Harga (opsional, biarkan jika tidak ada perubahan)</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* New Base Price (Cost) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                                    💰 Harga Modal / {product.base_unit}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newBasePrice}
                                        onChange={e => setNewBasePrice(e.target.value)}
                                        className="w-full pl-8 pr-4 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none text-sm font-mono"
                                        placeholder={String(product.base_price)}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">HPP terkini: Rp {Number(product.base_price).toLocaleString('id-ID')}</p>
                            </div>

                            {/* New Sell Price (Base Unit) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                                    <Tag className="w-3 h-3 inline mr-1" />
                                    Harga Jual / {product.base_unit}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newSellPrice}
                                        onChange={e => setNewSellPrice(e.target.value)}
                                        className="w-full pl-8 pr-4 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none text-sm font-mono"
                                        placeholder={String(product.sell_price)}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Harga jual terkini: Rp {Number(product.sell_price).toLocaleString('id-ID')}</p>
                            </div>

                            {/* Small Unit Sell Price */}
                            {hasSmallUnit && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                                        <Tag className="w-3 h-3 inline mr-1" />
                                        Harga Jual / {smallUnitName} (satuan kecil)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newSmallUnitPrice}
                                            onChange={e => setNewSmallUnitPrice(e.target.value)}
                                            className="w-full pl-8 pr-4 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 outline-none text-sm font-mono"
                                            placeholder={String(conversions[0].price || '(belum diset)')}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Harga satuan kecil terkini: Rp {Number(conversions[0].price || 0).toLocaleString('id-ID')} / {smallUnitName}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cost Estimate */}
                    {totalCostEstimate > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between items-center">
                            <p className="text-sm text-amber-800 font-medium">Estimasi Total Modal Masuk:</p>
                            <p className="text-lg font-black text-amber-700">Rp {totalCostEstimate.toLocaleString('id-ID')}</p>
                        </div>
                    )}

                    {/* Supplier & Payment Options */}
                    <div className="border rounded-xl p-4 bg-slate-50 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="w-4 h-4 text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-700">Data Pemasok & Pembayaran (Opsional)</h3>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Pilih Supplier
                            </label>
                            <select
                                value={supplierId}
                                onChange={e => {
                                    setSupplierId(e.target.value);
                                    if (!e.target.value) setPaymentMethod('lunas');
                                }}
                                className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-400 outline-none text-sm bg-white"
                            >
                                <option value="">-- Tanpa Pemasok (Penyesuaian Stok Biasa) --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.contact_person ? `(${s.contact_person})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        {supplierId && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                    Metode Pembayaran
                                </label>
                                <div className="flex gap-2 bg-white p-1 rounded-lg border">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('lunas')}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${paymentMethod === 'lunas' ? 'bg-emerald-500 text-white shadow' : 'text-gray-500 hover:bg-slate-50'}`}
                                    >
                                        Lunas (Tunai)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('tempo')}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${paymentMethod === 'tempo' ? 'bg-amber-500 text-white shadow' : 'text-gray-500 hover:bg-slate-50'}`}
                                    >
                                        Tempo (Hutang)
                                    </button>
                                </div>

                                {paymentMethod === 'lunas' && (
                                    <div className="mt-3 bg-white p-3 rounded-lg border border-emerald-100">
                                        <label className="block text-[11px] font-bold text-emerald-700 mb-1.5 uppercase">Sumber Dana (Metode Bayar) *</label>
                                        <select
                                            value={paymentType}
                                            onChange={e => setPaymentType(e.target.value as any)}
                                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-sm bg-slate-50 font-semibold"
                                        >
                                            <option value="cash">💵 Tunai (Kas Laci)</option>
                                            <option value="kas_besar">🏠 Tunai (Kas Besar / Brankas)</option>
                                            <option value="transfer">🏦 Transfer Bank</option>
                                            <option value="qris">📱 QRIS</option>
                                        </select>
                                    </div>
                                )}

                                <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                                    {paymentMethod === 'lunas'
                                        ? '* Pembelian lunas akan otomatis tercatat sebagai "Pengeluaran" hari ini.'
                                        : '* Uang kas tidak berkurang, tapi otomatis menambah saldo Hutang pada Supplier tersebut.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            📝 SJ / Catatan / Pemasok
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            placeholder="Misal: Surat Jalan INV-999 dari PT Semen Bima, dibawa Pak Beni"
                        />
                    </div>

                    <div className="pt-2 pb-1">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 text-lg"
                        >
                            {loading ? 'Menyimpan...' : `✓ Tambah Stok + Update Harga`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
