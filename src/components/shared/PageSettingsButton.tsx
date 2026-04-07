'use client';

import { useState } from 'react';
import { Settings, X } from 'lucide-react';

export interface PageSettingField {
    key: string;
    label: string;
    visible: boolean;
}

interface Props {
    fields: PageSettingField[];
    onUpdate: (fields: PageSettingField[]) => void;
}

export function PageSettingsButton({ fields, onUpdate }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [localFields, setLocalFields] = useState(fields);

    const toggle = (key: string) => {
        setLocalFields(prev => prev.map(f => f.key === key ? { ...f, visible: !f.visible } : f));
    };

    const handleSave = () => {
        onUpdate(localFields);
        setIsOpen(false);
    };

    return (
        <>
            <button
                onClick={() => { setLocalFields(fields); setIsOpen(true); }}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200"
                title="Kustomisasi Tampilan Halaman Ini"
            >
                <Settings className="w-5 h-5" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-start justify-end p-4 bg-black/30" onClick={() => setIsOpen(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-72 mt-16 mr-2 overflow-hidden border"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                <h3 className="font-bold text-sm">Kustomisasi Tampilan</h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            <p className="text-xs text-gray-500 mb-3">Pilih kolom/elemen yang ingin ditampilkan pada halaman ini:</p>
                            {localFields.map(field => (
                                <label key={field.key} className="flex items-center justify-between cursor-pointer group py-2 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                                    <span className="text-sm text-gray-700 font-medium">{field.label}</span>
                                    <div
                                        onClick={() => toggle(field.key)}
                                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${field.visible ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${field.visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            <button onClick={() => setIsOpen(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                Batal
                            </button>
                            <button onClick={handleSave} className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900">
                                Terapkan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
