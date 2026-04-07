'use client';

import { useState } from 'react';
import { useAuthStore, UserRole } from '@/store/authStore';
import { X, LogIn, Shield, KeyRound, Eye, EyeOff } from 'lucide-react';

interface Props {
    onClose: () => void;
}

const ROLE_OPTIONS: { role: UserRole; label: string; color: string; icon: string }[] = [
    { role: 'owner', label: 'Pemilik (Owner)', color: 'bg-purple-600', icon: '👑' },
    { role: 'admin', label: 'Admin', color: 'bg-blue-600', icon: '🛡️' },
    { role: 'kasir', label: 'Kasir', color: 'bg-emerald-600', icon: '🧾' },
    { role: 'gudang', label: 'Staff Gudang', color: 'bg-amber-600', icon: '📦' },
];

export function RoleSwitchModal({ onClose }: Props) {
    const { switchRole, user } = useAuthStore();

    const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'kasir');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSwitchRole = () => {
        if (!password.trim()) {
            setError('Harap masukkan password.');
            return;
        }
        setLoading(true);

        const success = switchRole(selectedRole, password);

        if (success) {
            onClose();
        } else {
            setError('Password salah! Silakan coba lagi.');
            setPassword('');
        }
        setLoading(false);
    };

    const selectedRoleInfo = ROLE_OPTIONS.find(r => r.role === selectedRole)!;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-slate-300" />
                            <h2 className="text-lg font-bold">Ganti Role Pengguna</h2>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-slate-300 text-xs">Setiap pergantian role membutuhkan password yang berbeda.</p>
                </div>

                <div className="p-5 space-y-4">
                    {/* Role Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Role Tujuan</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ROLE_OPTIONS.map(({ role, label, icon }) => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => { setSelectedRole(role); setError(''); setPassword(''); }}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedRole === role
                                            ? 'border-slate-800 bg-slate-800 text-white shadow-lg scale-[1.02]'
                                            : 'border-gray-200 hover:border-slate-400 hover:bg-slate-50 text-gray-700'
                                        }`}
                                >
                                    <span className="text-xl block mb-1">{icon}</span>
                                    <span className="text-xs font-bold">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            <KeyRound className="w-3.5 h-3.5 inline mr-1" />
                            Password untuk {selectedRoleInfo?.label}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                onKeyDown={e => e.key === 'Enter' && handleSwitchRole()}
                                autoFocus
                                placeholder="Masukkan password role..."
                                className={`w-full p-3 pr-10 rounded-lg border-2 outline-none text-sm transition-colors ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-slate-600'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {error && <p className="text-red-500 text-xs mt-1 font-medium">⚠️ {error}</p>}
                    </div>

                    <button
                        onClick={handleSwitchRole}
                        disabled={loading}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <LogIn className="w-5 h-5" />
                        {loading ? 'Memverifikasi...' : 'Masuk sebagai ' + selectedRoleInfo?.label}
                    </button>
                </div>
            </div>
        </div>
    );
}
