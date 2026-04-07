'use client';

import { useState, useEffect } from 'react';
import { db, OfflineInventoryMovement, OfflineProduct, OfflineSupplier } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Receipt, Search, ArrowDownCircle, Tag, CreditCard, Calendar, RefreshCw, Trash2, CheckSquare, Square } from 'lucide-react';
import { useProductStore } from '@/store/productStore';
import { useSync } from '@/hooks/useSync';

interface EnrichedMovement extends OfflineInventoryMovement {
    productName: string;
    productBaseUnit: string;
    supplierName?: string;
    supplierContact?: string;
    costEstimate: number; // calculated from historical price or current base price
}

export default function IncomingPage() {
    const { products, loadProducts } = useProductStore();
    const [movements, setMovements] = useState<EnrichedMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    // Default to this month
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { deleteMovements } = useProductStore();
    const { syncOfflineData } = useSync();

    const loadData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            // 1. Sync from Supabase first if online
            if (navigator.onLine) {
                try {
                    if (isManual) {
                        await syncOfflineData();
                    }

                    const { data: remoteMovements, error } = await supabase
                        .from('inventory_movements')
                        .select('*')
                        .eq('movement_type', 'IN');

                    if (!error && remoteMovements) {
                        const localRaw = await db.inventory_movements.toArray();
                        const remoteIds = new Set(remoteMovements.map((m: any) => m.id));

                        // Delete local 'completed' records that are no longer on server (sync delete)
                        const idsToDelete = localRaw
                            .filter(m => m.status === 'completed' && m.movement_type === 'IN' && !remoteIds.has(m.id))
                            .map(m => m.id);

                        if (idsToDelete.length > 0) {
                            console.log(`Sync: Cleaning up ${idsToDelete.length} deleted records`);
                            await db.inventory_movements.bulkDelete(idsToDelete);
                        }

                        if (remoteMovements.length > 0) {
                            const localMap = new Map(localRaw.map(m => [m.id, m]));
                            const merged = remoteMovements.map((m: OfflineInventoryMovement) => {
                                const local = localMap.get(m.id);
                                if (local && local.status === 'pending_sync') return local;
                                return m;
                            });
                            await db.inventory_movements.bulkPut(merged);
                        }
                    }
                } catch (syncErr) {
                    console.error("Manual sync failed:", syncErr);
                }
            }

            // 2. Fetch all raw movements and filter in memory since movement_type is not indexed
            const allMovements = await db.inventory_movements.toArray();
            const rawMovements = allMovements
                .filter(m => m.movement_type === 'IN')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Fetch suppliers for joining
            const suppliersMap = new Map<string, OfflineSupplier>();
            const suppliers = await db.suppliers.toArray();
            suppliers.forEach(s => suppliersMap.set(s.id, s));

            // Join with products & suppliers
            const productMap = new Map<string, OfflineProduct>();
            products.forEach(p => productMap.set(p.id, p));

            const startDt = new Date(startDate);
            startDt.setHours(0, 0, 0, 0);
            const endDt = new Date(endDate);
            endDt.setHours(23, 59, 59, 999);

            let filtered = rawMovements.filter(m => {
                const mDate = new Date(m.created_at);
                if (mDate < startDt || mDate > endDt) return false;
                return true;
            });

            const enriched: EnrichedMovement[] = filtered.map(m => {
                const prod = productMap.get(m.product_id);
                const supp = m.supplier_id ? suppliersMap.get(m.supplier_id) : undefined;

                const basePrice = prod?.base_price || 0;

                return {
                    ...m,
                    productName: prod?.name || 'Produk Dihapus / Tidak Diketahui',
                    productBaseUnit: prod?.base_unit || '-',
                    supplierName: supp?.name,
                    supplierContact: supp?.contact_person,
                    costEstimate: m.qty * basePrice
                };
            });

            setMovements(enriched);
        } catch (err) {
            console.error("Failed to load incoming movements", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDelete = async (ids: string[]) => {
        if (!window.confirm(`Hapus ${ids.length} data riwayat terpilih? Stok produk terkait akan otomatis dikurangi.`)) return;

        try {
            setLoading(true);
            await deleteMovements(ids);
            // Optimistic UI: remove from local state immediately
            setMovements(prev => prev.filter(m => !ids.includes(m.id)));
            setSelectedIds([]);
            await loadData();
        } catch (err) {
            console.error("Failed to delete movements", err);
            alert("Gagal menghapus data.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredMovements.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredMovements.map(m => m.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        loadProducts({ silent: true });
    }, [loadProducts]);

    useEffect(() => {
        loadData();
    }, [startDate, endDate, products]);

    const filteredMovements = movements.filter(m => {
        const q = search.toLowerCase();
        return (
            m.productName.toLowerCase().includes(q) ||
            m.reference_id?.toLowerCase().includes(q) ||
            m.notes?.toLowerCase().includes(q) ||
            m.supplierName?.toLowerCase().includes(q)
        );
    });

    const totalKuantitas = filteredMovements.reduce((acc, curr) => acc + curr.qty, 0);
    const totalEstimasiBelanja = filteredMovements.reduce((acc, curr) => acc + curr.costEstimate, 0);

    return (
        <div className="w-full h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Receipt className="w-6 h-6 text-emerald-600" /> Riwayat Pembelian (Barang Masuk)
                    </h1>
                    <p className="text-gray-500 text-sm">Monitor riwayat penerimaan stok, data supplier asal, dan tagihan masuk.</p>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={refreshing || loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : 'text-gray-500'}`} />
                    {refreshing ? 'Menyinkronkan...' : 'Sinkronisasi Data'}
                </button>
                {selectedIds.length > 0 && (
                    <button
                        onClick={() => handleDelete(selectedIds)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Hapus Terpilih ({selectedIds.length})
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center bg-gradient-to-br from-emerald-50 to-white">
                    <div className="p-3 bg-emerald-100 rounded-lg mr-4 text-emerald-600">
                        <ArrowDownCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Dokumen IN</p>
                        <p className="text-xl font-bold text-emerald-700">{filteredMovements.length} Trx</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg mr-4 text-blue-600">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Item Masuk</p>
                        <p className="text-xl font-bold text-gray-800">{totalKuantitas.toLocaleString('id-ID')} unit</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center bg-gradient-to-br from-amber-50 to-white md:col-span-2">
                    <div className="p-3 bg-amber-100 rounded-lg mr-4 text-amber-600">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Estimasi Modal Pembelian Tertera</p>
                        <p className="text-xl font-bold text-amber-700">Rp {totalEstimasiBelanja.toLocaleString('id-ID')}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col flex-1">
                {/* Toolbar */}
                <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-2 items-center w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[42px]">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border-none outline-none text-sm w-[110px] bg-transparent text-gray-700"
                            />
                        </div>
                        <span className="text-gray-400 font-medium">-</span>
                        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[42px]">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border-none outline-none text-sm w-[110px] bg-transparent text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari produk, supplier, catatan..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-white text-gray-700 uppercase font-semibold border-b text-xs">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-emerald-600 transition-colors">
                                        {selectedIds.length > 0 && selectedIds.length === filteredMovements.length ? (
                                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                            <Square className="w-5 h-5" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-4 py-3">Waktu</th>
                                <th className="px-4 py-3">Produk</th>
                                <th className="px-4 py-3 text-right">Jumlah Masuk</th>
                                <th className="px-4 py-3">Supplier Asal</th>
                                <th className="px-4 py-3 text-center">Tipe Bayar</th>
                                <th className="px-4 py-3">Catatan / Ref</th>
                                <th className="px-4 py-3 text-right">Est. Modal</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-12 text-gray-500">Memuat riwayat barang masuk...</td></tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-gray-500">Tidak ada riwayat barang masuk di rentang tanggal ini.</td></tr>
                            ) : (
                                filteredMovements.map(m => (
                                    <tr
                                        key={m.id}
                                        className={`hover:bg-emerald-50/30 transition-colors ${selectedIds.includes(m.id) ? 'bg-emerald-50/50' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleSelect(m.id)}
                                                className="text-gray-400 hover:text-emerald-600 transition-colors"
                                            >
                                                {selectedIds.includes(m.id) ? (
                                                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                                                ) : (
                                                    <Square className="w-5 h-5" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                                            {new Date(m.created_at).toLocaleString('id-ID', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-800">{m.productName}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-bold text-emerald-600 text-base">{m.qty}</span>
                                            <span className="text-xs text-gray-500 ml-1">{m.productBaseUnit}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {m.supplierName ? (
                                                <div>
                                                    <p className="font-semibold text-indigo-700">{m.supplierName}</p>
                                                    {m.supplierContact && <p className="text-[10px] text-gray-500">{m.supplierContact}</p>}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">Tanpa data supplier</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {m.payment_status ? (
                                                <span className={`inline-flex px-2 py-1 text-[11px] font-bold rounded-full border ${m.payment_status === 'lunas' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                    {m.payment_status === 'lunas' ? 'Lunas / Tunai' : 'Tempo (Kasbon)'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="max-w-[200px]">
                                                {m.reference_id && <p className="text-[10px] font-mono text-gray-400 truncate" title={m.reference_id}>{m.reference_id}</p>}
                                                <p className="text-xs text-gray-600 line-clamp-2" title={m.notes}>{m.notes || '-'}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                            {m.costEstimate > 0 ? (
                                                `Rp ${m.costEstimate.toLocaleString('id-ID')}`
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleDelete([m.id])}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Hapus baris ini"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
