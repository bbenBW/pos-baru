'use client';

import { useState } from 'react';
import { useAuthStore, UserRole } from '@/store/authStore';
import { KeyRound, Save, Eye, EyeOff, Shield } from 'lucide-react';

const ROLES: { role: UserRole; label: string; icon: string }[] = [
    { role: 'owner', label: 'Pemilik (Owner)', icon: '👑' },
    { role: 'admin', label: 'Admin', icon: '🛡️' },
    { role: 'kasir', label: 'Kasir', icon: '🧾' },
    { role: 'gudang', label: 'Staff Gudang', icon: '📦' },
];

export function PasswordManagerPanel() {
    const { changeRolePassword, user } = useAuthStore();
    const [ownerPassword, setOwnerPassword] = useState('');
    const [showOwnerPwd, setShowOwnerPwd] = useState(false);
    const [selectedRole, setSelectedRole] = useState<UserRole>('kasir');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const handleSave = () => {
        setResult(null);
        if (!ownerPassword) return setResult({ type: 'error', msg: 'Masukkan password Owner terlebih dahulu.' });
        if (!newPassword || newPassword.length < 4) return setResult({ type: 'error', msg: 'Password baru minimal 4 karakter.' });
        if (newPassword !== confirmPassword) return setResult({ type: 'error', msg: 'Konfirmasi password tidak cocok.' });

        const ok = changeRolePassword(selectedRole, newPassword, ownerPassword);
        if (ok) {
            setResult({ type: 'success', msg: `Password untuk role "${ROLES.find(r => r.role === selectedRole)?.label}" berhasil diubah.` });
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setResult({ type: 'error', msg: 'Password Owner salah! Tidak bisa mengubah password.' });
        }
    };

    if (user?.role !== 'owner') {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <p className="font-medium">Fitur ini hanya dapat diakses oleh Pemilik (Owner).</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
            <div>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-slate-600" /> Manajemen Password Role
                </h3>
                <p className="text-sm text-gray-500 mt-1">Ubah password setiap role login. Hanya dapat diubah oleh Owner.</p>
            </div>

            {result && (
                <div className={`p-3 rounded-lg text-sm font-medium ${result.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {result.type === 'success' ? '✅' : '⚠️'} {result.msg}
                </div>
            )}

            {/* Owner verification first */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password Owner (Verifikasi Diri) *</label>
                <div className="relative">
                    <input
                        type={showOwnerPwd ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={e => setOwnerPassword(e.target.value)}
                        placeholder="Masukkan password owner Anda"
                        className="w-full p-2.5 pr-10 border rounded-lg outline-none focus:ring-2 focus:ring-slate-400 text-sm"
                    />
                    <button type="button" onClick={() => setShowOwnerPwd(!showOwnerPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showOwnerPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Target Role */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ubah Password untuk Role:</label>
                <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(({ role, label, icon }) => (
                        <button
                            key={role}
                            type="button"
                            onClick={() => setSelectedRole(role)}
                            className={`p-3 rounded-xl border-2 text-left transition-all text-sm ${selectedRole === role ? 'border-slate-800 bg-slate-800 text-white' : 'border-gray-200 hover:border-slate-400 text-gray-700'
                                }`}
                        >
                            <span className="mr-1">{icon}</span> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* New password */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password Baru *</label>
                <div className="relative">
                    <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimal 4 karakter"
                        className="w-full p-2.5 pr-10 border rounded-lg outline-none focus:ring-2 focus:ring-slate-400 text-sm"
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Konfirmasi Password Baru *</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-slate-400 text-sm"
                />
            </div>

            <button
                onClick={handleSave}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
                <Save className="w-4 h-4" /> Simpan Password Baru
            </button>
        </div>
    );
}
