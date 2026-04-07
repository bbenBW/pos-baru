'use client';

import { useState, useEffect } from 'react';
import { useProductStore } from '@/store/productStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { db } from '@/lib/dexie';
import { ClipboardList, Save, AlertTriangle } from 'lucide-react';
import { supabase, supabaseConfigured } from '@/lib/supabase';

interface OpnameItem {
    productId: string;
    productName: string;
    baseUnit: string;
    systemStock: number;
    actualStock: string;
}

export default function OpnamePage() {
    const { products, loadProducts, loading } = useProductStore();
    const { user } = useAuthStore();
    const [opnameItems, setOpnameItems] = useState<OpnameItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [lockBy, setLockBy] = useState<string | null>(null);
    const [lockDevice, setLockDevice] = useState<string | null>(null);
    const [lockAt, setLockAt] = useState<string | null>(null);
    const [lockActive, setLockActive] = useState(false);

    const getDeviceId = () => {
        if (typeof window === 'undefined') return 'server';
        const key = 'pos_device_id';
        const existing = localStorage.getItem(key);
        if (existing) return existing;
        const id = crypto.randomUUID();
        localStorage.setItem(key, id);
        return id;
    };

    const LOCK_ID = 'opname_lock';
    const LOCK_TTL_MIN = 30;

    const refreshLockState = async () => {
        if (!supabaseConfigured || !navigator.onLine) return;
        const { data, error } = await supabase
            .from('store_settings')
            .select('preferences, updated_at')
            .eq('id', LOCK_ID)
            .single();
        if (error) return;
        const prefs = data?.preferences || {};
        const by = prefs.by || null;
        const device = prefs.device_id || null;
        const at = prefs.at || null;
        const locked = !!prefs.locked;
        let expired = false;
        if (at) {
            const ageMin = (Date.now() - new Date(at).getTime()) / 60000;
            expired = ageMin > LOCK_TTL_MIN;
        }
        if (locked && expired) {
            // auto-release expired lock
            await supabase.from('store_settings').upsert({
                id: LOCK_ID,
                preferences: { locked: false, by: null, device_id: null, at: null },
                updated_at: new Date().toISOString()
            });
            setLockActive(false);
            setLockBy(null);
            setLockDevice(null);
            setLockAt(null);
            return;
        }
        setLockActive(locked);
        setLockBy(by);
        setLockDevice(device);
        setLockAt(at);
    };

    const acquireLock = async (force = false) => {
        if (!supabaseConfigured || !navigator.onLine) return true;
        await refreshLockState();
        const myDevice = getDeviceId();
        if (!lockActive || lockDevice === myDevice || force) {
            await supabase.from('store_settings').upsert({
                id: LOCK_ID,
                preferences: {
                    locked: true,
                    by: user?.name || user?.email || user?.id || 'unknown',
                    device_id: myDevice,
                    at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            });
            setLockActive(true);
            setLockBy(user?.name || user?.email || user?.id || 'unknown');
            setLockDevice(myDevice);
            setLockAt(new Date().toISOString());
            return true;
        }
        return false;
    };

    const releaseLock = async () => {
        if (!supabaseConfigured || !navigator.onLine) return;
        const myDevice = getDeviceId();
        if (lockDevice && lockDevice !== myDevice) return;
        await supabase.from('store_settings').upsert({
            id: LOCK_ID,
            preferences: { locked: false, by: null, device_id: null, at: null },
            updated_at: new Date().toISOString()
        });
        setLockActive(false);
        setLockBy(null);
        setLockDevice(null);
        setLockAt(null);
    };

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        acquireLock(false);
        const interval = setInterval(() => {
            if (lockActive) {
                acquireLock(false);
            } else {
                refreshLockState();
            }
        }, 60000);
        return () => {
            clearInterval(interval);
            releaseLock();
        };
    }, []);

    useEffect(() => {
        if (products.length > 0) {
            setOpnameItems(prev => {
                if (prev.length === 0) {
                    return products.map(p => ({
                        productId: p.id,
                        productName: p.name,
                        baseUnit: p.base_unit,
                        systemStock: p.current_stock,
                        actualStock: String(parseFloat(Number(p.current_stock).toFixed(3)))
                    }));
                }
                return prev.map(item => {
                    const latest = products.find(p => p.id === item.productId);
                    return latest ? { ...item, systemStock: latest.current_stock } : item;
                });
            });
        }
    }, [products]);

    const updateActualStock = (productId: string, value: string) => {
        setOpnameItems(prev => prev.map(item =>
            item.productId === productId ? { ...item, actualStock: value } : item
        ));
        setSaved(false);
    };

    const hasDiffItems = opnameItems.filter(item => {
        const actualVal = parseFloat(item.actualStock);
        if (isNaN(actualVal)) return false;
        return Math.abs(actualVal - item.systemStock) > 0.001;
    });

    const handleSaveOpname = async () => {
        if (lockActive && lockDevice && lockDevice !== getDeviceId()) {
            return alert('Stock opname sedang dikunci oleh perangkat lain.');
        }
        if (!confirm(`Lanjutkan Opname? Sistem akan menyesuaikan ${hasDiffItems.length} produk yang berbeda.`)) return;

        setSaving(true);
        try {
            for (const item of hasDiffItems) {
                const actualVal = parseFloat(item.actualStock);
                if (isNaN(actualVal)) continue;

                const diff = actualVal - item.systemStock;

                // Update stock
                const product = products.find(p => p.id === item.productId);
                if (!product) continue;

                const updated = { ...product, current_stock: actualVal, updated_at: new Date().toISOString() };
                await db.products.put(updated);

                // Log as ADJUSTMENT movement
                await db.inventory_movements.add({
                    id: crypto.randomUUID(),
                    product_id: item.productId,
                    branch_id: useBranchStore.getState().activeBranch?.id,
                    user_id: user?.id || 'system',
                    movement_type: 'ADJUSTMENT',
                    qty: diff,
                    notes: `Stock Opname - selisih: ${diff > 0 ? '+' : ''}${diff.toFixed(3)}`,
                    reference_id: `OPNAME-${Date.now()}`,
                    status: 'pending_sync',
                    created_at: new Date().toISOString()
                });
            }

            setSaved(true);
            alert(`Opname selesai! ${hasDiffItems.length} produk telah disesuaikan.`);
            loadProducts();
            await releaseLock();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan opname.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col gap-6 min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-violet-600" /> Stock Opname
                    </h1>
                    <p className="text-gray-500 text-sm">Hitung stok fisik dan sesuaikan dengan stok di sistem.</p>
                </div>

                <div className="flex gap-3 items-center">
                    {hasDiffItems.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            {hasDiffItems.length} item berbeda
                        </div>
                    )}
                    <button
                        onClick={handleSaveOpname}
                        disabled={saving || hasDiffItems.length === 0}
                        className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Menyimpan...' : 'Selesaikan Opname'}
                    </button>
                </div>
            </div>

            {saved && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 font-medium">
                    ✅ Opname berhasil disimpan! Stok sistem telah diperbarui.
                </div>
            )}

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 min-h-0">
                <div className="overflow-x-auto overflow-y-auto max-h-full">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-slate-50 text-gray-700 uppercase text-xs font-semibold border-b">
                            <tr>
                                <th className="px-4 py-3">Nama Produk</th>
                                <th className="px-4 py-3 text-center">Satuan</th>
                                <th className="px-4 py-3 text-center">Stok Sistem</th>
                                <th className="px-4 py-3 text-center w-44">Stok Fisik Aktual *</th>
                                <th className="px-4 py-3 text-center">Selisih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {lockActive && lockDevice && lockDevice !== getDeviceId() && (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-amber-700 bg-amber-50">
                                        Stock opname sedang dikunci oleh {lockBy || 'perangkat lain'}.
                                        {lockAt && <span className="text-xs text-amber-600 block mt-1">Mulai: {new Date(lockAt).toLocaleString('id-ID')}</span>}
                                        <button
                                            onClick={() => acquireLock(true)}
                                            className="mt-2 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg"
                                        >
                                            Ambil Alih
                                        </button>
                                    </td>
                                </tr>
                            )}
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-8">Memuat data produk...</td></tr>
                            ) : opnameItems.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada produk.</td></tr>
                            ) : (
                                opnameItems.map(item => {
                                    const actualVal = parseFloat(item.actualStock);
                                    const isValid = !isNaN(actualVal);
                                    const diff = isValid ? actualVal - item.systemStock : 0;
                                    const hasDiff = Math.abs(diff) > 0.001;

                                    return (
                                        <tr key={item.productId} className={`transition-colors ${hasDiff ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                                            <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                                            <td className="px-4 py-3 text-center text-gray-500">{item.baseUnit}</td>
                                            <td className="px-4 py-3 text-center font-mono font-semibold text-blue-700">
                                                {parseFloat(Number(item.systemStock).toFixed(3))}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={item.actualStock}
                                                    onChange={e => updateActualStock(item.productId, e.target.value)}
                                                    className={`w-full text-center p-2 rounded-lg border-2 outline-none font-mono transition-colors text-sm ${hasDiff ? 'border-amber-400 bg-amber-50 text-amber-800 font-bold' : 'border-gray-200 focus:border-violet-400'
                                                        }`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {hasDiff ? (
                                                    <span className={`font-bold font-mono ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {diff > 0 ? '+' : ''}{parseFloat(diff.toFixed(3))}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
