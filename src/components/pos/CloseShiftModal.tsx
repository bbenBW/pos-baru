'use client';

import { useEffect, useState } from 'react';
import { useShiftStore } from '@/store/shiftStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { db } from '@/lib/dexie';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export function CloseShiftModal({ onClose }: { onClose: () => void }) {
    const { activeShift, closeShift, loadActiveShift } = useShiftStore();
    const { user } = useAuthStore();
    const activeBranchId = useBranchStore(state => state.activeBranch?.id);

    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');
    const [calculating, setCalculating] = useState(true);
    const [expectedCash, setExpectedCash] = useState(0);
    const [expenseCashTotal, setExpenseCashTotal] = useState(0);
    const [cashDeposited, setCashDeposited] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user?.id) {
            void loadActiveShift(user.id, activeBranchId);
        }
    }, [loadActiveShift, user?.id, activeBranchId]);

    useEffect(() => {
        let cancelled = false;

        const calculateExpectedCash = async () => {
            if (!activeShift) return;
            setCalculating(true);
            try {
                const shiftStart = new Date(activeShift.opening_time);
                const normalizeBranchId = (value?: string | null) => {
                    if (!value || value === 'main-branch' || value === '00000000-0000-0000-0000-000000000000') return '00000000-0000-0000-0000-000000000000';
                    return value;
                };
                const shiftBranchId = normalizeBranchId(activeShift.branch_id || activeBranchId);

                const localSales = await db.sale_queue.where('status').anyOf(['pending_sync', 'completed']).toArray();
                const localReceivablePayments = await db.receivables_payments.where('status').anyOf(['pending_sync', 'completed']).toArray();
                const localExpenses = await db.expenses.where('status').anyOf(['pending_sync', 'completed']).toArray();

                let sales = [...localSales];
                let receivablePayments = [...localReceivablePayments];
                let expenses = [...localExpenses];

                if (navigator.onLine && supabaseConfigured) {
                    const applyBranchFilter = (query: any) => {
                        if (shiftBranchId === '00000000-0000-0000-0000-000000000000') {
                            return query.or('branch_id.is.null,branch_id.eq.00000000-0000-0000-0000-000000000000');
                        }
                        return query.eq('branch_id', shiftBranchId);
                    };

                    const salesQuery = supabase
                        .from('sales')
                        .select('id, receipt_number, branch_id, created_at, total, payment_method, payment_breakdown, paid, voided')
                        .gte('created_at', shiftStart.toISOString());
                    const paymentsQuery = supabase
                        .from('receivables_payments')
                        .select('*')
                        .gte('created_at', shiftStart.toISOString());
                    const expensesQuery = supabase
                        .from('expenses')
                        .select('*')
                        .gte('created_at', shiftStart.toISOString());

                    const [{ data: remoteSales }, { data: remotePayments }, { data: remoteExpenses }] = await Promise.all([
                        applyBranchFilter(salesQuery),
                        applyBranchFilter(paymentsQuery),
                        applyBranchFilter(expensesQuery),
                    ]);

                    if (remoteSales) {
                        const localKeys = new Set(localSales.map(sale => sale.receipt_number));
                        for (const remoteSale of remoteSales as any[]) {
                            const key = remoteSale.receipt_number || remoteSale.id;
                            if (!localKeys.has(key)) sales.push(remoteSale);
                        }
                    }

                    if (remotePayments) {
                        const localKeys = new Set(localReceivablePayments.map(payment => payment.id));
                        for (const remotePayment of remotePayments as any[]) {
                            if (!localKeys.has(remotePayment.id)) receivablePayments.push(remotePayment);
                        }
                    }

                    if (remoteExpenses) {
                        const localKeys = new Set(localExpenses.map(expense => expense.id));
                        for (const remoteExpense of remoteExpenses as any[]) {
                            if (!localKeys.has(remoteExpense.id)) expenses.push(remoteExpense);
                        }
                    }
                }

                const cashInDrawer = sales
                    .filter(sale => {
                        if (sale.voided) return false;
                        if (normalizeBranchId(sale.branch_id) !== shiftBranchId) return false;
                        return new Date(sale.created_at) >= shiftStart;
                    })
                    .reduce((acc, sale) => {
                        if (sale.payment_method === 'cash') return acc + sale.total;
                        if (sale.payment_method === 'split') {
                            const cashPart = Math.max(0, Math.min(sale.total, sale.payment_breakdown?.cash || 0));
                            return acc + cashPart;
                        }
                        if (sale.payment_method === 'tempo') {
                            const cashPart = Math.max(0, Math.min(sale.total, sale.payment_breakdown?.cash ?? sale.paid ?? 0));
                            return acc + cashPart;
                        }
                        return acc;
                    }, 0);

                const receivableCash = receivablePayments
                    .filter(payment => {
                        if (normalizeBranchId(payment.branch_id) !== shiftBranchId) return false;
                        return new Date(payment.created_at) >= shiftStart && payment.payment_method === 'cash';
                    })
                    .reduce((acc, payment) => acc + payment.amount, 0);

                const expenseCash = expenses
                    .filter(exp => {
                        if (normalizeBranchId(exp.branch_id) !== shiftBranchId) return false;
                        const expDate = new Date(exp.created_at || exp.expense_date);
                        return expDate >= shiftStart && exp.payment_method === 'cash';
                    })
                    .reduce((acc, exp) => acc + exp.amount, 0);

                const totalAdjustments = activeShift.adjustments?.reduce((acc, adj) => acc + adj.amount, 0) || 0;

                if (!cancelled) {
                    setExpectedCash(activeShift.opening_cash + cashInDrawer + receivableCash - expenseCash + totalAdjustments);
                    setExpenseCashTotal(expenseCash);
                }
            } finally {
                if (!cancelled) setCalculating(false);
            }
        };

        void calculateExpectedCash();
        return () => {
            cancelled = true;
        };
    }, [activeShift, activeBranchId, user?.id]);

    if (!activeShift) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const actual = parseFloat(actualCash) || 0;
        const deposited = parseFloat(cashDeposited) || 0;

        if (deposited > actual) {
            return alert('Jumlah setoran tidak boleh melebihi uang fisik yang ada!');
        }

        const kept = actual - deposited;
        const diff = actual - expectedCash;

        setIsSubmitting(true);
        try {
            await closeShift(actual, expectedCash, diff, notes, deposited, kept);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const actual = parseFloat(actualCash) || 0;
    const deposited = parseFloat(cashDeposited) || 0;
    const kept = Math.max(0, actual - deposited);
    const diff = actual - expectedCash;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-red-600 p-5 text-white text-center">
                    <h2 className="text-xl font-bold mb-1">Tutup Kasir (End of Shift)</h2>
                    <p className="opacity-90 text-sm">Hitung uang fisik di laci Anda sekarang.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {calculating ? (
                        <p className="text-center text-sm py-4">Menghitung transaksi hari ini...</p>
                    ) : (
                        <>
                            <div className="bg-slate-50 p-3 rounded-xl border space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Modal Awal:</span>
                                    <span className="font-semibold text-gray-800">Rp {activeShift.opening_cash.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total Kas Masuk:</span>
                                    <span className="font-semibold text-emerald-600">+ Rp {(expectedCash + expenseCashTotal - activeShift.opening_cash).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total Kas Keluar (Biaya):</span>
                                    <span className="font-semibold text-rose-600">- Rp {expenseCashTotal.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold">
                                    <span className="text-gray-700">Estimasi Saldo Laci:</span>
                                    <span className="text-primary text-lg">Rp {expectedCash.toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px]">1</div>
                                        Total Uang Fisik di Laci (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={actualCash}
                                        onChange={e => setActualCash(e.target.value)}
                                        className="w-full text-2xl p-3 text-center rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all font-mono font-bold"
                                        placeholder="0"
                                        autoFocus
                                    />
                                </div>

                                {actual > 0 && (
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-sm font-bold text-indigo-900 mb-1.5 flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[10px]">2</div>
                                                Jumlah yang Disetor ke Brankas (Rp)
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                max={actual}
                                                value={cashDeposited}
                                                onChange={e => setCashDeposited(e.target.value)}
                                                className="w-full text-xl p-3 text-center rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-mono font-bold bg-white"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-sm pt-2 border-t border-indigo-100">
                                            <span className="text-indigo-600 font-medium">Sisa Modal di Laci (Ditinggal):</span>
                                            <span className="text-indigo-900 font-black">Rp {kept.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {actualCash !== '' && (
                                <div className={`p-4 rounded-xl text-sm font-bold flex justify-between items-center ${diff === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : diff > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                    <span>Selisih Kasir:</span>
                                    <span className="text-base">
                                        {diff === 0 ? 'SEIMBANG (0)' : `${diff > 0 ? '+' : ''} Rp ${diff.toLocaleString('id-ID')}`}
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Selisih / Tutup Shift (Opsional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="Alasan selisih jika ada (misal: buat kembalian kurang, dll)"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-gray-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                        <button
                            type="submit"
                            disabled={calculating}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
                        >
                            Konfirmasi & Tutup
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
