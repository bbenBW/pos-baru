'use client';

import { useProductStore } from '@/store/productStore';
import { useCartStore } from '@/store/cartStore';
import { useSettingStore } from '@/store/settingStore';
import { OfflineProduct, OfflineUnitConversion } from '@/lib/dexie';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, AlertTriangle, X, Plus, Minus, ShoppingCart, Tag, Settings2, CheckCircle2, AlertCircle, Loader2, Bluetooth, Camera, ScanLine } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { RealtimeClock } from '@/components/shared/RealtimeClock';
import { diagnoseBluetoothPrinter, getBluetoothPrinterAvailability, isNativeBluetoothPrintingSupported, listPairedBluetoothPrinters, PairedBluetoothPrinter, printTextToBluetoothPrinter } from '@/lib/bluetoothPrinter';
import { CameraBarcodeScannerModal } from '@/components/shared/CameraBarcodeScannerModal';

interface AddToCartModalProps {
    product: OfflineProduct;
    conversions: OfflineUnitConversion[];
    cartQtyInBase: number;
    onClose: () => void;
    onAdd: (qty: number, unit: string, price: number, multiplier: number, discount: number) => void;
}

function AddToCartModal({ product, conversions, cartQtyInBase, onClose, onAdd }: AddToCartModalProps) {
    const unitOptions = [
        { unit: product.base_unit, multiplier: 1, price: product.sell_price },
        ...conversions.map(c => ({
            unit: c.unit_name,
            multiplier: c.multiplier,
            price: c.price || Math.round(product.sell_price / c.multiplier),
        })),
    ];

    const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
    const [qty, setQty] = useState<string>('1');
    const [discountType, setDiscountType] = useState<'rp' | 'pct'>('rp');
    const [discountValue, setDiscountValue] = useState<string>('0');

    const qtyNum = parseFloat(qty) || 0;
    const selected = unitOptions[selectedUnitIdx];
    const qtyInBase = qtyNum / selected.multiplier;
    const availableInBase = product.current_stock - cartQtyInBase;
    const maxQtyForUnit = Math.floor(availableInBase * selected.multiplier * 1000) / 1000;
    const isOverStock = qtyInBase > availableInBase;

    const baseSubtotal = qtyNum * selected.price;
    const discountRp = discountType === 'rp'
        ? Math.min(parseFloat(discountValue) || 0, baseSubtotal)
        : Math.round(baseSubtotal * ((parseFloat(discountValue) || 0) / 100));
    const finalSubtotal = Math.max(0, baseSubtotal - discountRp);

    const handleSubmit = () => {
        if (qtyNum <= 0) return;
        if (isOverStock) {
            return alert(`Stok tidak cukup. Tersedia: ${parseFloat(Number(availableInBase).toFixed(3))} ${product.base_unit}`);
        }
        onAdd(qtyNum, selected.unit, selected.price, selected.multiplier, discountRp);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 mr-3">
                            <h3 className="font-bold text-lg leading-tight line-clamp-2">{product.name}</h3>
                            <p className="text-emerald-100 text-xs mt-1">
                                Stok tersedia: <span className="font-bold">{parseFloat(Number(availableInBase).toFixed(3))} {product.base_unit}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg flex-shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                    {unitOptions.length > 1 && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pilih Satuan</label>
                            <div className="grid grid-cols-2 gap-2">
                                {unitOptions.map((opt, i) => (
                                    <button
                                        key={opt.unit}
                                        type="button"
                                        onClick={() => { setSelectedUnitIdx(i); setQty('1'); setDiscountValue('0'); }}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${selectedUnitIdx === i
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                            : 'border-gray-200 hover:border-emerald-300 text-gray-700'
                                            }`}
                                    >
                                        <p className="font-bold text-sm">{opt.unit}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Rp {opt.price.toLocaleString('id-ID')}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Jumlah ({selected.unit})
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setQty(q => {
                                    const val = Math.max(0.001, parseFloat((parseFloat(q) - 1).toFixed(3)));
                                    return val.toString();
                                })}
                                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                                <Minus className="w-5 h-5 text-slate-600" />
                            </button>
                            <input
                                type="number"
                                step="any"
                                value={qty}
                                onChange={e => setQty(e.target.value)}
                                className={`flex-1 min-w-0 text-center text-2xl font-bold p-2 rounded-xl border-2 outline-none transition-colors ${isOverStock ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 focus:border-emerald-400'
                                    }`}
                            />
                            <button
                                type="button"
                                onClick={() => setQty(q => {
                                    const next = parseFloat((parseFloat(q) + 1).toFixed(3));
                                    return (next <= maxQtyForUnit ? next : q).toString();
                                })}
                                className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                                <Plus className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        {isOverStock && (
                            <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Melebihi stok. Maks {parseFloat(Number(maxQtyForUnit).toFixed(3))} {selected.unit}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Diskon (Opsional)
                        </label>
                        <div className="flex gap-2">
                            <div className="flex bg-slate-100 rounded-lg p-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { setDiscountType('rp'); setDiscountValue('0'); }}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${discountType === 'rp' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                                >
                                    Rp
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setDiscountType('pct'); setDiscountValue('0'); }}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${discountType === 'pct' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                                >
                                    %
                                </button>
                            </div>
                            <input
                                type="number"
                                min="0"
                                max={discountType === 'pct' ? 100 : undefined}
                                value={discountValue}
                                onChange={e => setDiscountValue(e.target.value)}
                                placeholder={discountType === 'pct' ? '0 - 100' : '0'}
                                className="flex-1 p-2.5 rounded-lg border border-gray-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-mono"
                            />
                        </div>
                        {discountRp > 0 && (
                            <p className="text-emerald-600 text-xs mt-1 font-medium">
                                Hemat Rp {discountRp.toLocaleString('id-ID')}
                            </p>
                        )}
                    </div>

                    <div className={`rounded-xl p-3 space-y-1.5 ${discountRp > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>{qty || '0'} {selected.unit} x Rp {selected.price.toLocaleString('id-ID')}</span>
                            <span>Rp {baseSubtotal.toLocaleString('id-ID')}</span>
                        </div>
                        {discountRp > 0 && (
                            <div className="flex justify-between text-sm text-red-500">
                                <span>Diskon</span>
                                <span>- Rp {discountRp.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center border-t border-gray-200 pt-1.5">
                            <span className="text-xs text-gray-500 font-medium">Total</span>
                            <span className="text-lg font-black text-emerald-700">Rp {finalSubtotal.toLocaleString('id-ID')}</span>
                        </div>
                        {selected.multiplier !== 1 && (
                            <p className="text-xs text-gray-400">= {parseFloat(qtyInBase.toFixed(3))} {product.base_unit}</p>
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isOverStock || qtyNum <= 0}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-200 text-base"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        Tambah ke Keranjang
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ProductGrid() {
    const { products, unitConversions, loadProducts, loading } = useProductStore();
    const { addItem, updateQty, items: cartItems } = useCartStore();
    const { settings, loadSettings, updateSettings } = useSettingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [showPosSettingsModal, setShowPosSettingsModal] = useState(false);
    const [pairedPrinters, setPairedPrinters] = useState<PairedBluetoothPrinter[]>([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [checkingPrinter, setCheckingPrinter] = useState(false);
    const [testingPrinter, setTestingPrinter] = useState(false);
    const [pairedPrintersLoaded, setPairedPrintersLoaded] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [printerIndicatorText, setPrinterIndicatorText] = useState('Belum dicek');
    const [printerIndicatorTone, setPrinterIndicatorTone] = useState<'success' | 'danger' | 'neutral' | 'warning'>('warning');
    const [uiNotice, setUiNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<OfflineProduct | null>(null);
    const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'stock_desc'>('name_asc');
    const [isClient, setIsClient] = useState(false);
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const nativeBluetoothSupported = isNativeBluetoothPrintingSupported();
    const printerConnected = printerIndicatorTone === 'success' || printerIndicatorTone === 'neutral';

    const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
        setUiNotice({ type, message });
        window.setTimeout(() => {
            setUiNotice(current => (current?.message === message ? null : current));
        }, 2800);
    };


    useEffect(() => {
        loadProducts();
        void loadSettings();
    }, [loadProducts, loadSettings]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const scannerState = useBarcodeScanner((barcode) => {
        const matchedProduct = products.find(p => p.barcode === barcode);
        if (matchedProduct) {
            setSelectedProduct(matchedProduct);
            showNotice('success', `Barcode ${barcode} terdeteksi: ${matchedProduct.name}`);
        } else {
            setSearchTerm(barcode);
            showNotice('info', `Barcode ${barcode} tidak ditemukan. Menampilkan hasil pencarian.`);
        }
    });

    const refreshPrinterIndicator = async () => {
        if (settings.printMode !== 'bluetooth') {
            setPrinterIndicatorTone('neutral');
            setPrinterIndicatorText('Mode browser');
            setStatusMessage('Aplikasi memakai mode browser. Pairing Bluetooth tidak wajib.');
            return;
        }
        if (!settings.bluetoothMacAddress) {
            setPrinterIndicatorTone('danger');
            setPrinterIndicatorText('Belum pairing');
            setStatusMessage('Belum ada printer dipilih. Pilih dari daftar pairing.');
            return;
        }
        if (!nativeBluetoothSupported) {
            setPrinterIndicatorTone('danger');
            setPrinterIndicatorText('Butuh app Android');
            setStatusMessage('Perangkat ini tidak mendukung direct Bluetooth printer.');
            return;
        }
        setCheckingPrinter(true);
        setPrinterIndicatorTone('warning');
        try {
            const result = await diagnoseBluetoothPrinter(settings.bluetoothMacAddress);
            const ok = !!(result.success || result.canConnect);
            setPrinterIndicatorTone(ok ? 'success' : 'danger');
            setPrinterIndicatorText(ok ? 'Terhubung' : 'Tidak terhubung');
            setStatusMessage(result.message);
        } catch (error) {
            setPrinterIndicatorTone('danger');
            setPrinterIndicatorText('Gagal cek');
            setStatusMessage(error instanceof Error ? error.message : 'Gagal cek printer.');
        } finally {
            setCheckingPrinter(false);
        }
    };

    const loadPairedPrintersForPos = async () => {
        if (!nativeBluetoothSupported) {
            setStatusMessage('Pairing langsung hanya tersedia di aplikasi Android.');
            showNotice('info', 'Pairing Bluetooth hanya tersedia di aplikasi Android.');
            return;
        }
        setLoadingPrinters(true);
        setStatusMessage('Memuat printer Bluetooth yang sudah di-pair...');
        try {
            const availability = await getBluetoothPrinterAvailability();
            if (!availability.available) {
                setStatusMessage('Perangkat ini tidak mendukung Bluetooth printer.');
                return;
            }
            if (!availability.enabled) {
                setStatusMessage('Bluetooth belum aktif. Nyalakan Bluetooth tablet dulu.');
                return;
            }
            const devices = await listPairedBluetoothPrinters();
            setPairedPrinters(devices);
            setPairedPrintersLoaded(true);
            setStatusMessage(devices.length ? 'Pilih printer untuk dijadikan printer kasir.' : 'Belum ada printer ter-pair di Android.');
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : 'Gagal memuat printer.');
            showNotice('error', 'Gagal memuat daftar printer.');
        } finally {
            setLoadingPrinters(false);
        }
    };

    const connectPrinterFromPos = async (device: PairedBluetoothPrinter) => {
        await updateSettings({
            bluetoothMacAddress: device.address,
            bluetoothPrinterName: device.name,
            printMode: 'bluetooth'
        });
        setStatusMessage(`Printer dipilih: ${device.name}`);
        showNotice('success', `Printer aktif: ${device.name}`);
        await refreshPrinterIndicator();
    };

    const testPrinterFromPos = async () => {
        if (!settings.bluetoothMacAddress) {
            showNotice('error', 'Pilih printer dulu dari daftar pairing.');
            return;
        }
        setTestingPrinter(true);
        try {
            const testText = [
                'TES PRINTER POS',
                new Date().toLocaleString('id-ID'),
                'Jika teks ini keluar rapi, printer siap dipakai.',
                '',
                'Terima kasih',
                ''
            ].join('\n');
            await printTextToBluetoothPrinter(settings.bluetoothMacAddress, testText);
            setStatusMessage('Tes print berhasil.');
            setPrinterIndicatorTone('success');
            setPrinterIndicatorText('Terhubung');
            showNotice('success', 'Tes print berhasil. Printer siap dipakai.');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Tes print gagal.';
            setStatusMessage(msg);
            showNotice('error', msg);
            setPrinterIndicatorTone('danger');
            setPrinterIndicatorText('Tidak terhubung');
        } finally {
            setTestingPrinter(false);
        }
    };

    useEffect(() => {
        void refreshPrinterIndicator();
    }, [settings.printMode, settings.bluetoothMacAddress, settings.bluetoothPrinterName]);

    const filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || (product.barcode?.includes(searchTerm));
        const matchesCategory = activeCategory ? product.category_id === activeCategory : true;
        return matchesSearch && matchesCategory;
    });

    const filteredProducts = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name, 'id');
            case 'name_desc': return b.name.localeCompare(a.name, 'id');
            case 'newest': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            case 'oldest': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            case 'price_asc': return a.sell_price - b.sell_price;
            case 'price_desc': return b.sell_price - a.sell_price;
            case 'stock_desc': return b.current_stock - a.current_stock;
            default: return 0;
        }
    });

    const fmtStock = (value: number) => parseFloat(Number(value).toFixed(3)).toString();

    const getCartQtyInBase = (productId: string) =>
        cartItems.filter(item => item.product.id === productId).reduce((sum, item) => sum + (item.qty / item.unitMultiplier), 0);

    const handleAddToCart = (
        product: OfflineProduct,
        qty: number,
        unitName: string,
        price: number,
        multiplier: number,
        discount: number
    ) => {
        const conversions = unitConversions.filter(conversion => conversion.product_id === product.id);
        const existingItem = cartItems.find(item => item.product.id === product.id && item.selectedUnit === unitName);

        if (existingItem) {
            updateQty(existingItem.id, parseFloat((existingItem.qty + qty).toFixed(3)));
        } else {
            addItem(product, conversions, {
                forcedQty: qty,
                forcedUnit: unitName,
                forcedPrice: price,
                forcedMultiplier: multiplier,
                forcedDiscount: discount,
            });
        }
    };

    const renderProductCard = (product: OfflineProduct) => {
        const conversions = unitConversions.filter(conversion => conversion.product_id === product.id);
        const smallUnit = conversions.length > 0 ? conversions[0] : null;
        const cartQtyInBase = getCartQtyInBase(product.id);
        const availableStock = product.current_stock - cartQtyInBase;
        const isOutOfStock = availableStock <= 0;
        const isLowStock = !isOutOfStock && product.current_stock <= (product.min_stock || 0);
        const cartQtyDisplay = cartItems
            .filter(item => item.product.id === product.id)
            .reduce((sum, item) => sum + item.qty, 0);

        const smallUnitPrice = smallUnit
            ? (smallUnit.price || Math.round(product.sell_price / smallUnit.multiplier))
            : null;

        if (!settings.posShowProductImages) {
            return (
                <button
                    key={product.id}
                    onClick={() => !isOutOfStock && setSelectedProduct(product)}
                    disabled={isOutOfStock}
                    className={`w-full bg-white rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                        isOutOfStock
                            ? 'opacity-60 cursor-not-allowed border-red-200 bg-red-50/50'
                            : 'hover:border-primary hover:shadow-sm cursor-pointer border-slate-200'
                    }`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-semibold text-sm text-gray-800 leading-tight break-words">{product.name}</p>
                                {cartQtyDisplay > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                                        {parseFloat(Number(cartQtyDisplay).toFixed(2))}
                                    </span>
                                )}
                                {isOutOfStock && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">HABIS</span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-400 mb-2 break-all">{product.barcode || 'Tanpa barcode'}</p>
                            <div className={`text-xs flex items-center gap-1 ${isLowStock ? 'text-orange-500' : 'text-gray-500'}`}>
                                {isLowStock && <AlertTriangle className="w-3 h-3" />}
                                <span>Stok: {fmtStock(availableStock)} {product.base_unit}</span>
                            </div>
                        </div>
                        <div className="text-right shrink-0 min-w-[96px]">
                            {smallUnit && smallUnitPrice ? (
                                <div className="space-y-1">
                                    <div className="text-[11px] text-gray-400">
                                        Rp {smallUnitPrice.toLocaleString('id-ID')}/{smallUnit.unit_name}
                                    </div>
                                    <div className="text-primary font-bold text-sm">
                                        Rp {product.sell_price.toLocaleString('id-ID')}/{product.base_unit}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-primary font-bold text-sm">
                                    Rp {product.sell_price.toLocaleString('id-ID')}/{product.base_unit}
                                </div>
                            )}
                        </div>
                    </div>
                </button>
            );
        }

        return (
            <button
                key={product.id}
                onClick={() => !isOutOfStock && setSelectedProduct(product)}
                disabled={isOutOfStock}
                className={`bg-white p-3 rounded-xl shadow-sm border text-left flex flex-col h-full transition-all active:scale-95 relative
                    ${isOutOfStock ? 'opacity-50 cursor-not-allowed border-red-200 bg-red-50/50' : 'border-transparent hover:border-primary hover:shadow-md cursor-pointer'}
                `}
            >
                {cartQtyDisplay > 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
                        {parseFloat(Number(cartQtyDisplay).toFixed(2))}
                    </div>
                )}
                {isOutOfStock && (
                    <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10">HABIS</div>
                )}
                {product.base64_offline || product.image_url ? (
                    <div className="w-full h-24 mb-2 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                        <img src={product.base64_offline || product.image_url!} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-full h-24 mb-2 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-7 h-7 text-slate-300" />
                    </div>
                )}

                <div className="font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 flex-1 text-xs md:text-sm">
                    {product.name}
                </div>

                <div className={`text-xs mb-1.5 flex items-center gap-1 ${isLowStock ? 'text-orange-500' : 'text-gray-400'}`}>
                    {isLowStock && <AlertTriangle className="w-3 h-3" />}
                    {fmtStock(availableStock)} {product.base_unit}
                </div>

                <div className="mt-auto">
                    {smallUnit && smallUnitPrice ? (
                        <div className="space-y-0.5">
                            <div className="text-[10px] text-gray-400">
                                Rp {smallUnitPrice.toLocaleString('id-ID')}/{smallUnit.unit_name}
                            </div>
                            <div className="text-primary font-bold text-xs md:text-sm">
                                Rp {product.sell_price.toLocaleString('id-ID')}/{product.base_unit}
                            </div>
                        </div>
                    ) : (
                        <div className="text-primary font-bold text-xs md:text-sm">
                            Rp {product.sell_price.toLocaleString('id-ID')}/{product.base_unit}
                        </div>
                    )}
                </div>
            </button>
        );
    };

    const selectedConversions = selectedProduct ? unitConversions.filter(conversion => conversion.product_id === selectedProduct.id) : [];
    const selectedCartQty = selectedProduct ? getCartQtyInBase(selectedProduct.id) : 0;

    return (
        <>
            <div className="flex flex-col h-full bg-slate-50 border-r overflow-x-hidden">
                <div className="px-2 pt-2 pb-1 bg-white border-b sticky top-0 z-10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Kasir (POS)</span>
                        <div className="flex items-center gap-1.5">
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                                <ScanLine className="w-3 h-3" />
                                {scannerState.lastScannedAt && (Date.now() - scannerState.lastScannedAt) < 15000
                                    ? `Scan ${scannerState.lastScannedValue}`
                                    : 'Scanner siap'}
                            </div>
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${checkingPrinter ? 'bg-amber-100 text-amber-700' : printerIndicatorTone === 'success' ? 'bg-emerald-100 text-emerald-700' : printerIndicatorTone === 'neutral' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-600'}`}>
                                <span className={`inline-flex w-1.5 h-1.5 rounded-full ${checkingPrinter ? 'bg-amber-500' : printerIndicatorTone === 'success' ? 'bg-emerald-500' : printerIndicatorTone === 'neutral' ? 'bg-slate-400' : 'bg-red-500'}`} />
                                {checkingPrinter ? 'Cek...' : printerIndicatorText}
                            </div>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowPosSettingsModal(true)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-primary hover:border-primary hover:bg-emerald-50 transition-colors"
                                    title="Pengaturan POS"
                                    aria-label="Pengaturan POS"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                                {showPosSettingsModal && isClient && createPortal(
                                    <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3" onClick={() => setShowPosSettingsModal(false)}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-hidden" onClick={e => e.stopPropagation()}><div className="p-3 overflow-y-auto max-h-[88vh]">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">Pengaturan POS</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">Atur tampilan kasir dan pairing printer langsung dari halaman POS.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowPosSettingsModal(false)}
                                                className="text-gray-400 hover:text-gray-600"
                                                aria-label="Tutup pengaturan tampilan"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="mt-3 rounded-xl border border-slate-200 p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700">Pairing Printer</p>
                                                    <p className="text-[11px] text-gray-500">Kasir bisa pilih printer Bluetooth dari sini.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void refreshPrinterIndicator()}
                                                    disabled={checkingPrinter}
                                                    className="text-[10px] font-semibold text-primary disabled:opacity-50"
                                                >
                                                    Cek
                                                </button>
                                            </div>

                                            <div className={`text-[11px] px-2 py-1 rounded-lg ${printerIndicatorTone === 'success' ? 'bg-emerald-50 text-emerald-700' : printerIndicatorTone === 'neutral' ? 'bg-slate-100 text-slate-600' : printerIndicatorTone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                                                {statusMessage || (printerConnected ? 'Printer siap dipakai.' : 'Printer belum terhubung.')}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void loadPairedPrintersForPos()}
                                                    disabled={loadingPrinters}
                                                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    {loadingPrinters ? 'Memuat...' : 'Muat Printer Terpasang'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void testPrinterFromPos()}
                                                    disabled={testingPrinter || !settings.bluetoothMacAddress}
                                                    className="flex-1 rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    {testingPrinter ? 'Tes...' : 'Tes Print'}
                                                </button>
                                            </div>

                                            {pairedPrintersLoaded && pairedPrinters.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-[11px] text-gray-500">
                                                    Belum ada printer ter-pair di Android. Pair dulu di pengaturan Bluetooth tablet.
                                                </div>
                                            )}

                                            {pairedPrinters.length > 0 && (
                                                <div className="max-h-36 overflow-y-auto space-y-1">
                                                    {pairedPrinters.map(device => (
                                                        <button
                                                            key={device.address}
                                                            type="button"
                                                            onClick={() => void connectPrinterFromPos(device)}
                                                            className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${settings.bluetoothMacAddress === device.address ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-gray-700">{device.name}</p><p className="text-[10px] text-gray-500">{device.address}</p></div>{settings.bluetoothMacAddress === device.address && (<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Aktif</span>)}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void updateSettings({ posShowProductImages: !settings.posShowProductImages })}
                                            className="mt-3 w-full flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 hover:border-primary hover:bg-emerald-50 transition-colors text-left"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Tampilan Produk Bergambar</p>
                                                <p className="text-[11px] text-gray-500">Matikan untuk mode list detail tanpa gambar.</p>
                                            </div>
                                            <span className={`w-11 h-6 rounded-full relative transition-colors ${settings.posShowProductImages ? 'bg-primary' : 'bg-slate-300'}`}>
                                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.posShowProductImages ? 'left-6' : 'left-1'}`} />
                                            </span>
                                        </button>
                                    </div></div></div>, document.body)}
                            </div>
                            <RealtimeClock className="!py-1 !px-2 !text-xs" />
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Cari produk / barcode..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="w-full pl-7 pr-9 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none shadow-sm text-sm"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100"
                                    aria-label="Hapus pencarian"
                                    title="Hapus pencarian"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCameraScanner(true)}
                            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-2.5 py-1.5 bg-white text-slate-600 hover:bg-slate-50"
                            title="Scan barcode dengan kamera"
                        >
                            <Camera className="w-3.5 h-3.5" />
                        </button>
                        <select
                            value={sortBy}
                            onChange={event => setSortBy(event.target.value as typeof sortBy)}
                            className="text-xs border border-gray-300 rounded-lg px-1.5 py-1.5 outline-none focus:ring-2 focus:ring-primary bg-white text-gray-600 flex-shrink-0"
                        >
                            <option value="name_asc">A - Z</option>
                            <option value="name_desc">Z - A</option>
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                            <option value="price_asc">Harga naik</option>
                            <option value="price_desc">Harga turun</option>
                            <option value="stock_desc">Stok terbanyak</option>
                        </select>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                        <button onClick={() => setActiveCategory(null)} className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors ${!activeCategory ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            Semua
                        </button>
                        <button className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Material</button>
                        <button className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">Tools</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Memuat data produk...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">Produk tidak ditemukan.</div>
                    ) : settings.posShowProductImages ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {filteredProducts.map(renderProductCard)}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredProducts.map(renderProductCard)}
                        </div>
                    )}
                </div>
            </div>

            {uiNotice && (
                <div className="fixed bottom-4 right-4 z-[75] w-[92vw] max-w-sm">
                    <div className={`rounded-xl border shadow-lg px-4 py-3 flex items-start gap-2 ${
                        uiNotice.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : uiNotice.type === 'info'
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {uiNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : uiNotice.type === 'info' ? <Loader2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                        <p className="text-xs font-medium leading-relaxed">{uiNotice.message}</p>
                    </div>
                </div>
            )}

            {selectedProduct && (
                <AddToCartModal
                    product={selectedProduct}
                    conversions={selectedConversions}
                    cartQtyInBase={selectedCartQty}
                    onClose={() => setSelectedProduct(null)}
                    onAdd={(qty, unitName, price, multiplier, discount) =>
                        handleAddToCart(selectedProduct, qty, unitName, price, multiplier, discount)
                    }
                />
            )}
            <CameraBarcodeScannerModal
                open={showCameraScanner}
                title="Scan Barcode Kasir"
                onClose={() => setShowCameraScanner(false)}
                onDetected={(scannedBarcode) => {
                    const matchedProduct = products.find(product => product.barcode === scannedBarcode);
                    if (matchedProduct) {
                        setSelectedProduct(matchedProduct);
                        showNotice('success', `Produk ${matchedProduct.name} ditemukan.`);
                    } else {
                        setSearchTerm(scannedBarcode);
                        showNotice('info', `Barcode ${scannedBarcode} tidak ditemukan. Silakan cek data produk.`);
                    }
                }}
            />
        </>
    );
}
