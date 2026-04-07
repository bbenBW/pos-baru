'use client';

import { useState } from 'react';
import { useCustomerStore } from '@/store/customerStore';
import { useBranchStore } from '@/store/branchStore';
import { X } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export function AddCustomerModal({ onClose }: Props) {
    const { addCustomer } = useCustomerStore();
    const { activeBranch } = useBranchStore();

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [creditLimit, setCreditLimit] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        try {
            await addCustomer({
                branch_id: activeBranch?.id,
                name,
                phone,
                address,
                credit_limit: creditLimit ? parseInt(creditLimit.replace(/\D/g, ''), 10) : 0,
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan pelanggan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-auto flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-indigo-50">
                    <h2 className="text-xl font-bold text-indigo-800">Tambah Pelanggan Baru</h2>
                    <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap / Instansi *</label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Contoh: Bpk Beni (Kontraktor XYZ)"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">No. Telp / WhatsApp *</label>
                        <input
                            type="tel"
                            required
                            placeholder="08123456789"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Domisili / Proyek</label>
                        <textarea
                            rows={3}
                            placeholder="Jl. Pembangunan Jaya No. 99"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Batasan Kasbon Maksimal (Rp) - Opsional</label>
                        <input
                            type="text"
                            placeholder="0 (Tanpa batas)"
                            value={creditLimit ? parseInt(creditLimit.replace(/\D/g, ''), 10).toLocaleString('id-ID') : ''}
                            onChange={e => setCreditLimit(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                        >
                            {loading ? 'Menyimpan...' : 'Simpan Data Pelanggan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
