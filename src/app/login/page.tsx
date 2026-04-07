'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Building2, KeyRound } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // DUMMY LOGIN FOR OFFLINE DEMO
            // In production with Supabase: await supabase.auth.signInWithPassword(...)
            // Since 'FULL AUTO READY' was requested, we'll bypass actual auth but set a real state
            // So the user can immediately use it offline without needing database credentials first.

            const mockUser = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                email: email || 'owner@toko.com',
                name: 'Admin / Owner',
                role: 'owner' as const
            };

            // Save to Zustand
            setUser(mockUser);
            // Save offline for persistence
            if (typeof window !== 'undefined') {
                localStorage.setItem('pos_session', JSON.stringify(mockUser));
            }

            router.push('/');
        } catch (error) {
            console.error(error);
            alert("Login gagal.");
        } finally {
            setLoading(false);
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
                </form>
            </div>
        </div>
    );
}
