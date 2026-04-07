'use client';

import { useState } from 'react';
import { useReceiptSettingsStore, DEFAULT_RECEIPT_FIELDS } from '@/store/receiptSettingsStore';
import { Receipt, Save, RotateCcw } from 'lucide-react';

export function ReceiptSettingsPanel() {
    const { storeName, storeAddress, storePhone, footerMessage, fields, updateMeta, updateFields } = useReceiptSettingsStore();
    const [localFields, setLocalFields] = useState(fields);
    const [saved, setSaved] = useState(false);

    const toggleField = (key: string) => {
        setLocalFields(prev => prev.map(f => f.key === key ? { ...f, visible: !f.visible } : f));
        setSaved(false);
    };

    const handleSave = () => {
        updateFields(localFields);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        setLocalFields(DEFAULT_RECEIPT_FIELDS);
        updateFields(DEFAULT_RECEIPT_FIELDS);
    };

    return (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
            <div>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" /> Kustomisasi Struk / Receipt
                </h3>
                <p className="text-sm text-gray-500 mt-1">Atur tampilan informasi pada struk transaksi.</p>
            </div>

            {/* Store Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Nama Toko</label>
                    <input
                        value={storeName}
                        onChange={e => updateMeta({ storeName: e.target.value })}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                        placeholder="Toko Bangunan Saya"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">No. Telepon</label>
                    <input
                        value={storePhone}
                        onChange={e => updateMeta({ storePhone: e.target.value })}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                        placeholder="08xxxxxxxxxx"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Alamat Toko</label>
                    <input
                        value={storeAddress}
                        onChange={e => updateMeta({ storeAddress: e.target.value })}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                        placeholder="Jl. Contoh No. 1, Kota"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pesan Penutup Struk</label>
                    <input
                        value={footerMessage}
                        onChange={e => updateMeta({ footerMessage: e.target.value })}
                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                        placeholder="Terima kasih atas kepercayaan Anda!"
                    />
                </div>
            </div>

            {/* Field Visibility */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700">Baris yang Ditampilkan di Struk</h4>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border rounded px-2 py-1 transition-colors"
                    >
                        <RotateCcw className="w-3 h-3" /> Reset Default
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-2 border rounded-xl overflow-hidden">
                    {localFields.map((field, idx) => (
                        <label
                            key={field.key}
                            className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${idx < localFields.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                            <span className="text-sm text-gray-700 font-medium">{field.label}</span>
                            <div
                                onClick={() => toggleField(field.key)}
                                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${field.visible ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${field.visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <button
                onClick={handleSave}
                className={`w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'}`}
            >
                <Save className="w-4 h-4" />
                {saved ? '✅ Tersimpan!' : 'Simpan Pengaturan Struk'}
            </button>
        </div>
    );
}
