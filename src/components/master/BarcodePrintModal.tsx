'use client';

import { useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { OfflineProduct } from '@/lib/dexie';
import { barcodeSvgToDataUri, renderCode128Svg } from '@/lib/code128';

interface Props {
    product: OfflineProduct;
    onClose: () => void;
}

export function BarcodePrintModal({ product, onClose }: Props) {
    const [labelSize, setLabelSize] = useState<'large' | 'small'>('small');
    const barcodeValue = useMemo(() => product.barcode?.trim() || product.id.slice(0, 12).toUpperCase(), [product.barcode, product.id]);
    const svgMarkup = useMemo(() => renderCode128Svg(barcodeValue, labelSize === 'small'
        ? { moduleWidth: 1.2, height: 42, fontSize: 10, quietZone: 8 }
        : { moduleWidth: 1.8, height: 56, fontSize: 12, quietZone: 10 }), [barcodeValue, labelSize]);
    const previewDataUri = useMemo(() => barcodeSvgToDataUri(svgMarkup), [svgMarkup]);

    const handlePrint = () => {
        const win = window.open('', '_blank', 'width=420,height=520');
        if (!win) {
            alert('Popup diblokir browser. Izinkan popup untuk cetak barcode.');
            return;
        }

        win.document.write(`
            <!doctype html>
            <html>
            <head>
                <title>Cetak Barcode - ${product.name}</title>
                <style>
                    @page { size: 58mm auto; margin: 4mm; }
                    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
                    .label { width: ${labelSize === 'small' ? '42mm' : '50mm'}; margin: 0 auto; text-align: center; }
                    .name { font-size: ${labelSize === 'small' ? '10px' : '12px'}; font-weight: 700; margin-bottom: ${labelSize === 'small' ? '4px' : '6px'}; word-break: break-word; }
                    .price { font-size: ${labelSize === 'small' ? '10px' : '12px'}; color: #047857; margin: 6px 0 2px; font-weight: 700; }
                    .meta { font-size: ${labelSize === 'small' ? '9px' : '10px'}; color: #64748b; }
                    img { width: 100%; height: auto; display: block; }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="name">${product.name}</div>
                    <img src="${barcodeSvgToDataUri(svgMarkup)}" alt="Barcode ${barcodeValue}" />
                    <div class="price">Rp ${Number(product.sell_price || 0).toLocaleString('id-ID')}/${product.base_unit}</div>
                    <div class="meta">${barcodeValue}</div>
                </div>
                <script>
                    setTimeout(function () {
                        window.print();
                        window.close();
                    }, 250);
                </script>
            </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Print Barcode</h3>
                        <p className="text-xs text-gray-500 mt-1">Cetak label barcode produk untuk rak atau kemasan.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-gray-800 mb-2">Ukuran Label</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setLabelSize('small')}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${labelSize === 'small' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                            >
                                Kecil
                            </button>
                            <button
                                type="button"
                                onClick={() => setLabelSize('large')}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${labelSize === 'large' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                            >
                                Besar
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">
                            {labelSize === 'small'
                                ? 'Mode kecil lebih hemat kertas dan cocok untuk tempel langsung di barang.'
                                : 'Mode besar cocok untuk label rak dengan nama dan harga lebih jelas.'}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                        <p className="text-sm font-semibold text-gray-800">{product.name}</p>
                        <div className={`mx-auto my-3 ${labelSize === 'small' ? 'max-w-[190px]' : 'max-w-[250px]'}`}>
                            <img src={previewDataUri} alt={`Barcode ${barcodeValue}`} className="w-full h-auto" />
                        </div>
                        <p className="text-sm font-bold text-emerald-700">Rp {Number(product.sell_price || 0).toLocaleString('id-ID')}/{product.base_unit}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{barcodeValue}</p>
                    </div>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="w-full rounded-xl bg-primary px-4 py-3 text-white font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print Barcode 58mm ({labelSize === 'small' ? 'Kecil' : 'Besar'})
                    </button>
                </div>
            </div>
        </div>
    );
}
