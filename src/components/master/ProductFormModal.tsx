'use client';

import { useMemo, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { X, Plus, Trash2, Shuffle, Camera, ScanLine, Printer } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { OfflineProduct, OfflineUnitConversion } from '@/lib/dexie';
import { db } from '@/lib/dexie';
import { CameraBarcodeScannerModal } from '@/components/shared/CameraBarcodeScannerModal';
import { BarcodePrintModal } from '@/components/master/BarcodePrintModal';
import { supabase } from '@/lib/supabase';
// Helper convert data url ke blob
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
};

interface Props {
    onClose: () => void;
    editProduct?: OfflineProduct;
    editConversions?: OfflineUnitConversion[];
}

const compressImageToDataUrl = (file: File, maxWidth = 1280, quality = 0.72): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas tidak tersedia'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Gagal memuat gambar'));
            img.src = typeof reader.result === 'string' ? reader.result : '';
        };
        reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
        reader.readAsDataURL(file);
    });

export function ProductFormModal({ onClose, editProduct, editConversions }: Props) {
    const { addProduct, updateProduct } = useProductStore();
    const isEditMode = !!editProduct;
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Form State — pre-fill if editing
    const [name, setName] = useState(editProduct?.name || '');
    const [barcode, setBarcode] = useState(editProduct?.barcode || '');
    const [baseUnit, setBaseUnit] = useState(editProduct?.base_unit || 'sak');
    const [basePrice, setBasePrice] = useState(editProduct?.base_price?.toString() || '');
    const [sellPrice, setSellPrice] = useState(editProduct?.sell_price?.toString() || '');
    const [currentStock, setCurrentStock] = useState(editProduct?.current_stock?.toString() || '0');
    const [minStock, setMinStock] = useState(editProduct?.min_stock?.toString() || '0');
    const [base64Image, setBase64Image] = useState<string | null>(editProduct?.base64_offline || editProduct?.image_url || null);

    // Conversions — pre-fill if editing
    const [conversions, setConversions] = useState<{ unit_name: string; multiplier: string; price: string }[]>(
        editConversions?.map(c => ({
            unit_name: c.unit_name,
            multiplier: c.multiplier.toString(),
            price: c.price?.toString() || '',
        })) || []
    );
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Auto-fill barcode if scanned while modal is open
    const scannerState = useBarcodeScanner((scannedBarcode) => {
        setBarcode(scannedBarcode);
    });

    // Generate EAN-13 style barcode
    const generateBarcode = () => {
        const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
        // Calculate check digit
        const check = (10 - (digits.reduce((sum, d, i) => sum + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10;
        setBarcode(digits.join('') + check);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImageToDataUrl(file);
                setBase64Image(compressed);
            } catch (error) {
                console.error(error);
                alert('Gagal memproses foto produk.');
            }
        }
    };

    const handleAddConversion = () => {
        setConversions([...conversions, { unit_name: '', multiplier: '1', price: '' }]);
    };

    const handleRemoveConversion = (index: number) => {
        setConversions(conversions.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isEditMode && editProduct?.id) {
                const latest = await db.products.get(editProduct.id);
                const latestTs = latest?.updated_at ? new Date(latest.updated_at).getTime() : 0;
                const editTs = editProduct.updated_at ? new Date(editProduct.updated_at).getTime() : 0;
                if (latest && latestTs > editTs) {
                    const ok = confirm(
                        'Data produk ini sudah berubah dari perangkat lain. Lanjutkan akan menimpa perubahan terbaru. Lanjutkan?'
                    );
                    if (!ok) {
                        setLoading(false);
                        return;
                    }
                }
            }

            const parsedConversions = conversions.map(c => ({
                unit_name: c.unit_name,
                multiplier: parseFloat(c.multiplier) || 1,
                price: c.price ? parseFloat(c.price) : null
            }));

            setUploadingImage(true);
            let finalImageUrl = editProduct?.image_url || undefined;

            if (navigator.onLine && base64Image && base64Image.startsWith('data:image/')) {
                try {
                    const blob = await dataUrlToBlob(base64Image);
                    const fileExt = blob.type.split('/')[1] || 'jpg';
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const filePath = `products/${fileName}`;

                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(filePath, blob, {
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) {
                        console.error('Upload foto ke bucket gagal:', uploadError);
                        alert(`Perhatian: Gagal upload foto produk (${uploadError.message}).\nPastikan bucket "product-images" diset Public dan Allow INSERT.\nProduk disimpan tanpa foto.`);
                    } else if (uploadData?.path) {
                        const { data: publicUrlData } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(uploadData.path);

                        finalImageUrl = publicUrlData.publicUrl;
                    }
                } catch (err) {
                    console.error('Error saat upload:', err);
                }
            }
            setUploadingImage(false);

            const productData = {
                name,
                barcode: barcode || null,
                category_id: editProduct?.category_id || null,
                base_unit: baseUnit,
                base_price: parseFloat(basePrice) || 0,
                sell_price: parseFloat(sellPrice) || 0,
                current_stock: parseFloat(currentStock) || 0,
                min_stock: parseFloat(minStock) || 0,
                base64_offline: undefined,
                image_url: finalImageUrl
            };

            if (isEditMode && editProduct) {
                await updateProduct(editProduct.id, productData, parsedConversions);
            } else {
                await addProduct(productData, parsedConversions);
            }

            onClose();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan produk');
        } finally {
            setLoading(false);
        }
    };

    const barcodePreviewProduct = useMemo<OfflineProduct | null>(() => {
        if (!barcode.trim()) return null;
        return {
            id: editProduct?.id || crypto.randomUUID(),
            name: name || editProduct?.name || 'Produk Tanpa Nama',
            barcode: barcode.trim(),
            category_id: editProduct?.category_id || null,
            base_unit: baseUnit || editProduct?.base_unit || 'pcs',
            base_price: parseFloat(basePrice) || editProduct?.base_price || 0,
            sell_price: parseFloat(sellPrice) || editProduct?.sell_price || 0,
            current_stock: parseFloat(currentStock) || editProduct?.current_stock || 0,
            min_stock: parseFloat(minStock) || editProduct?.min_stock || 0,
            base64_offline: editProduct?.base64_offline || undefined, // dihapus pelan2
            image_url: editProduct?.image_url || (base64Image && !base64Image.startsWith('data:image/') ? base64Image : undefined),
            branch_id: editProduct?.branch_id,
            updated_at: editProduct?.updated_at,
            created_at: editProduct?.created_at
        };
    }, [barcode, base64Image, basePrice, baseUnit, currentStock, editProduct, minStock, name, sellPrice]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-auto max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}
                        </h2>
                        {isEditMode && (
                            <p className="text-xs text-gray-500 mt-0.5">Mengubah data: <span className="font-medium">{editProduct.name}</span></p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2 flex gap-4 items-start">
                            <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative cursor-pointer hover:bg-slate-200">
                                {base64Image ? (
                                    <img src={base64Image} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-gray-400 text-xs text-center p-2">
                                        <Plus className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                        Foto
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" title="Upload Foto Produk" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none" placeholder="cth: Semen Tiga Roda" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                            <div className="flex gap-2">
                                <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} className="flex-1 p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none min-w-0" placeholder="Scan Barcode / SKU" />
                                <button type="button" onClick={() => setShowCameraScanner(true)} title="Scan barcode dengan kamera" className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-600 rounded-lg border border-gray-300 flex items-center justify-center transition-colors shrink-0">
                                    <Camera className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={generateBarcode} title="Generate barcode EAN-13 otomatis" className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-600 rounded-lg border border-gray-300 flex items-center justify-center transition-colors shrink-0">
                                    <Shuffle className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => setShowPrintModal(true)} disabled={!barcode.trim()} title="Print barcode" className="px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-600 rounded-lg border border-gray-300 flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Printer className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 border border-emerald-200">
                                    <ScanLine className="w-3 h-3" />
                                    Scanner siap
                                </span>
                                {scannerState.lastScannedValue && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600 border border-slate-200">
                                        Terakhir scan: {scannerState.lastScannedValue}
                                    </span>
                                )}
                                <span className="text-gray-500">Bisa pakai scanner barcode HID/keyboard atau kamera.</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Satuan Terbesar (Master) *</label>
                            <input
                                required
                                type="text"
                                list="unit-suggestions"
                                value={baseUnit}
                                onChange={e => setBaseUnit(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Pilih atau ketik satuan (cth: kodi, sak, box)"
                            />
                            <datalist id="unit-suggestions">
                                <option value="sak">Sak (Besar)</option>
                                <option value="dus">Dus / Karton</option>
                                <option value="kodi">Kodi (20 pcs)</option>
                                <option value="lusin">Lusin (12 pcs)</option>
                                <option value="rim">Rim (500 lbr)</option>
                                <option value="roll">Roll / Gulung</option>
                                <option value="m3">Kubik (m3)</option>
                                <option value="liter">Liter (l)</option>
                                <option value="batang">Batang</option>
                                <option value="lembar">Lembar</option>
                                <option value="galon">Galon</option>
                                <option value="kg">Kilogram (kg)</option>
                                <option value="pcs">Pcs / Buah</option>
                                <option value="box">Box</option>
                            </datalist>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli (Modal / 1 {baseUnit}) *</label>
                            <input required type="number" step="any" value={basePrice} onChange={e => setBasePrice(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual (Utama / 1 {baseUnit}) *</label>
                            <input required type="number" step="any" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Stok ({baseUnit}) *
                                {isEditMode && <span className="text-xs text-amber-600 ml-1 font-normal">(Untuk tambah stok, gunakan fitur Stock In)</span>}
                            </label>
                            <input required type="number" step="any" value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Batas Minimum Stok</label>
                            <input type="number" step="any" value={minStock} onChange={e => setMinStock(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                    </div>

                    <div className="border-t pt-6 mt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-800">Multi-Satuan / Konversi Unit (Opsional)</h3>
                                <p className="text-xs text-gray-500">Gunakan jika produk dijual dalam unit lain (misal 1 Kodi = 20 Pcs, atau 1 Dus = 40 Pcs)</p>
                            </div>
                            <button type="button" onClick={handleAddConversion} className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors">
                                <Plus className="w-4 h-4" /> Tambah Unit
                            </button>
                        </div>

                        <div className="space-y-3">
                            {conversions.map((conv, idx) => (
                                <div key={idx} className="flex gap-2 items-start bg-slate-50 p-3 rounded-lg border">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Nama Unit (cth: kodi, pcs, kg)</label>
                                            <input
                                                required
                                                type="text"
                                                list="unit-suggestions"
                                                value={conv.unit_name}
                                                onChange={e => {
                                                    const newC = [...conversions]; newC[idx].unit_name = e.target.value; setConversions(newC);
                                                }}
                                                className="w-full p-2 rounded-md border text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">1 {baseUnit} isi berapa {conv.unit_name || 'ini'}?</label>
                                            <input required type="number" step="any" placeholder="cth: 40" value={conv.multiplier} onChange={e => {
                                                const newC = [...conversions]; newC[idx].multiplier = e.target.value; setConversions(newC);
                                            }} className="w-full p-2 rounded-md border text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Harga Jual per {conv.unit_name || 'ini'} (Opsional)</label>
                                            <input type="number" step="any" placeholder="Override harga" value={conv.price} onChange={e => {
                                                const newC = [...conversions]; newC[idx].price = e.target.value; setConversions(newC);
                                            }} className="w-full p-2 rounded-md border text-sm" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveConversion(idx)} className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {conversions.length === 0 && <p className="text-sm text-center text-gray-400 py-4 bg-slate-50 border border-dashed rounded-lg">Tidak ada satuan eceran. Produk hanya dijual utuh per {baseUnit}.</p>}
                        </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-slate-100 font-medium rounded-lg transition-colors">Batal</button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-primary hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-75">
                            {loading ? 'Menyimpan...' : isEditMode ? '💾 Simpan Perubahan' : 'Simpan Produk'}
                        </button>
                    </div>
                </form>

            </div>
            <CameraBarcodeScannerModal
                open={showCameraScanner}
                title="Scan Barcode Produk"
                onClose={() => setShowCameraScanner(false)}
                onDetected={(scannedBarcode) => setBarcode(scannedBarcode)}
            />
            {barcodePreviewProduct && showPrintModal && (
                <BarcodePrintModal
                    product={barcodePreviewProduct}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}
