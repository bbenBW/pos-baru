'use client';

import { useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { DatabaseBackup, DownloadCloud } from 'lucide-react';

const SEED_DATA = [
    {
        name: 'Semen Tiga Roda (PCC) 50 Kg',
        base_unit: 'sak',
        base_price: 59000,
        sell_price: 64000,
        current_stock: 100,
        conversions: [
            { unit_name: 'kg', multiplier: 50, price: 1500 }
        ]
    },
    {
        name: 'Semen Gresik 40 Kg',
        base_unit: 'sak',
        base_price: 49000,
        sell_price: 53000,
        current_stock: 50,
        conversions: [
            { unit_name: 'kg', multiplier: 40, price: 1500 }
        ]
    },
    {
        name: 'Besi Beton Polos 8mm (KS)',
        base_unit: 'batang',
        base_price: 38000,
        sell_price: 42000,
        current_stock: 200,
        conversions: []
    },
    {
        name: 'Besi Beton Ulir 10mm (KS)',
        base_unit: 'batang',
        base_price: 58000,
        sell_price: 65000,
        current_stock: 150,
        conversions: []
    },
    {
        name: 'Cat Tembok Avitex Putih 5 Kg',
        base_unit: 'galon',
        base_price: 105000,
        sell_price: 120000,
        current_stock: 20,
        conversions: []
    },
    {
        name: 'Paku Kayu 5cm / 2 Inch',
        base_unit: 'dus',
        base_price: 250000,
        sell_price: 280000,
        current_stock: 10,
        conversions: [
            { unit_name: 'kg', multiplier: 30, price: 10000 }
        ]
    }
];

export function SeedDataTool() {
    const { addProduct } = useProductStore();
    const [seeding, setSeeding] = useState(false);

    const handleInject = async () => {
        if (!confirm('Peringatan: Ini akan memasukkan data sampel produk material bangunan ke dalam database Anda. Lanjutkan?')) return;

        setSeeding(true);
        try {
            for (const item of SEED_DATA) {
                await addProduct({
                    name: item.name,
                    barcode: null,
                    category_id: null,
                    base_unit: item.base_unit,
                    base_price: item.base_price,
                    sell_price: item.sell_price,
                    current_stock: item.current_stock,
                    min_stock: 5,
                }, item.conversions);
            }
            alert('Yay! Database SKU Bawaan berhasil di-inject.');
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Gagal melakukan injeksi database.');
        } finally {
            setSeeding(false);
        }
    };

    return (
        <button
            onClick={handleInject}
            disabled={seeding}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
        >
            <DownloadCloud className="w-4 h-4" />
            {seeding ? 'Memproses Inject...' : 'Inject SKU Bawaan (Demo)'}
        </button>
    );
}
