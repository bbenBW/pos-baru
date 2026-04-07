'use client';

import { useState } from 'react';
import { useExpenseStore } from '@/store/expenseStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { X } from 'lucide-react';
import { OfflineExpense } from '@/lib/dexie';

interface Props {
    onClose: () => void;
    expense?: OfflineExpense;
}

const EXPENSE_CATEGORIES = [
    'Operasional (Listrik/Air/Internet)',
    'Gaji Karyawan',
    'Transportasi & Bensin',
    'Konsumsi / Makan',
    'Maintenance / Perbaikan',
    'Pembelian Stok (Tunai)',
    'Pembayaran Hutang Supplier',
    'Lain-lain'
];

export function AddExpenseModal({ onClose, expense }: Props) {
    const { addExpense, updateExpense } = useExpenseStore();
    const { user } = useAuthStore();
    const { activeBranch } = useBranchStore();

    const isEdit = !!expense;

    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState(expense?.amount.toString() || '');
    const [category, setCategory] = useState(expense?.category || EXPENSE_CATEGORIES[0]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris' | 'kas_besar'>(expense?.payment_method || 'cash');
    const [description, setDescription] = useState(expense?.description || '');
    const [expenseDate, setExpenseDate] = useState(expense?.expense_date || new Date().toISOString().split('T')[0]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return alert('Harap masukkan nominal yang valid.');
        }

        setLoading(true);
        try {
            const data = {
                branch_id: activeBranch?.id,
                user_id: user?.id,
                category,
                amount: numAmount,
                description,
                expense_date: expenseDate,
                payment_method: paymentMethod
            };

            if (isEdit && expense) {
                await updateExpense(expense.id, data);
            } else {
                await addExpense(data);
            }
            onClose();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan pengeluaran.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-auto flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-orange-50">
                    <h2 className="text-xl font-bold text-orange-800">
                        {isEdit ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-orange-100 rounded-lg transition-colors text-orange-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* ... (rest of the form remains same) ... */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                            <input
                                type="date"
                                required
                                value={expenseDate}
                                onChange={e => setExpenseDate(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Metode Bayar *</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as any)}
                                className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                            >
                                <option value="cash">💵 Tunai (Kas Laci)</option>
                                <option value="kas_besar">🏠 Tunai (Kas Besar / Brankas)</option>
                                <option value="transfer">🏦 Transfer</option>
                                <option value="qris">📱 QRIS</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Biaya *</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                        >
                            {EXPENSE_CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp) *</label>
                        <input
                            type="number"
                            required
                            min="1"
                            placeholder="Contoh: 150000"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full p-3 text-lg font-bold rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Deskripsi *</label>
                        <textarea
                            required
                            rows={2}
                            placeholder="Beli token listrik toko, bensin pickup pengiriman..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 ${isEdit ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
                                }`}
                        >
                            {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
