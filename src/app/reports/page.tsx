'use client';

import { useState, useEffect } from 'react';
import { db, OfflineSaleQueue, OfflineExpense } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useBranchStore } from '@/store/branchStore';
import {
    TrendingUp, TrendingDown, DollarSign, Calendar, Package,
    X, ChevronRight, BarChart2, ArrowUpRight, Download, ChevronDown,
    AlertTriangle, CheckCircle2
} from 'lucide-react';

interface AssetItem {
    name: string;
    unit: string;
    qty: number;
    costPrice: number;
    sellPrice: number;
    stockValueCost: number;
    stockValueSell: number;
}

interface DailyPoint {
    date: string;
    label: string;
    value: number;
    count?: number;
}

type DrillDownKey = 'revenue' | 'cogs' | 'gross_profit' | 'expense' | null;

// ─── Inline SVG Bar Chart ───────────────────────────────────────────────────
function BarChart({ data, color, height = 180 }: { data: DailyPoint[]; color: string; height?: number }) {
    if (!data.length) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Tidak ada data dalam rentang ini</div>;

    const max = Math.max(...data.map(d => d.value), 1);
    const W = 100 / data.length; // each bar occupies W% width
    const padY = 24;
    const barAreaH = height - padY;

    return (
        <div className="w-full" style={{ height }}>
            <svg viewBox={`0 0 ${data.length * 60} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                {/* Y axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
                    <line
                        key={i}
                        x1={0} y1={padY + (1 - frac) * barAreaH}
                        x2={data.length * 60} y2={padY + (1 - frac) * barAreaH}
                        stroke="#f1f5f9" strokeWidth={1}
                    />
                ))}
                {data.map((d, i) => {
                    const barH = Math.max(2, (d.value / max) * barAreaH);
                    const x = i * 60 + 6;
                    const y = padY + barAreaH - barH;
                    const pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
                    return (
                        <g key={i}>
                            <rect
                                x={x} y={y} width={48} height={barH}
                                rx={6} fill={color} fillOpacity={0.85}
                                className="transition-all"
                            />
                            {/* Value label on top */}
                            {pct > 10 && (
                                <text x={x + 24} y={y - 4} fontSize={9} textAnchor="middle" fill="#64748b" fontWeight="600">
                                    {d.value >= 1000000
                                        ? (d.value / 1000000).toFixed(1) + 'jt'
                                        : d.value >= 1000
                                            ? (d.value / 1000).toFixed(0) + 'rb'
                                            : d.value.toFixed(0)}
                                </text>
                            )}
                            {/* X label */}
                            <text x={x + 24} y={height - 2} fontSize={9} textAnchor="middle" fill="#94a3b8">
                                {d.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── Drill-Down Modal ───────────────────────────────────────────────────────
function DrillDownModal({
    title, subtitle, value, color, data, tableRows, onClose
}: {
    title: string;
    subtitle: string;
    value: number;
    color: string;
    data: DailyPoint[];
    tableRows: { id: string; label: string; value: number; sub?: string; dateISO?: string; children?: { label: string; value: number; sub?: string }[] }[];
    onClose: () => void;
}) {
    const [sortBy, setSortBy] = useState<'value' | 'date'>('date');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const sortedRows = [...tableRows].sort((a, b) => {
        if (sortBy === 'value') return b.value - a.value;
        return new Date(b.dateISO || 0).getTime() - new Date(a.dateISO || 0).getTime();
    });

    return (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div
                className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{subtitle}</p>
                        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                        <p className="text-2xl font-black mt-0.5" style={{ color }}>Rp {value.toLocaleString('id-ID')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-6">
                    {/* Chart */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                            <BarChart2 className="w-3.5 h-3.5" /> Grafik Per Hari
                        </p>
                        {data.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-gray-400 text-sm border border-dashed rounded-xl">
                                Tidak ada data dalam rentang tanggal ini
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-3 border">
                                <BarChart data={data} color={color} height={180} />
                            </div>
                        )}
                    </div>

                    {/* Detail Table */}
                    {tableRows.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rincian</p>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value as any)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary bg-slate-50 text-gray-700 font-semibold cursor-pointer"
                                    title="Urutkan Data"
                                >
                                    <option value="date">Terbaru (Waktu)</option>
                                    <option value="value">Nilai Terbesar</option>
                                </select>
                            </div>
                            <div className="border rounded-xl overflow-hidden divide-y">
                                {sortedRows.slice(0, 100).map((row, i) => (
                                    <div key={row.id || i} className="flex flex-col">
                                        <div
                                            className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${row.children && row.children.length > 0 ? 'cursor-pointer' : ''}`}
                                            onClick={() => {
                                                if (row.children && row.children.length > 0) {
                                                    setExpandedId(expandedId === row.id ? null : row.id);
                                                }
                                            }}
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{row.label}</p>
                                                {row.sub && <p className="text-xs text-gray-400">{row.sub}</p>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-sm font-bold text-gray-700 font-mono">Rp {row.value.toLocaleString('id-ID')}</p>
                                                {row.children && row.children.length > 0 && (
                                                    <span className="text-gray-400">
                                                        {expandedId === row.id ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform" /> : <ChevronDown className="w-4 h-4 transition-transform" />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {expandedId === row.id && row.children && (
                                            <div className="bg-slate-50/50 border-t px-4 py-2 divide-y border-b">
                                                <div className="py-1 min-w-full">
                                                    {row.children.map((child, j) => (
                                                        <div key={j} className="flex items-center justify-between py-2 text-sm pl-4 relative">
                                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"></div>
                                                            <div className="absolute left-0 top-1/2 w-3 h-px bg-slate-200"></div>
                                                            <div>
                                                                <p className="font-medium text-gray-700">{child.label}</p>
                                                                {child.sub && <p className="text-xs text-gray-400">{child.sub}</p>}
                                                            </div>
                                                            <p className="font-semibold text-gray-600 font-mono">Rp {child.value.toLocaleString('id-ID')}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {tableRows.length > 100 && (
                                    <div className="px-4 py-2 text-xs text-gray-400 text-center bg-slate-50">
                                        + {tableRows.length - 100} baris lainnya
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(sales: OfflineSaleQueue[], expenses: OfflineExpense[]) {
    const rows: string[] = ['type,tanggal,keterangan,jumlah'];
    for (const s of sales) {
        if (s.voided) continue;
        rows.push(`penjualan,${s.created_at},${s.receipt_number} (${s.payment_method}),${s.total}`);
    }
    for (const e of expenses) {
        rows.push(`pengeluaran,${e.expense_date},${e.description},${e.amount}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Monthly Trend Tab ────────────────────────────────────────────────────────
function MonthlyTrendTab() {
    const [months, setMonths] = useState<{ label: string; revenue: number; cogs: number; profit: number; txCount: number }[]>([]);

    useEffect(() => {
        (async () => {
            const local = await db.sale_queue.toArray();
            let remote: OfflineSaleQueue[] = [];

            if (navigator.onLine) {
                // Get start date for 6 months ago
                const d = new Date();
                d.setMonth(d.getMonth() - 5);
                d.setDate(1);
                const startStr = d.toISOString();

                const { data } = await supabase
                    .from('sales')
                    .select('*, details:sale_details(*)')
                    .gte('created_at', startStr);

                if (data) {
                    remote = data.map(s => ({
                        ...s,
                        details: s.details.map((d: any) => ({
                            ...d,
                            _productName: d.product_name || d._productName
                        }))
                    }));
                }
            }

            // Merge
            const combined = [...local];
            const localReceipts = new Set(local.map(s => s.receipt_number));
            for (const r of remote) {
                if (!localReceipts.has(r.receipt_number)) combined.push(r);
            }

            const result: typeof months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const year = d.getFullYear();
                const month = d.getMonth();
                const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
                const monthSales = combined.filter(s => {
                    if (s.voided) return false;
                    const sd = new Date(s.created_at);
                    return sd.getFullYear() === year && sd.getMonth() === month;
                });
                const revenue = monthSales.reduce((a, s) => a + s.total, 0);
                const cogs = monthSales.reduce((a, s) => a + s.details.reduce((b: number, d: any) => b + (d.cogs_subtotal || 0), 0), 0);
                result.push({ label, revenue, cogs, profit: revenue - cogs, txCount: monthSales.length });
            }
            setMonths(result);
        })();
    }, []);

    const maxVal = Math.max(...months.map(m => m.revenue), 1);
    const barH = 160;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-600 mb-4">📈 Trend Pendapatan 6 Bulan Terakhir</p>
                <div className="flex items-end gap-3 h-44">
                    {months.map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: barH }}>
                                <div title={`Profit: Rp ${m.profit.toLocaleString('id-ID')}`} style={{ height: `${Math.max(2, (m.profit / maxVal) * barH)}px` }} className="w-full bg-emerald-500 rounded-t-lg" />
                                <div title={`COGS: Rp ${m.cogs.toLocaleString('id-ID')}`} style={{ height: `${Math.max(2, (m.cogs / maxVal) * barH)}px` }} className="w-full bg-red-300" />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Laba Kotor</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block" /> HPP</span>
                </div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase font-semibold text-gray-600 bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3">Bulan</th>
                            <th className="px-4 py-3 text-right">Omset</th>
                            <th className="px-4 py-3 text-right">HPP</th>
                            <th className="px-4 py-3 text-right">Laba Kotor</th>
                            <th className="px-4 py-3 text-center">Transaksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {months.map((m, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-semibold text-gray-800">{m.label}</td>
                                <td className="px-4 py-3 text-right font-mono text-gray-700">Rp {m.revenue.toLocaleString('id-ID')}</td>
                                <td className="px-4 py-3 text-right font-mono text-red-600">Rp {m.cogs.toLocaleString('id-ID')}</td>
                                <td className={`px-4 py-3 text-right font-mono font-bold ${m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Rp {m.profit.toLocaleString('id-ID')}</td>
                                <td className="px-4 py-3 text-center text-gray-500">{m.txCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function ReportsPage() {
    const { activeBranch } = useBranchStore();
    const [sales, setSales] = useState<OfflineSaleQueue[]>([]);
    const [expenses, setExpenses] = useState<OfflineExpense[]>([]);
    const [assetItems, setAssetItems] = useState<AssetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deadStockItems, setDeadStockItems] = useState<AssetItem[]>([]);
    const [activeTab, setActiveTab] = useState<'laba_rugi' | 'aset' | 'arus_kas' | 'trend'>('laba_rugi');
    const [drillDown, setDrillDown] = useState<DrillDownKey>(null);
    const [productMap, setProductMap] = useState<Record<string, string>>({});

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        // Use local date string YYYY-MM-DD
        return d.toLocaleDateString('en-CA');
    });
    const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString('en-CA'));

    useEffect(() => {
        loadReportData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBranch?.id, startDate, endDate]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            // 1. Get LOCAL data
            const localSales = await db.sale_queue.toArray();
            const localExpenses = await db.expenses.toArray();

            // 2. Get REMOTE data if online
            let remoteSales: OfflineSaleQueue[] = [];
            let remoteExpenses: OfflineExpense[] = [];

            if (navigator.onLine) {
                const sStr = new Date(startDate + 'T00:00:00').toISOString();
                const eStr = new Date(endDate + 'T23:59:59').toISOString();

                const { data: sData } = await supabase
                    .from('sales')
                    .select('*, details:sale_details(*)')
                    .gte('created_at', sStr)
                    .lte('created_at', eStr);

                if (sData) {
                    remoteSales = sData.map(s => ({
                        ...s,
                        details: s.details.map((d: any) => ({
                            ...d,
                            _productName: d.product_name || d._productName
                        }))
                    }));
                }

                const { data: eData } = await supabase
                    .from('expenses')
                    .select('*')
                    .gte('expense_date', startDate)
                    .lte('expense_date', endDate);

                if (eData) remoteExpenses = eData;
            }

            // 3. MERGE & DEDUPLICATE (Local wins over Remote)
            const combinedSales = [...localSales];
            const localReceipts = new Set(localSales.map(s => s.receipt_number));
            for (const rs of remoteSales) {
                if (!localReceipts.has(rs.receipt_number)) {
                    combinedSales.push(rs);
                }
            }

            const combinedExpenses = [...localExpenses];
            const localExpIds = new Set(localExpenses.map(e => e.id));
            for (const re of remoteExpenses) {
                if (!localExpIds.has(re.id)) {
                    combinedExpenses.push(re);
                }
            }

            // 4. FILTER (by branch and date, though date is mostly handled by query)
            const startMs = new Date(startDate + 'T00:00:00').getTime();
            const endMs = new Date(endDate + 'T23:59:59').getTime();

            const finalSales = combinedSales.filter(s => {
                const t = new Date(s.created_at).getTime();
                const inDate = t >= startMs && t <= endMs;
                const inBranch = !activeBranch || !s.branch_id || s.branch_id === activeBranch.id;
                return inDate && inBranch && !s.voided;
            });

            const finalExpenses = combinedExpenses.filter(e => {
                const inDate = e.expense_date >= startDate && e.expense_date <= endDate;
                const inBranch = !activeBranch || !e.branch_id || e.branch_id === activeBranch.id;
                return inDate && inBranch;
            });

            setSales(finalSales);
            setExpenses(finalExpenses);

            // Asset data remains local as it's a current snapshot
            const allProducts = await db.products.toArray();

            const pMap: Record<string, string> = {};
            allProducts.forEach(p => { pMap[p.id] = p.name; });
            setProductMap(pMap);
            const assetData: AssetItem[] = allProducts
                .filter(p => p.current_stock > 0)
                .map(p => ({
                    name: p.name,
                    unit: p.base_unit,
                    qty: parseFloat(Number(p.current_stock).toFixed(3)),
                    costPrice: p.base_price || 0,
                    sellPrice: p.sell_price,
                    stockValueCost: (p.base_price || 0) * p.current_stock,
                    stockValueSell: p.sell_price * p.current_stock,
                }))
                .sort((a, b) => b.stockValueCost - a.stockValueCost);

            setAssetItems(assetData);

            // 5. Calculate DEAD STOCK (No sales in last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

            const recentSales = combinedSales.filter(s => new Date(s.created_at).getTime() >= thirtyDaysAgoMs && !s.voided);
            const soldProductIds = new Set<string>();
            recentSales.forEach(s => s.details.forEach((d: any) => soldProductIds.add(d.product_id)));

            const deadStock = assetData.filter(item => {
                const product = allProducts.find(p => p.name === item.name);
                return product && !soldProductIds.has(product.id);
            });
            setDeadStockItems(deadStock);
        } catch (error) {
            console.error('Failed to load report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalCOGS = sales.reduce((acc, sale) => {
        return acc + sale.details.reduce((sum, d) => sum + (d.cogs_subtotal || 0), 0);
    }, 0);
    const grossProfit = totalRevenue - totalCOGS;

    // Memisahkan pengeluaran: Operasional VS Modal (Arus Kas)
    const operationalExpenses = expenses.filter(e => e.category !== 'Pembelian Stok (Tunai)' && e.category !== 'Pembayaran Hutang Supplier');
    const capitalExpenses = expenses.filter(e => e.category === 'Pembelian Stok (Tunai)' || e.category === 'Pembayaran Hutang Supplier');

    const totalExpense = operationalExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const totalCapitalOutflow = capitalExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netProfit = grossProfit - totalExpense;

    const totalAssetCost = assetItems.reduce((acc, i) => acc + i.stockValueCost, 0);
    const totalAssetSell = assetItems.reduce((acc, i) => acc + i.stockValueSell, 0);
    const potentialProfit = totalAssetSell - totalAssetCost;

    // ── Build daily data for charts ──────────────────────────────────────────
    const getDailyData = (key: DrillDownKey): DailyPoint[] => {
        if (!key) return [];

        // build a map: date string → value
        const map: Record<string, number> = {};

        if (key === 'revenue' || key === 'cogs' || key === 'gross_profit') {
            sales.forEach(sale => {
                const day = sale.created_at.split('T')[0];
                if (!map[day]) map[day] = 0;
                if (key === 'revenue') map[day] += sale.total;
                if (key === 'cogs') map[day] += sale.details.reduce((s, d) => s + (d.cogs_subtotal || 0), 0);
                if (key === 'gross_profit') {
                    const rev = sale.total;
                    const cogs = sale.details.reduce((s, d) => s + (d.cogs_subtotal || 0), 0);
                    map[day] += rev - cogs;
                }
            });
        }

        if (key === 'expense') {
            operationalExpenses.forEach(exp => {
                const day = exp.expense_date;
                if (!map[day]) map[day] = 0;
                map[day] += exp.amount;
            });
        }

        // Fill all dates in range even if 0
        const result: DailyPoint[] = [];
        const cur = new Date(startDate);
        const end = new Date(endDate);
        while (cur <= end) {
            const ds = cur.toISOString().split('T')[0];
            const d = new Date(ds);
            result.push({
                date: ds,
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                value: map[ds] || 0,
            });
            cur.setDate(cur.getDate() + 1);
        }
        return result;
    };

    const getTableRows = (key: DrillDownKey): { id: string; label: string; value: number; sub?: string; dateISO?: string; children?: { label: string; value: number; sub?: string }[] }[] => {
        if (!key) return [];

        if (key === 'revenue') {
            return sales.map(sale => ({
                id: `rev-${sale.local_id || sale.receipt_number}`,
                label: `Transaksi #${sale.receipt_number || String(sale.local_id || '').slice(0, 8)}`,
                value: sale.total,
                sub: new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
                dateISO: sale.created_at,
                children: sale.details.map((d: any) => ({
                    label: d._productName || productMap[d.product_id] || d.product_id,
                    value: d.subtotal,
                    sub: `${d.qty} ${d.unit_name}`
                }))
            }));
        }

        if (key === 'cogs') {
            return sales.map(sale => {
                const cogs = sale.details.reduce((s: number, d: any) => s + (d.cogs_subtotal || 0), 0);
                return {
                    id: `cogs-${sale.local_id || sale.receipt_number}`,
                    label: `Transaksi #${sale.receipt_number || String(sale.local_id || '').slice(0, 8)}`,
                    value: cogs,
                    sub: new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
                    dateISO: sale.created_at,
                    children: sale.details.map((d: any) => ({
                        label: d._productName || productMap[d.product_id] || d.product_id,
                        value: d.cogs_subtotal || 0,
                        sub: `${d.qty} ${d.unit_name} (HPP)`
                    }))
                };
            });
        }

        if (key === 'gross_profit') {
            return sales.map(sale => {
                const cogs = sale.details.reduce((s: number, d: any) => s + (d.cogs_subtotal || 0), 0);
                return {
                    id: `gp-${sale.local_id || sale.receipt_number}`,
                    label: `Transaksi #${sale.receipt_number || String(sale.local_id || '').slice(0, 8)}`,
                    value: sale.total - cogs,
                    sub: new Date(sale.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
                    dateISO: sale.created_at,
                    children: sale.details.map((d: any) => {
                        const ratio = sale.subtotal > 0 ? d.subtotal / sale.subtotal : 0;
                        const netRevenue = d.subtotal - (sale.discount * ratio) + (sale.tax * ratio);
                        return {
                            label: d._productName || productMap[d.product_id] || d.product_id,
                            value: netRevenue - (d.cogs_subtotal || 0),
                            sub: `${d.qty} ${d.unit_name} (Laba Kotor)`
                        };
                    })
                };
            });
        }

        if (key === 'expense') {
            return operationalExpenses.map(exp => ({
                id: `exp-${exp.id}`,
                label: exp.description || exp.category || 'Pengeluaran',
                value: exp.amount,
                sub: exp.expense_date,
                dateISO: exp.created_at || exp.expense_date
            }));
        }

        return [];
    };

    const DRILL_CONFIG: Record<NonNullable<DrillDownKey>, { title: string; subtitle: string; value: number; color: string }> = {
        revenue: { title: 'Pendapatan Kotor (Omset)', subtitle: 'Detail Pendapatan', value: totalRevenue, color: '#059669' },
        cogs: { title: 'HPP (Modal Barang)', subtitle: 'Cost of Goods Sold', value: totalCOGS, color: '#dc2626' },
        gross_profit: { title: 'Laba Kotor', subtitle: 'Pendapatan - HPP', value: grossProfit, color: '#2563eb' },
        expense: { title: 'Total Pengeluaran', subtitle: 'Rincian Biaya Operasional', value: totalExpense, color: '#d97706' },
    };

    const SummaryCard = ({
        metric, label, value, badge, colorClass, ringColor
    }: {
        metric: DrillDownKey;
        label: string;
        value: number;
        badge: string;
        colorClass: string;
        ringColor: string;
    }) => (
        <button
            onClick={() => setDrillDown(metric)}
            className={`bg-white p-5 rounded-2xl shadow-sm border ${ringColor} relative overflow-hidden group text-left hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer w-full focus:outline-none focus:ring-2 focus:ring-primary`}
        >
            <div className={`absolute -right-4 -top-4 w-20 h-20 ${colorClass} rounded-full group-hover:scale-150 transition-transform duration-500`} />
            <div className="relative z-20">
                <p className="text-gray-500 text-sm font-medium mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-gray-800">Rp {value.toLocaleString('id-ID')}</h3>
                <div className="flex items-center justify-between mt-2">
                    <p className={`text-xs font-medium inline-block px-2 py-1 rounded ${colorClass} text-${colorClass.includes('emerald') ? 'emerald' : colorClass.includes('red') ? 'red' : colorClass.includes('blue') ? 'blue' : 'orange'}-600`}>{badge}</p>
                    <span className="text-xs text-gray-400 flex items-center gap-0.5 group-hover:text-primary transition-colors">
                        Detail <ChevronRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </button>
    );

    return (
        <div className="w-full flex flex-col gap-6 pb-20 md:pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-emerald-600" /> Laporan Pusat
                    </h1>
                    <p className="text-gray-500 text-sm">Laba Rugi, HPP, Pengeluaran &amp; Nilai Aset Stok Realtime.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* CSV Export */}
                    <button
                        onClick={() => exportCSV(sales, expenses)}
                        className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-gray-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('laba_rugi')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'laba_rugi' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>📊 Laba / Rugi</button>
                        <button onClick={() => setActiveTab('arus_kas')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'arus_kas' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>💸 Arus Kas</button>
                        <button onClick={() => setActiveTab('trend')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'trend' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>📈 Trend</button>
                        <button onClick={() => setActiveTab('aset')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'aset' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>📦 Aset Stok</button>
                    </div>
                </div>
            </div>

            {/* Date filter */}
            {(activeTab === 'laba_rugi' || activeTab === 'arus_kas') && (
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border self-start">
                    <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 outline-none text-sm font-medium text-gray-700 bg-transparent" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 outline-none text-sm font-medium text-gray-700 bg-transparent" />
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">Memuat laporan...</div>
            ) : activeTab === 'laba_rugi' ? (
                <>
                    {/* Hint */}
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> Klik kartu untuk melihat grafik &amp; rincian detail
                    </p>

                    {/* Summary Cards — all clickable */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                            metric="revenue"
                            label="Pendapatan Kotor (Omset)"
                            value={totalRevenue}
                            badge={`Dari ${sales.length} Transaksi`}
                            colorClass="bg-emerald-50"
                            ringColor="border-emerald-100"
                        />
                        <SummaryCard
                            metric="cogs"
                            label="HPP (Modal Barang)"
                            value={totalCOGS}
                            badge="Cost of Goods Sold"
                            colorClass="bg-red-50"
                            ringColor="border-red-50"
                        />
                        <SummaryCard
                            metric="gross_profit"
                            label="Laba Kotor"
                            value={grossProfit}
                            badge="Pendapatan - HPP"
                            colorClass="bg-blue-50"
                            ringColor="border-blue-100"
                        />
                        <SummaryCard
                            metric="expense"
                            label="Total Pengeluaran Toko"
                            value={totalExpense}
                            badge={`Dari ${expenses.length} Catatan Biaya`}
                            colorClass="bg-orange-50"
                            ringColor="border-orange-100"
                        />
                    </div>

                    {/* Net Profit Banner */}
                    <div
                        className={`p-8 rounded-2xl border ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'} shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden`}
                    >
                        <div className="absolute right-0 top-0 w-64 h-64 bg-white/40 rounded-full blur-3xl" />
                        <div className="absolute left-0 bottom-0 w-64 h-64 bg-white/40 rounded-full blur-3xl" />
                        <div className="relative z-10 w-full max-w-2xl">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                                {netProfit >= 0 ? <DollarSign className="w-8 h-8 text-emerald-600" /> : <TrendingDown className="w-8 h-8 text-red-600" />}
                            </div>
                            <h2 className="text-gray-500 font-semibold mb-2 uppercase tracking-wider text-sm">Laba Bersih (Net Profit)</h2>
                            <h1 className={`text-5xl font-black mb-6 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                Rp {netProfit.toLocaleString('id-ID')}
                            </h1>
                            <div className="flex items-center justify-between text-sm w-full bg-white/60 p-4 rounded-xl backdrop-blur-sm border border-white/50">
                                <div className="text-center px-4 border-r border-slate-200/50 flex-1">
                                    <p className="text-gray-500 mb-1">Margin Kotor</p>
                                    <p className="font-bold text-gray-800">{totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
                                </div>
                                <div className="text-center px-4 flex-1">
                                    <p className="text-gray-500 mb-1">Margin Bersih</p>
                                    <p className="font-bold text-gray-800">{totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : activeTab === 'arus_kas' ? (
                /* ARUS KAS TAB */
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange-50 rounded-full" />
                            <div className="relative z-10">
                                <p className="text-gray-500 text-sm font-medium mb-1 flex items-center gap-2">
                                    Total Pengeluaran Operasional
                                </p>
                                <h3 className="text-2xl font-bold text-orange-600">Rp {totalExpense.toLocaleString('id-ID')}</h3>
                                <p className="text-xs text-gray-400 mt-1">Biaya non-aset (gaji, listrik, bensin, dll) yang memotong Laba</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-50 rounded-full" />
                            <div className="relative z-10">
                                <p className="text-gray-500 text-sm font-medium mb-1">Pengeluaran Pembelian Aset / Hutang</p>
                                <h3 className="text-2xl font-bold text-purple-700">Rp {totalCapitalOutflow.toLocaleString('id-ID')}</h3>
                                <p className="text-xs text-gray-400 mt-1">Belanja persediaan stok dan pelunasan hutang supplier (tidak memotong Laba)</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b bg-slate-50">
                            <p className="text-sm font-bold text-gray-700">Rincian Catatan Arus Kas Keluar (Non-Operasional)</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[11px] uppercase font-bold text-gray-400 bg-white border-b">
                                    <tr>
                                        <th className="px-5 py-3">Tanggal</th>
                                        <th className="px-5 py-3 font-semibold">Kategori</th>
                                        <th className="px-5 py-3">Metode</th>
                                        <th className="px-5 py-3">Keterangan</th>
                                        <th className="px-5 py-3 text-right">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {capitalExpenses.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-10 text-gray-400">Tidak ada catatan arus kas keluar di periode ini.</td></tr>
                                    ) : capitalExpenses.map(exp => (
                                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3 text-gray-500">{exp.expense_date}</td>
                                            <td className="px-5 py-3 font-semibold text-purple-700">{exp.category}</td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${exp.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        exp.payment_method === 'kas_besar' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                            'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                    {exp.payment_method === 'cash' ? '💵 Laci' :
                                                        exp.payment_method === 'kas_besar' ? '🏠 Brankas' :
                                                            exp.payment_method?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-700">{exp.description || '-'}</td>
                                            <td className="px-5 py-3 text-right font-bold text-gray-900">Rp {exp.amount.toLocaleString('id-ID')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'trend' ? (
                /* TREND BULANAN TAB */
                <MonthlyTrendTab />
            ) : (
                /* ASET TAB */
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="w-5 h-5 text-slate-500" />
                                <p className="text-sm font-medium text-gray-500">Total Produk Stok Aktif</p>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">{assetItems.length} item</h3>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between">
                            <p className="text-sm font-medium text-gray-500 mb-2">💰 Nilai Aset (HPP)</p>
                            <h3 className="text-2xl font-bold text-blue-700">Rp {totalAssetCost.toLocaleString('id-ID')}</h3>
                            <p className="text-xs text-gray-400 mt-1">Nilai beli semua stok saat ini</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
                            <p className="text-sm font-medium text-gray-500 mb-2">🏷️ Nilai Aset (Harga Jual)</p>
                            <h3 className="text-2xl font-bold text-emerald-700">Rp {totalAssetSell.toLocaleString('id-ID')}</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                Potensi profit: <span className="font-semibold text-emerald-600">Rp {potentialProfit.toLocaleString('id-ID')}</span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                            <div className="px-5 py-4 border-b bg-slate-50 flex justify-between items-center">
                                <p className="text-sm font-bold text-gray-700">Rincian Nilai Stok per Produk (Realtime)</p>
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded">SORT BY VALUE</span>
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="text-[11px] uppercase font-bold text-gray-400 bg-white sticky top-0 z-10 border-b">
                                        <tr>
                                            <th className="px-5 py-3 text-left">Nama Produk</th>
                                            <th className="px-5 py-3 text-center">Stok</th>
                                            <th className="px-5 py-3 text-right">Modal</th>
                                            <th className="px-5 py-3 text-right">Nilai HPP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {assetItems.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center py-20 text-gray-400 font-medium">Belum ada stok aktif.</td></tr>
                                        ) : assetItems.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-5 py-3.5 font-semibold text-gray-800">{item.name}</td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="font-mono text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded text-xs">{item.qty} {item.unit}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-mono text-gray-500 text-xs">Rp {item.costPrice.toLocaleString('id-ID')}</td>
                                                <td className="px-5 py-3.5 text-right font-mono font-bold text-blue-700">Rp {item.stockValueCost.toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col border-red-100">
                            <div className="px-5 py-4 border-b bg-red-50 flex flex-col">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-bold text-red-800 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> DEAD STOCK (Stok Mati)
                                    </p>
                                    <span className="bg-red-200 text-red-800 text-[10px] font-black px-2 py-0.5 rounded">{deadStockItems.length} ITEM</span>
                                </div>
                                <p className="text-[10px] text-red-600 mt-1 font-medium">Produk dengan stok aktif namun tidak ada penjualan dalam 30 hari terakhir.</p>
                            </div>
                            <div className="overflow-y-auto max-h-[500px] divide-y divide-red-50 custom-scrollbar">
                                {deadStockItems.length === 0 ? (
                                    <div className="text-center py-20 px-6">
                                        <div className="bg-emerald-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium tracking-tight">Semua produk Anda laku dalam 30 hari terakhir! 🎉</p>
                                    </div>
                                ) : deadStockItems.map((item, i) => (
                                    <div key={i} className="p-4 hover:bg-red-50/30 transition-colors">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-800 leading-tight">{item.name}</p>
                                                <p className="text-[10px] text-gray-400 font-semibold mt-1 uppercase">Sisa Stok: {item.qty} {item.unit}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-red-600">Rp {item.stockValueCost.toLocaleString('id-ID')}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">NILAI MENGENDAP</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {deadStockItems.length > 0 && (
                                <div className="p-4 bg-red-50/50 border-t border-red-100">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Total Modal Mengendap</span>
                                        <span className="text-sm font-black text-red-700">Rp {deadStockItems.reduce((a, b) => a + b.stockValueCost, 0).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Drill-Down Modal */}
            {drillDown && (
                <DrillDownModal
                    {...DRILL_CONFIG[drillDown]}
                    data={getDailyData(drillDown)}
                    tableRows={getTableRows(drillDown)}
                    onClose={() => setDrillDown(null)}
                />
            )}
        </div>
    );
}
