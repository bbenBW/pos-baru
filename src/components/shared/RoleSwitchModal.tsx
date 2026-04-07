'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { X, LogOut, Shield, UserCircle } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export function RoleSwitchModal({ onClose }: Props) {
    const { user, logout } = useAuthStore();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        await logout();
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-slate-300" />
                            <h2 className="text-lg font-bold">Akun Aktif</h2>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-slate-300 text-xs">Role sekarang dikelola lewat Supabase Auth. Untuk pindah role, logout lalu login dengan akun lain.</p>
                </div>

                <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-slate-700">
                            <UserCircle className="w-5 h-5" />
                            <span className="font-semibold">{user?.name || 'Belum login'}</span>
                        </div>
                        <p className="text-sm text-slate-600">{user?.email || '-'}</p>
                        <p className="text-sm font-medium text-primary capitalize">Role: {user?.role || '-'}</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <LogOut className="w-5 h-5" />
                        {loading ? 'Mengeluarkan akun...' : 'Logout'}
                    </button>
                </div>
            </div>
        </div>
    );
}
