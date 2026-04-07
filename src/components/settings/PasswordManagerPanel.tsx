'use client';

import { Shield, UserRound } from 'lucide-react';

const ROLES = [
    { role: 'owner', label: 'Pemilik (Owner)' },
    { role: 'admin', label: 'Admin' },
    { role: 'kasir', label: 'Kasir' },
    { role: 'gudang', label: 'Staff Gudang' },
];

export function PasswordManagerPanel() {
    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 flex items-start gap-3">
                <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Auth-lab sekarang memakai login sungguhan via Supabase Auth.</p>
                    <p className="text-sm mt-1">Password role tidak lagi dikelola lokal di browser. Pembuatan user dan reset password dilakukan dari Supabase Auth atau halaman manajemen user yang nanti kita tambahkan.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Role yang kita pakai</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ROLES.map(item => (
                        <div key={item.role} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                            <UserRound className="w-4 h-4 text-slate-500" />
                            <div>
                                <p className="font-semibold text-slate-800 capitalize">{item.role}</p>
                                <p className="text-sm text-slate-600">{item.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Untuk auth-lab, akun `owner`, `admin`, `kasir`, dan `gudang` akan dibuat di Supabase Auth lalu dipetakan ke tabel `app_users`.
                </div>
            </div>
        </div>
    );
}
