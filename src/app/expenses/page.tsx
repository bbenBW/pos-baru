'use client';

import { useState, useEffect } from 'react';
import { useExpenseStore } from '@/store/expenseStore';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { Receipt, Plus, Search, Trash2, CheckSquare, Square, Pencil } from 'lucide-react';
import { AddExpenseModal } from '@/components/expense/AddExpenseModal';
import { OfflineExpense } from '@/lib/dexie';

export default function ExpensesPage() {
    const { expenses, loadExpenses, loading, deleteExpense } = useExpenseStore();
    const { activeBranch } = useBranchStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<OfflineExpense | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (activeBranch) {
            loadExpenses(activeBranch.id);
        } else {
            loadExpenses();
        }
    }, [activeBranch?.id]); // Only re-run when branch ID changes, not on loadExpenses signature changes

    const filteredExpenses = expenses.filter(e =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSelect = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const allSelected = filteredExpenses.length > 0 && filteredExpenses.every(e => selectedIds.has(e.id));
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredExpenses.map(e => e.id)));
    const handleBulkDelete = async () => {
        if (!confirm(`Hapus ${selectedIds.size} pengeluaran terpilih?`)) return;
        for (const id of Array.from(selectedIds)) await deleteExpense(id);
        setSelectedIds(new Set());
    };

    const totalExpense = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="w-full h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Receipt className="w-6 h-6 text-orange-500" /> Pengeluaran Toko
                    </h1>
                    <p className="text-gray-500 text-sm">Catat biaya operasional harian (listrik, gaji, bensin, dll).</p>
                </div>
                <div className="flex gap-2 items-center">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors">
                            <Trash2 className="w-4 h-4" /> Hapus {selectedIds.size} Terpilih
                        </button>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> Catat Pengeluaran
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
                <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari deskripsi atau kategori..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
                        />
                    </div>
                    <div className="text-right w-full sm:w-auto">
                        <p className="text-sm text-gray-500 mb-0.5">Total Terfilter:</p>
                        <p className="text-xl font-bold text-orange-600">Rp {totalExpense.toLocaleString('id-ID')}</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-white text-gray-700 uppercase font-semibold border-b">
                            <tr>
                                <th className="px-3 py-3 w-8">
                                    <button onClick={toggleAll} className="text-gray-400 hover:text-orange-500">
                                        {allSelected ? <CheckSquare className="w-4 h-4 text-orange-500" /> : <Square className="w-4 h-4" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">Tanggal</th>
                                <th className="px-4 py-3">Kategori</th>
                                <th className="px-4 py-3">Metode</th>
                                <th className="px-4 py-3">Deskripsi</th>
                                <th className="px-4 py-3 text-right">Nominal (Rp)</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-8">Memuat data pengeluaran...</td></tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Belum ada catatan pengeluaran.</td></tr>
                            ) : (
                                filteredExpenses.map(expense => (
                                    <tr key={expense.id} className={`hover:bg-orange-50/30 transition-colors ${selectedIds.has(expense.id) ? 'bg-orange-50/60' : ''}`}>
                                        <td className="px-3 py-4">
                                            <button onClick={() => toggleSelect(expense.id)} className="text-gray-400 hover:text-orange-500">
                                                {selectedIds.has(expense.id) ? <CheckSquare className="w-4 h-4 text-orange-500" /> : <Square className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {new Date(expense.expense_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium border">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${expense.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                expense.payment_method === 'kas_besar' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                {expense.payment_method === 'cash' ? '💵 Laci' :
                                                    expense.payment_method === 'kas_besar' ? '🏠 Brankas' :
                                                        expense.payment_method?.toUpperCase() || 'LACI'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 max-w-[200px] truncate" title={expense.description}>
                                            {expense.description}
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-gray-800">
                                            {expense.amount.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {expense.status === 'pending_sync' ? (
                                                <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-full border border-orange-200">Pending Sync</span>
                                            ) : (
                                                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">Synced</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => setEditingExpense(expense)}
                                                    className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Hapus pengeluaran ini?')) deleteExpense(expense.id);
                                                    }}
                                                    className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {(isModalOpen || editingExpense) && (
                <AddExpenseModal
                    expense={editingExpense || undefined}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingExpense(null);
                    }}
                />
            )}
        </div>
    );
}
