'use client';

import { useEffect } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { db } from '@/lib/dexie';
import { useProductStore } from '@/store/productStore';

export function useRealtimeProducts() {
    useEffect(() => {
        if (!supabaseConfigured) return;

        const channel = supabase.channel('realtime-products');

        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'products' },
            async (payload) => {
                // Avoid overriding local pending changes
                const pCount = await db.sale_queue.where('status').equals('pending_sync').count();
                const mCount = await db.inventory_movements.where('status').equals('pending_sync').count();
                const productQueueCount = await db.product_sync_queue.where('status').equals('pending_sync').count();
                if (pCount > 0 || mCount > 0 || productQueueCount > 0) return;

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const incoming: any = payload.new;
                    if (!incoming?.id) return;

                    const local = await db.products.get(incoming.id);
                    const lts = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
                    const rts = incoming.updated_at ? new Date(incoming.updated_at).getTime() : 0;
                    if (local && lts > rts) return;

                    await db.products.put(incoming);
                    // Update store in-memory
                    useProductStore.setState(state => ({
                        products: state.products.some(p => p.id === incoming.id)
                            ? state.products.map(p => p.id === incoming.id ? incoming : p)
                            : [incoming, ...state.products]
                    }));
                }
            }
        );

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
}
