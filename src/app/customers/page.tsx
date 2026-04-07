'use client';

import { useState, useEffect } from 'react';
import { useCustomerStore } from '@/store/customerStore';
import { useBranchStore } from '@/store/branchStore';
import { Users, Plus, Search, Wallet, AlertCircle } from 'lucide-react';
import { AddCustomerModal } from '@/components/customers/AddCustomerModal';
import { CustomerDetailModal } from '@/components/customers/CustomerDetailModal';
import { OfflineCustomer } from '@/lib/dexie';

export default function CustomersPage() {
    const { customers, loadCustomers, loading } = useCustomerStore();
    const { activeBranch } = useBranchStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<OfflineCustomer | null>(null);

    useEffect(() => {
        void loadCustomers(activeBranch?.id, { silent: true });
    }, [activeBranch?.id, loadCustomers]);

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    const totalDebt = filteredCustomers.reduce((acc, curr) => acc + curr.debt_balance, 0);

    return (
        <div className="w-full h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" /> Pelanggan & Kasbon
                    </h1>
                    <p className="text-gray-500 text-sm">Kelola data pelanggan, tukang, kontraktor, dan tagihan kasbon.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Pelanggan Baru
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center bg-gradient-to-br from-red-50 to-white">
                    <div className="p-3 bg-red-100 rounded-lg mr-4">
                        <Wallet className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Piutang Kasbon</p>
                        <p className="text-xl font-bold text-red-600">Rp {totalDebt.toLocaleString('id-ID')}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center bg-gradient-to-br from-indigo-50 to-white">
                    <div className="p-3 bg-indigo-100 rounded-lg mr-4">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Pelanggan</p>
                        <p className="text-xl font-bold text-indigo-600">{filteredCustomers.length}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col flex-1">
                <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Cari nama pelanggan atau telepon..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-white text-gray-700 uppercase font-semibold border-b">
                            <tr>
                                <th className="px-4 py-3">Nama Pelanggan</th>
                                <th className="px-4 py-3">No. Telepon / WA</th>
                                <th className="px-4 py-3">Alamat</th>
                                <th className="px-4 py-3 text-right">Saldo Kasbon (Rp)</th>
                                <th className="px-4 py-3 text-right">Limit Kasbon</th>
                                <th className="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading && filteredCustomers.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8">Memuat data pelanggan...</td></tr>
                            ) : filteredCustomers.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-500">Belum ada data pelanggan.</td></tr>
                            ) : (
                                filteredCustomers.map(customer => {
                                    const isOverLimit = customer.credit_limit && customer.credit_limit > 0 && customer.debt_balance >= customer.credit_limit;
                                    return (
                                        <tr key={customer.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-4 font-bold text-gray-800">
                                                {customer.name}
                                            </td>
                                            <td className="px-4 py-4">{customer.phone || '-'}</td>
                                            <td className="px-4 py-4 max-w-[200px] truncate" title={customer.address}>
                                                {customer.address || '-'}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    {customer.debt_balance > 0 ? (
                                                        <span className={`font-bold ${isOverLimit ? 'text-red-700' : 'text-red-600'}`}>
                                                            {customer.debt_balance.toLocaleString('id-ID')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-emerald-600 font-bold">0</span>
                                                    )}
                                                    {isOverLimit && (
                                                        <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5 mt-0.5">
                                                            <AlertCircle className="w-3 h-3" /> Over Limit
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-sm">
                                                {customer.credit_limit && customer.credit_limit > 0 ? (
                                                    <span className="text-slate-600 font-semibold">{customer.credit_limit.toLocaleString('id-ID')}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">Tanpa batas</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedCustomer(customer)}
                                                    className="text-indigo-600 font-medium hover:underline text-xs bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all hover:bg-white"
                                                >
                                                    Detail & Bayar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && <AddCustomerModal onClose={() => setIsModalOpen(false)} />}
            {selectedCustomer && <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
        </div>
    );
}
