'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/dexie';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useProductStore } from '@/store/productStore';

interface MovementItem {
    id: string;
    product_id: string;
    movement_type: string;
    qty: number;
    notes?: string;
    created_at: string;
}

export function AuditLogPanel() {
    const { products } = useProductStore();
    const [items, setItems] = useState<MovementItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                let data: MovementItem[] = [];
                if (navigator.onLine && supabaseConfigured) {
                    const { data: remote, error } = await supabase
                        .from('inventory_movements')
                        .select('id, product_id, movement_type, qty, notes, created_at')
                        .order('created_at', { ascending: false })
                        .limit(50);
                    if (!error && remote) data = remote as any;
                } else {
                    const local = await db.inventory_movements.orderBy('created_at').reverse().limit(50).toArray();
                    data = local as any;
                }
                setItems(data);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const getProductName = (id: string) =>
        products.find(p => p.id === id)?.name || id.slice(0, 8) + '...';

    return (
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-gray-800">Audit Log Stok</h3>
            {loading ? (
                <p className="text-sm text-gray-500">Memuat log...</p>
            ) : items.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada pergerakan stok.</p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {items.map(m => (
                        <div key={m.id} className="rounded-lg border px-3 py-2 text-xs bg-slate-50">
                            <div className="font-semibold text-gray-700">
                                {getProductName(m.product_id)} · {m.movement_type} · {m.qty}
                            </div>
                            {m.notes && <div className="text-gray-500">{m.notes}</div>}
                            <div className="text-[10px] text-gray-400 mt-1">
                                {new Date(m.created_at).toLocaleString('id-ID')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
