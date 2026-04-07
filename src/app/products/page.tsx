'use client';

import { useEffect, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { PackagePlus, Search, Edit, Trash2, Plus, ArrowDownCircle, ChevronDown, ChevronUp, CheckSquare, Square, Camera, Printer, ScanLine, X } from 'lucide-react';
import { ProductFormModal } from '@/components/master/ProductFormModal';
import { StockInModal } from '@/components/master/StockInModal';
import { OfflineProduct } from '@/lib/dexie';
import { PageSettingsButton, PageSettingField } from '@/components/shared/PageSettingsButton';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { CameraBarcodeScannerModal } from '@/components/shared/CameraBarcodeScannerModal';
import { BarcodePrintModal } from '@/components/master/BarcodePrintModal';

const DEFAULT_COLUMNS: PageSettingField[] = [
    { key: 'barcode', label: 'Barcode', visible: true },
    { key: 'stock_base', label: 'Stok Satuan Besar', visible: true },
    { key: 'stock_small', label: 'Stok Satuan Kecil', visible: true },
    { key: 'base_unit', label: 'Satuan Dasar', visible: true },
    { key: 'conversion_info', label: 'Info Konversi', visible: true },
    { key: 'sell_price', label: 'Harga Jual (Besar)', visible: true },
    { key: 'small_price', label: 'Harga Jual (Kecil)', visible: true },
    { key: 'modal_price', label: 'Harga Modal', visible: false },
];

export default function ProductsPage() {
    const { products, loadProducts, loading, deleteProduct, unitConversions } = useProductStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<OfflineProduct | null>(null);
    const [stockInProduct, setStockInProduct] = useState<OfflineProduct | null>(null);
    const [columns, setColumns] = useState(DEFAULT_COLUMNS);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_desc' | 'stock_asc' | 'price_desc' | 'price_asc' | 'newest' | 'oldest'>('name_asc');
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [barcodePrintProduct, setBarcodePrintProduct] = useState<OfflineProduct | null>(null);

    const scannerState = useBarcodeScanner((scannedBarcode) => {
        setSearchTerm(scannedBarcode);
    });

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );

    const filteredProducts = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name, 'id');
            case 'name_desc': return b.name.localeCompare(a.name, 'id');
            case 'stock_desc': return b.current_stock - a.current_stock;
            case 'stock_asc': return a.current_stock - b.current_stock;
            case 'price_desc': return b.sell_price - a.sell_price;
            case 'price_asc': return a.sell_price - b.sell_price;
            case 'newest': return new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime();
            case 'oldest': return new Date(a.created_at || a.updated_at || 0).getTime() - new Date(b.created_at || b.updated_at || 0).getTime();
            default: return 0;
        }
    });

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredProducts.map(p => p.id)));

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Hapus ${selectedIds.size} produk yang dipilih?`)) return;
        for (const id of Array.from(selectedIds)) await deleteProduct(id);
        setSelectedIds(new Set());
    };

    const isVisible = (key: string) => columns.find(c => c.key === key)?.visible ?? true;

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="w-full h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Master Data Produk</h1>
                    <p className="text-gray-500 text-sm">Kelola stok, harga, dan multi-satuan (grosir/ecer).</p>
                </div>
                <div className="flex gap-2 items-center">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors">
                            <Trash2 className="w-4 h-4" /> Hapus {selectedIds.size} Terpilih
                        </button>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> Produk Baru
                    </button>
                    <PageSettingsButton fields={columns} onUpdate={setColumns} />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col gap-4">
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari nama barang atau barcode..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                title="Hapus pencarian"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCameraScanner(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2.5 text-gray-600 hover:bg-slate-50"
                        title="Scan barcode dengan kamera"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as typeof sortBy)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary bg-white text-gray-600"
                    >
                        <option value="name_asc">A → Z</option>
                        <option value="name_desc">Z → A</option>
                        <option value="newest">Terbaru</option>
                        <option value="oldest">Terlama</option>
                        <option value="stock_desc">Stok Terbanyak</option>
                        <option value="stock_asc">Stok Terendah</option>
                        <option value="price_desc">Harga Tertinggi</option>
                        <option value="price_asc">Harga Terendah</option>
                    </select>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 border border-emerald-200">
                        <ScanLine className="w-3 h-3" />
                        Scanner siap
                    </span>
                    {scannerState.lastScannedValue && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600 border border-slate-200">
                            Barcode terakhir: {scannerState.lastScannedValue}
                        </span>
                    )}
                    <span className="text-gray-500">Scanner HID/keyboard dan kamera bisa dipakai untuk cari produk dari barcode.</span>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-slate-50 text-gray-700 uppercase font-semibold border-b text-xs">
                            <tr>
                                <th className="px-3 py-3 w-8">
                                    <button onClick={toggleAll} className="text-gray-400 hover:text-primary">
                                        {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">Nama Produk</th>
                                {isVisible('barcode') && <th className="px-3 py-3">Barcode</th>}
                                {isVisible('stock_base') && <th className="px-3 py-3 text-center">Stok (Besar)</th>}
                                {isVisible('stock_small') && <th className="px-3 py-3 text-center">Stok (Kecil)</th>}
                                {isVisible('base_unit') && <th className="px-3 py-3">Satuan</th>}
                                {isVisible('conversion_info') && <th className="px-3 py-3">Konversi</th>}
                                {isVisible('sell_price') && <th className="px-3 py-3 text-right">Harga Besar</th>}
                                {isVisible('small_price') && <th className="px-3 py-3 text-right">Harga Kecil</th>}
                                {isVisible('modal_price') && <th className="px-3 py-3 text-right">Modal</th>}
                                <th className="px-3 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan={10} className="text-center py-8">Memuat data produk...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-8 text-gray-500">Belum ada produk. Silakan tambah produk baru.</td></tr>
                            ) : (
                                filteredProducts.map(product => {
                                    const conversions = unitConversions.filter(c => c.product_id === product.id);
                                    // First/main conversion (small unit)
                                    const mainConv = conversions.length > 0 ? conversions[0] : null;
                                    const smallUnitPrice = mainConv
                                        ? (mainConv.price || Math.round(product.sell_price / mainConv.multiplier))
                                        : null;
                                    const stockInSmallUnit = mainConv
                                        ? parseFloat((product.current_stock * mainConv.multiplier).toFixed(3))
                                        : null;
                                    const isExpanded = expandedRows.has(product.id);
                                    const stockDisplay = parseFloat(Number(product.current_stock).toFixed(3));
                                    const isLow = product.current_stock <= (product.min_stock ?? 0);

                                    return (
                                        <>
                                            <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(product.id) ? 'bg-blue-50/60' : ''}`}>
                                                <td className="px-3 py-3">
                                                    <button onClick={() => toggleSelect(product.id)} className="text-gray-400 hover:text-primary">
                                                        {selectedIds.has(product.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    <div className="flex items-center gap-1">
                                                        {product.name}
                                                        {conversions.length > 1 && (
                                                            <button onClick={() => toggleRow(product.id)} className="text-gray-400 hover:text-primary ml-1">
                                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                {isVisible('barcode') && <td className="px-3 py-3 text-gray-500 font-mono text-xs">{product.barcode || '-'}</td>}
                                                {isVisible('stock_base') && (
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`font-bold ${isLow ? 'text-red-500' : 'text-emerald-600'}`}>
                                                            {stockDisplay}
                                                        </span>
                                                    </td>
                                                )}
                                                {isVisible('stock_small') && (
                                                    <td className="px-3 py-3 text-center">
                                                        {stockInSmallUnit !== null ? (
                                                            <span className={`font-semibold text-blue-600`}>{stockInSmallUnit}</span>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </td>
                                                )}
                                                {isVisible('base_unit') && <td className="px-3 py-3 text-gray-600">{product.base_unit}</td>}
                                                {isVisible('conversion_info') && (
                                                    <td className="px-3 py-3">
                                                        {mainConv ? (
                                                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5 font-medium">
                                                                1 {product.base_unit} = {mainConv.multiplier} {mainConv.unit_name}
                                                            </span>
                                                        ) : <span className="text-gray-300 text-xs">—</span>}
                                                    </td>
                                                )}
                                                {isVisible('sell_price') && (
                                                    <td className="px-3 py-3 text-right font-semibold text-gray-800">
                                                        Rp {Number(product.sell_price).toLocaleString('id-ID')}
                                                    </td>
                                                )}
                                                {isVisible('small_price') && (
                                                    <td className="px-3 py-3 text-right">
                                                        {smallUnitPrice !== null ? (
                                                            <span className="font-semibold text-blue-700">Rp {smallUnitPrice.toLocaleString('id-ID')}</span>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </td>
                                                )}
                                                {isVisible('modal_price') && (
                                                    <td className="px-3 py-3 text-right text-gray-500">
                                                        Rp {Number(product.base_price || 0).toLocaleString('id-ID')}
                                                    </td>
                                                )}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setStockInProduct(product)}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors bg-emerald-50/50 border border-emerald-100 flex items-center gap-1 text-xs font-medium"
                                                            title="Terima Barang (Stock In)"
                                                        >
                                                            <ArrowDownCircle className="w-3.5 h-3.5" /> In
                                                        </button>
                                                        <button
                                                            onClick={() => setEditProduct(product)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Produk"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setBarcodePrintProduct(product)}
                                                            className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                                            title="Print Barcode"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { if (confirm('Yakin ingin menghapus produk ini?')) deleteProduct(product.id); }}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded: additional conversions */}
                                            {isExpanded && conversions.slice(1).map(conv => (
                                                <tr key={`${product.id}-${conv.id}`} className="bg-blue-50/40 border-l-4 border-l-blue-200">
                                                    <td className="px-4 py-2 pl-8 text-xs text-blue-700 italic">
                                                        ↳ Satuan: {conv.unit_name}
                                                    </td>
                                                    {isVisible('barcode') && <td className="px-3 py-2 text-xs text-gray-400">-</td>}
                                                    {isVisible('stock_base') && <td className="px-3 py-2 text-center text-xs text-gray-400">-</td>}
                                                    {isVisible('stock_small') && (
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-xs font-semibold text-blue-600">
                                                                {parseFloat((product.current_stock * conv.multiplier).toFixed(3))}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {isVisible('base_unit') && <td className="px-3 py-2 text-xs text-blue-700">{conv.unit_name}</td>}
                                                    {isVisible('conversion_info') && (
                                                        <td className="px-3 py-2">
                                                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-0.5">
                                                                1 {product.base_unit} = {conv.multiplier} {conv.unit_name}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {isVisible('sell_price') && <td className="px-3 py-2 text-right text-xs text-gray-400">-</td>}
                                                    {isVisible('small_price') && (
                                                        <td className="px-3 py-2 text-right">
                                                            <span className="text-xs font-semibold text-blue-700">
                                                                Rp {(conv.price || Math.round(product.sell_price / conv.multiplier)).toLocaleString('id-ID')}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {isVisible('modal_price') && <td className="px-3 py-2 text-right text-xs text-gray-400">-</td>}
                                                    <td className="px-3 py-2"></td>
                                                </tr>
                                            ))}
                                        </>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {(isModalOpen || editProduct) && (
                <ProductFormModal
                    onClose={() => { setIsModalOpen(false); setEditProduct(null); }}
                    editProduct={editProduct || undefined}
                    editConversions={editProduct ? unitConversions.filter(c => c.product_id === editProduct.id) : undefined}
                />
            )}
            {stockInProduct && (
                <StockInModal
                    product={stockInProduct}
                    conversions={unitConversions.filter(c => c.product_id === stockInProduct.id)}
                    onClose={() => setStockInProduct(null)}
                />
            )}
            <CameraBarcodeScannerModal
                open={showCameraScanner}
                title="Scan Barcode Produk"
                onClose={() => setShowCameraScanner(false)}
                onDetected={(scannedBarcode) => setSearchTerm(scannedBarcode)}
            />
            {barcodePrintProduct && (
                <BarcodePrintModal
                    product={barcodePrintProduct}
                    onClose={() => setBarcodePrintProduct(null)}
                />
            )}
        </div>
    );
}
