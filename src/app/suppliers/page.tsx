'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupplierStore } from '@/store/supplierStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useProductStore } from '@/store/productStore';
import { supabase } from '@/lib/supabase';
import { Truck, Plus, Edit, Trash2, X, Phone, Mail, MapPin, Search, FileText, CheckSquare, Square, Wallet } from 'lucide-react';
import { db, OfflineSupplier, OfflineExpense } from '@/lib/dexie';

function SupplierModal({ supplier, onClose }: { supplier?: OfflineSupplier; onClose: () => void }) {
    const { addSupplier, updateSupplier } = useSupplierStore();
    const [form, setForm] = useState({
        name: supplier?.name || '',
        contact_person: supplier?.contact_person || '',
        phone: supplier?.phone || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        notes: supplier?.notes || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (supplier) {
                await updateSupplier(supplier.id, form);
            } else {
                await addSupplier(form);
            }
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center p-5 border-b">
                    <h2 className="text-lg font-bold text-gray-800">{supplier ? 'Edit Supplier' : 'Tambah Supplier'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nama Supplier *</label>
                        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" placeholder="PT. Suplai Bangunan Jaya" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nama Kontak (PIC)</label>
                            <input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" placeholder="Bapak Beni" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">No. HP / Telepon</label>
                            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" placeholder="08xx" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alamat</label>
                        <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan</label>
                        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm resize-none" placeholder="Term pembayaran, produk unggulan, dll." />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 border rounded-xl font-semibold text-gray-700 hover:bg-slate-50">Batal</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-primary hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60">
                            {loading ? 'Menyimpan...' : supplier ? 'Simpan Perubahan' : '+ Tambah Supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SupplierDebtModal({ supplier, onClose, products }: { supplier: OfflineSupplier; onClose: () => void; products: any[] }) {
    const { updateDebt } = useSupplierStore();
    const { activeBranch } = useBranchStore();
    const [type, setType] = useState<'add' | 'pay'>('add');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [backfilling, setBackfilling] = useState(false);

    const productMap = useMemo(() => new Map(products.map((product: any) => [product.id, product])), [products]);

    const handleBackfillTempo = async () => {
        setBackfilling(true);
        try {
            const movements = (await db.inventory_movements.toArray()).filter(m =>
                m.movement_type === 'IN' &&
                m.payment_status === 'tempo' &&
                m.supplier_id === supplier.id
            );

            if (movements.length === 0) {
                alert('Belum ada riwayat barang masuk tempo untuk supplier ini di perangkat ini.');
                return;
            }

            const estimatedTempoDebt = movements.reduce((sum, movement) => {
                const product = productMap.get(movement.product_id);
                const basePrice = Number(product?.base_price || 0);
                return sum + (Number(movement.qty || 0) * basePrice);
            }, 0);

            const currentDebt = Number(supplier.debt_balance || 0);
            const missingAmount = Math.max(0, Math.round((estimatedTempoDebt - currentDebt) * 100) / 100);

            if (missingAmount <= 0) {
                alert('Tidak ada selisih hutang yang perlu ditambahkan dari riwayat tempo lokal.');
                return;
            }

            const warning = `Sistem menemukan estimasi hutang tempo dari riwayat barang masuk sebesar Rp ${estimatedTempoDebt.toLocaleString('id-ID')}.

Saldo hutang supplier saat ini Rp ${currentDebt.toLocaleString('id-ID')}.

Akan ditambahkan selisih Rp ${missingAmount.toLocaleString('id-ID')} ke hutang supplier ini. Lanjutkan?`;
            if (!window.confirm(warning)) return;

            await updateDebt(supplier.id, missingAmount);
            alert(`Berhasil menambahkan backfill hutang supplier sebesar Rp ${missingAmount.toLocaleString('id-ID')}.`);
            onClose();
        } finally {
            setBackfilling(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseInt(amount.replace(/\D/g, ''), 10);
        if (!numAmount || numAmount <= 0) return alert('Nominal tidak valid');

        setLoading(true);
        try {
            if (type === 'add') {
                await updateDebt(supplier.id, numAmount);
            } else {
                if ((supplier.debt_balance || 0) < numAmount) {
                    return alert('Nominal bayar melebihi tagihan saat ini!');
                }
                // Kurangi hutang
                await updateDebt(supplier.id, -numAmount);

                // Ciptakan pengeluaran otomatis
                const expenseId = crypto.randomUUID();
                const expense: OfflineExpense = {
                    id: expenseId,
                    branch_id: activeBranch?.id,
                    category: 'Pembayaran Hutang Supplier',
                    amount: numAmount,
                    description: `Pmb. Hutang ke ${supplier.name}${notes ? ` - ${notes}` : ''}`,
                    expense_date: new Date().toISOString().split('T')[0],
                    payment_method: paymentMethod,
                    status: 'pending_sync',
                    created_at: new Date().toISOString()
                };
                await db.expenses.add(expense);
                if (navigator.onLine) {
                    supabase.from('expenses').insert([expense]).then();
                }
            }
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-5 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Catat Tagihan / Bayar</h2>
                        <p className="text-xs text-gray-500">{supplier.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button type="button" onClick={() => setType('add')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${type === 'add' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>Tambah Tagihan</button>
                        <button type="button" onClick={() => setType('pay')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${type === 'pay' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}>Bayar Tagihan</button>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-600">Terhutang Saat Ini:</span>
                        <span className="text-lg font-bold text-red-500 font-mono">Rp {(supplier.debt_balance || 0).toLocaleString('id-ID')}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nominal (Rp) *</label>
                            <input required value={amount} onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setAmount(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                            }} className="w-full p-3 font-mono text-lg font-bold border rounded-xl outline-none focus:ring-2 focus:ring-primary" placeholder="0" />
                        </div>

                        {type === 'pay' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Metode Pembayaran *</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value as any)}
                                    className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-white font-semibold"
                                >
                                    <option value="cash">💵 Tunai (Kas Laci)</option>
                                    <option value="kas_besar">🏠 Tunai (Kas Besar / Brankas)</option>
                                    <option value="transfer">🏦 Transfer Bank</option>
                                    <option value="qris">📱 QRIS</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan (No. Invoice, dll)</label>
                        <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm" placeholder="INV-2023-..." />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <button type="submit" disabled={loading || backfilling} className="w-full py-3 bg-primary hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60 mt-2">
                            {loading ? 'Menyimpan...' : 'Simpan Pembukuan'}
                        </button>
                        <button
                            type="button"
                            onClick={handleBackfillTempo}
                            disabled={loading || backfilling}
                            className="w-full py-2.5 border border-amber-200 bg-amber-50 text-amber-700 font-semibold rounded-xl hover:bg-amber-100 disabled:opacity-60"
                        >
                            {backfilling ? 'Memeriksa Riwayat Tempo...' : 'Perbaiki Hutang dari Riwayat Tempo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function SuppliersPage() {
    const { suppliers, loading, loadSuppliers, deleteSupplier } = useSupplierStore();
    const { products, loadProducts } = useProductStore();
    const [showModal, setShowModal] = useState(false);
    const [editSupplier, setEditSupplier] = useState<OfflineSupplier | undefined>();
    const [debtSupplier, setDebtSupplier] = useState<OfflineSupplier | undefined>();
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => { loadSuppliers(); loadProducts({ silent: true }); }, [loadSuppliers, loadProducts]);

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
        s.phone?.includes(search)
    );

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const allSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filtered.map(s => s.id)));

    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} supplier terpilih?`)) return;
        for (const id of Array.from(selectedIds)) await deleteSupplier(id);
        setSelectedIds(new Set());
    };

    const handleDelete = async (supplier: OfflineSupplier) => {
        if (confirm(`Hapus supplier "${supplier.name}"?`)) {
            await deleteSupplier(supplier.id);
        }
    };

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Truck className="w-6 h-6 text-primary" /> Manajemen Supplier
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">{suppliers.length} supplier terdaftar</p>
                </div>
                <div className="flex gap-2 items-center">
                    {filtered.length > 0 && (
                        <button onClick={toggleAll} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-slate-50 transition-colors">
                            {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            {allSelected ? 'Batal Semua' : 'Pilih Semua'}
                        </button>
                    )}
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                            <Trash2 className="w-4 h-4" /> Hapus {selectedIds.size}
                        </button>
                    )}
                    <button onClick={() => { setEditSupplier(undefined); setShowModal(true); }} className="flex items-center gap-2 bg-primary hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
                        <Plus className="w-4 h-4" /> Tambah Supplier
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari nama, kontak, atau no. HP..."
                    className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary bg-white"
                />
            </div>

            {/* Cards */}
            {loading ? (
                <div className="py-16 text-center text-gray-400">Memuat data supplier...</div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-gray-400 bg-white rounded-xl border">
                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{search ? 'Tidak ditemukan' : 'Belum ada supplier. Tambahkan supplier pertama!'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(supplier => (
                        <div key={supplier.id}
                            onClick={() => toggleSelect(supplier.id)}
                            className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all p-5 cursor-pointer relative ${selectedIds.has(supplier.id) ? 'border-primary ring-2 ring-primary/30 bg-emerald-50/30' : ''}`}
                        >
                            {/* Selection indicator */}
                            <div className="absolute top-3 left-3">
                                {selectedIds.has(supplier.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-gray-300" />}
                            </div>
                            <div className="flex items-start justify-between mb-2 pl-6">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-base">{supplier.name}</h3>
                                    {supplier.contact_person && (
                                        <p className="text-sm text-gray-500 mt-0.5">{supplier.contact_person}</p>
                                    )}
                                    {supplier.debt_balance ? (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-100 rounded-lg text-red-600">
                                            <Wallet className="w-3 h-3" />
                                            <span className="text-xs font-bold font-mono">Hutang: Rp {supplier.debt_balance.toLocaleString('id-ID')}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="space-y-1.5 text-sm mt-3 pl-6">
                                {supplier.phone && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="w-3.5 h-3.5 text-gray-400" /> {supplier.phone}
                                    </div>
                                )}
                                {supplier.email && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Mail className="w-3.5 h-3.5 text-gray-400" /> {supplier.email}
                                    </div>
                                )}
                                {supplier.address && (
                                    <div className="flex items-start gap-2 text-gray-600">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" /> {supplier.address}
                                    </div>
                                )}
                                {supplier.notes && (
                                    <div className="flex items-start gap-2 text-gray-500 text-xs bg-slate-50 rounded-lg p-2 mt-2">
                                        <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" /> {supplier.notes}
                                    </div>
                                )}
                            </div>
                            {supplier.created_at && (
                                <p className="text-[10px] text-gray-300 mt-3 pl-6">
                                    Ditambah {new Date(supplier.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-2 text-sm z-10 relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDebtSupplier(supplier); }}
                                    className="flex items-center gap-1.5 text-amber-600 font-medium hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-100 mr-auto"
                                >
                                    <Wallet className="w-4 h-4" /> Catat Tagihan/Bayar
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setEditSupplier(supplier); setShowModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Supplier"><Edit className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(supplier); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Supplier"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <SupplierModal
                    supplier={editSupplier}
                    onClose={() => { setShowModal(false); setEditSupplier(undefined); }}
                />
            )}

            {debtSupplier && (
                <SupplierDebtModal
                    supplier={debtSupplier}
                    products={products}
                    onClose={() => setDebtSupplier(undefined)}
                />
            )}
        </div>
    );
}
