'use client';

import { LayoutDashboard, ShoppingCart, PackageOpen, FileText, Settings2, Users, BarChart3, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';

export function BottomNav() {
    const { user } = useAuthStore();
    const role = user?.role || 'kasir';
    const [showBottomNav, setShowBottomNav] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(orientation: landscape)');
        const updateVisibility = () => setShowBottomNav(media.matches);
        updateVisibility();
        media.addEventListener?.('change', updateVisibility);
        return () => media.removeEventListener?.('change', updateVisibility);
    }, []);

    const menus = [
        { href: '/', icon: LayoutDashboard, label: 'Beranda', access: ['owner', 'admin'] },
        { href: '/pos', icon: ShoppingCart, label: 'Kasir', access: ['owner', 'admin', 'kasir'] },
        { href: '/customers', icon: Users, label: 'Kasbon', access: ['owner', 'admin', 'kasir'] },
        { href: '/products', icon: PackageOpen, label: 'Produk', access: ['owner', 'admin', 'gudang'] },
        { href: '/opname', icon: ClipboardList, label: 'Opname', access: ['owner', 'admin', 'gudang'] },
        { href: '/expenses', icon: FileText, label: 'Beban', access: ['owner', 'admin', 'kasir', 'gudang'] },
        { href: '/reports', icon: BarChart3, label: 'Laporan', access: ['owner', 'admin', 'kasir'] },
        { href: '/settings', icon: Settings2, label: 'Setting', access: ['owner', 'admin'] },
    ];

    const visibleMenus = menus.filter(m => m.access.includes(role));

    if (!showBottomNav) return null;

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex overflow-x-auto items-center px-2 py-3 z-[60] pb-safe gap-1 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]" style={{ WebkitOverflowScrolling: 'touch' }}>
            {visibleMenus.map((menu, i) => (
                <Link key={i} href={menu.href} className="flex-shrink-0 w-[72px] flex flex-col items-center gap-1 text-gray-500 hover:text-primary transition-colors">
                    <menu.icon className="w-6 h-6" />
                    <span className="text-[10px] font-medium text-center leading-tight">{menu.label}</span>
                </Link>
            ))}
        </nav>
    );
}
