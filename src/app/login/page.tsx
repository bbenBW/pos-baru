'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AlertCircle, Building2, KeyRound } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { login, user, loading, error, hasHydrated, initializeAuth } = useAuthStore();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        void initializeAuth();
    }, [initializeAuth]);

    useEffect(() => {
        if (hasHydrated && user) {
            router.replace('/');
        }
    }, [hasHydrated, user, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const result = await login(email, password);
        if (result.success) {
            router.replace('/');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-primary p-6 text-center text-white">
                    <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Kasir & ERP</h1>
                    <p className="text-primary-foreground/80 mt-1">Toko Bangunan Modern</p>
                </div>

                <form onSubmit={handleLogin} className="p-8 space-y-6">
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
                            placeholder="owner@toko.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-70"
                    >
                        {loading ? 'Memproses...' : (
                            <>
                                <KeyRound className="w-5 h-5" />
                                Login ke Sistem
                            </>
                        )}
                    </button>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-700">Role aktif di auth-lab:</p>
                        <p>`owner`, `admin`, `kasir`, `gudang` memakai akun Supabase Auth masing-masing.</p>
                        <p>Kalau login gagal, biasanya akun auth sudah ada tetapi profil `app_users` belum dibuat.</p>
                    </div>
                </form>
            </div>
        </div>
    );
}
