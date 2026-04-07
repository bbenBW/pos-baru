'use client';

import { useEffect, useState } from 'react';
import { OfflineCustomer, OfflineReceivablePayment, OfflineSaleQueue, db } from '@/lib/dexie';
import { useCustomerStore } from '@/store/customerStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { CreditCard, History, Wallet, X, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
    customer: OfflineCustomer;
    onClose: () => void;
}

const PAYMENT_LABELS: Record<OfflineReceivablePayment['payment_method'], string> = {
    cash: 'Tunai',
    kas_besar: 'Kas Besar',
    transfer: 'Transfer',
    qris: 'QRIS',
};

export function CustomerDetailModal({ customer, onClose }: Props) {
    const customers = useCustomerStore(state => state.customers);
    const { loadReceivablePayments, recordReceivablePayment } = useCustomerStore();
    const user = useAuthStore(state => state.user);
    const { activeBranch } = useBranchStore();
    const currentCustomer = customers.find(item => item.id === customer.id) || customer;

    const [sales, setSales] = useState<OfflineSaleQueue[]>([]);
    const [payments, setPayments] = useState<OfflineReceivablePayment[]>([]);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<OfflineReceivablePayment['payment_method']>('cash');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const refreshData = async () => {
        const saleQueue = (await db.sale_queue.toArray())
            .filter(sale => sale.customer_id === currentCustomer.id);

        const activeDebtSales = saleQueue
            .filter(sale => !sale.voided && sale.payment_method === 'tempo' && Math.max(0, sale.total - sale.paid) > 0)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const paymentRows = await loadReceivablePayments(currentCustomer.id);
        setSales(activeDebtSales);
        setPayments(paymentRows);
    };

    useEffect(() => {
        void refreshData();
    }, [currentCustomer.id, currentCustomer.debt_balance]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount) || 0;
        if (numericAmount <= 0) {
            alert('Isi nominal pembayaran terlebih dahulu.');
            return;
        }
        if (currentCustomer.debt_balance <= 0) {
            alert('Pelanggan ini tidak memiliki saldo kasbon.');
            return;
        }

        setSaving(true);
        try {
            await recordReceivablePayment({
                customerId: currentCustomer.id,
                amount: numericAmount,
                paymentMethod,
                notes: notes.trim(),
                branchId: activeBranch?.id || currentCustomer.branch_id,
                userId: user?.id || undefined,
            });
            setAmount('');
            setNotes('');
            await refreshData();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan pembayaran kasbon.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrintInvoice = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const totalDebt = currentCustomer.debt_balance;
        const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const html = `
            <html>
            <head>
                <title>Nota Tagihan - ${currentCustomer.name}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                    .header h1 { margin: 0; color: #1e1b4b; }
                    .info { margin-bottom: 30px; display: flex; justify-content: space-between; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
                    th { bg-color: #f8fafc; }
                    .total-box { text-align: right; font-size: 1.2em; font-bold: true; border-top: 2px solid #333; padding-top: 10px; }
                    .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>NOTA TAGIHAN (INVOICE)</h1>
                    <p>${activeBranch?.name || 'Toko Bangunan'}</p>
                </div>
                <div class="info">
                    <div>
                        <strong>Kepada:</strong><br/>
                        ${currentCustomer.name}<br/>
                        ${currentCustomer.phone || '-'}<br/>
                        ${currentCustomer.address || '-'}
                    </div>
                    <div>
                        <strong>Tanggal Cetak:</strong><br/>
                        ${dateStr}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>No. Transaksi / Keterangan</th>
                            <th>Tanggal</th>
                            <th style="text-align: right">Sisa Tagihan (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.map(s => `
                            <tr>
                                <td>${s.receipt_number}</td>
                                <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
                                <td style="text-align: right">${(Math.max(0, s.total - s.paid)).toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total-box">
                    TOTAL TAGIHAN: Rp ${totalDebt.toLocaleString('id-ID')}
                </div>
                <div class="footer">
                    <p>Terima kasih atas kerjasamanya.</p>
                </div>
                <script>window.print();</script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const isOverLimit = currentCustomer.credit_limit && currentCustomer.credit_limit > 0 && currentCustomer.debt_balance >= currentCustomer.credit_limit;
    const usagePercent = currentCustomer.credit_limit && currentCustomer.credit_limit > 0
        ? Math.min(100, (currentCustomer.debt_balance / currentCustomer.credit_limit) * 100)
        : 0;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center px-6 py-4 border-b bg-indigo-50">
                    <div>
                        <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                            <Wallet className="w-5 h-5" /> Detail & Bayar Kasbon
                        </h2>
                        <p className="text-sm text-indigo-700/80 font-medium">{currentCustomer.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrintInvoice}
                            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold border border-indigo-200 transition-colors shadow-sm"
                        >
                            <Printer className="w-4 h-4" /> Cetak Tagihan
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-700 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className={`rounded-2xl border p-4 relative overflow-hidden ${isOverLimit ? 'bg-red-50 border-red-200' : 'bg-rose-50 border-rose-100'}`}>
                            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                                <Wallet className="w-3.5 h-3.5" /> Saldo Kasbon
                            </div>
                            <div className="text-2xl font-black text-rose-600 mt-2">Rp {currentCustomer.debt_balance.toLocaleString('id-ID')}</div>
                            {isOverLimit && (
                                <div className="absolute right-2 top-2">
                                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border bg-slate-50 border-slate-100 p-4">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Limit Kasbon</div>
                            <div className="text-xl font-black text-slate-700 mt-2">
                                {currentCustomer.credit_limit && currentCustomer.credit_limit > 0
                                    ? `Rp ${currentCustomer.credit_limit.toLocaleString('id-ID')}`
                                    : 'Tanpa Batas'}
                            </div>
                            {currentCustomer.credit_limit && currentCustomer.credit_limit > 0 && (
                                <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${isOverLimit ? 'bg-red-600' : 'bg-indigo-600'}`}
                                        style={{ width: `${usagePercent}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border bg-slate-50 border-slate-100 p-4">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">No. Telepon</div>
                            <div className="text-base font-bold text-gray-800 mt-2">{currentCustomer.phone || '-'}</div>
                        </div>

                        <div className="rounded-2xl border bg-slate-50 border-slate-100 p-4">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Alamat</div>
                            <div className="text-sm font-bold text-gray-800 mt-2 truncate" title={currentCustomer.address}>{currentCustomer.address || '-'}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border p-5 bg-white shadow-sm border-slate-100 space-y-4">
                            <div className="flex items-center gap-2 text-gray-800 font-bold">
                                <CreditCard className="w-5 h-5 text-emerald-600" /> Form Pembayaran
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Nominal Bayar (Rp)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</div>
                                        <input
                                            type="number"
                                            min="0"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 p-3 pl-10 outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-lg"
                                            placeholder="0"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Metode Bayar</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['cash', 'kas_besar', 'transfer', 'qris'] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setPaymentMethod(m)}
                                                className={`py-2 rounded-xl border text-xs font-bold transition-all ${paymentMethod === m ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'}`}
                                            >
                                                {PAYMENT_LABELS[m]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Catatan Tambahan</label>
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                        placeholder="Contoh: Titip sisa kemarin"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving || currentCustomer.debt_balance <= 0}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    {saving ? 'Proses...' : (
                                        <> <CheckCircle2 className="w-5 h-5" /> Simpan Pembayaran </>
                                    )}
                                </button>
                            </form>
                        </div>

                        <div className="rounded-2xl border p-5 bg-white shadow-sm border-slate-100 flex flex-col">
                            <div className="flex items-center gap-2 text-gray-800 font-bold mb-4">
                                <History className="w-5 h-5 text-indigo-600" /> Riwayat Bayar Terbaru
                            </div>
                            <div className="space-y-3 flex-1 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {payments.length === 0 ? (
                                    <div className="text-sm text-slate-400 rounded-2xl border border-dashed p-10 text-center bg-slate-50/50 flex flex-col items-center gap-2">
                                        <History className="w-8 h-8 text-slate-200" />
                                        Belum ada riwayat pembayaran.
                                    </div>
                                ) : payments.map(payment => (
                                    <div key={payment.id} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50 hover:bg-white transition-colors group">
                                        <div className="flex justify-between gap-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{PAYMENT_LABELS[payment.payment_method]}</span>
                                                <span className="text-[10px] text-gray-400 font-medium uppercase">{new Date(payment.created_at).toLocaleString('id-ID')}</span>
                                            </div>
                                            <span className="font-black text-emerald-600 text-base">Rp {payment.amount.toLocaleString('id-ID')}</span>
                                        </div>
                                        {payment.notes && <div className="text-xs text-slate-500 mt-2 bg-white p-2 rounded-lg border border-slate-100 italic">&quot; {payment.notes} &quot;</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-5 py-3 border-b flex justify-between items-center">
                            <span className="font-bold text-slate-700 text-sm">Daftar Transaksi Tempo (Hutang Belum Lunas)</span>
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">{sales.length} Transaksi</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {sales.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 text-sm">Semua transaksi tempo telah lunas.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {sales.map(sale => (
                                        <div key={`${sale.receipt_number}-${sale.local_id || 'remote'}`} className="p-4 bg-white hover:bg-indigo-50/20 transition-colors flex justify-between items-center group">
                                            <div>
                                                <div className="font-mono font-bold text-gray-800 text-sm">{sale.receipt_number}</div>
                                                <div className="text-xs text-gray-400">Total: Rp {sale.total.toLocaleString('id-ID')} | Bayar Awal: Rp {sale.paid.toLocaleString('id-ID')}</div>
                                                <div className="text-[10px] text-indigo-500 font-medium mt-0.5">{new Date(sale.created_at).toLocaleString('id-ID')}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black text-red-600">Sisa Rp {(Math.max(0, sale.total - sale.paid)).toLocaleString('id-ID')}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Belum Lunas</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
