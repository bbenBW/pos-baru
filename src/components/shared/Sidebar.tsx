'use client';

import { useState, useEffect } from 'react';
import {
    LayoutDashboard, ShoppingCart, PackageOpen, FileText, Settings2,
    Users, BarChart3, UserCircle, ClipboardList, LogIn, ChevronLeft, ChevronRight, Menu,
    History, Truck, AlertCircle, PackagePlus, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { BranchSwitcher } from '@/components/shared/BranchSwitcher';
import { RoleSwitchModal } from '@/components/shared/RoleSwitchModal';
import { useStoreProfileStore } from '@/store/storeProfileStore';

export function Sidebar() {
    const { user } = useAuthStore();
    const role = user?.role || 'kasir';
    const pathname = usePathname();
    const { storeName, tagline, logo } = useStoreProfileStore();
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);

    useEffect(() => {
        import('@/lib/dexie').then(({ db }) => {
            db.products.toArray().then(products => {
                setLowStockCount(products.filter(p => p.current_stock <= (p.min_stock || 0) && p.current_stock >= 0).length);
            });
        });
    }, []);

    const menus = [
        { href: '/', icon: LayoutDashboard, label: 'Dashboard', access: ['owner', 'admin'], badge: 0 },
        { href: '/pos', icon: ShoppingCart, label: 'Kasir (POS)', access: ['owner', 'admin', 'kasir'], badge: 0 },
        { href: '/history', icon: History, label: 'Riwayat Transaksi', access: ['owner', 'admin', 'kasir'], badge: 0 },
        { href: '/products', icon: PackageOpen, label: 'Stok Produk', access: ['owner', 'admin', 'gudang'], badge: lowStockCount },
        { href: '/incoming', icon: PackagePlus, label: 'Riwayat Pembelian', access: ['owner', 'admin', 'gudang'], badge: 0 },
        { href: '/opname', icon: ClipboardList, label: 'Stock Opname', access: ['owner', 'admin', 'gudang'], badge: 0 },
        { href: '/suppliers', icon: Truck, label: 'Supplier', access: ['owner', 'admin', 'gudang'], badge: 0 },
        { href: '/customers', icon: Users, label: 'Pelanggan / Kasbon', access: ['owner', 'admin', 'kasir'], badge: 0 },
        { href: '/expenses', icon: FileText, label: 'Pengeluaran', access: ['owner', 'admin', 'kasir', 'gudang'], badge: 0 },
        { href: '/reports', icon: BarChart3, label: 'Laporan Pusat', access: ['owner', 'admin'], badge: 0 },
        { href: '/monitoring', icon: ShieldCheck, label: 'Monitoring', access: ['owner', 'admin'], badge: 0 },
        { href: '/settings', icon: Settings2, label: 'Pengaturan', access: ['owner', 'admin'], badge: 0 },
    ];

    const visibleMenus = menus.filter(m => m.access.includes(role));

    const roleDisplay: Record<string, { label: string; color: string }> = {
        owner: { label: 'Pemilik (Owner)', color: 'bg-purple-100 text-purple-800' },
        admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800' },
        kasir: { label: 'Kasir', color: 'bg-emerald-100 text-emerald-800' },
        gudang: { label: 'Staff Gudang', color: 'bg-amber-100 text-amber-800' },
    };

    const currentRoleDisplay = roleDisplay[role] || roleDisplay.kasir;

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    const renderSidebarContent = (compact: boolean) => (
        <div className={`flex flex-col h-full bg-white border-r transition-all duration-300 ${compact ? 'w-[72px]' : 'w-64'} flex-shrink-0 relative`}>
            {/* Logo + Collapse Toggle (Desktop) */}
            <div className={`p-3 border-b flex items-center ${compact ? 'justify-center' : 'justify-between'}`}>
                {!compact && (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1">
                        {logo && (
                            <img src={logo} alt="logo" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border" />
                        )}
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-primary leading-tight truncate">{storeName || 'ERP Bangunan'}</h2>
                            {tagline && <p className="text-[10px] text-gray-400 truncate leading-tight">{tagline}</p>}
                        </div>
                    </div>
                )}
                {compact && logo && (
                    <img src={logo} alt="logo" className="w-9 h-9 rounded-lg object-cover border" />
                )}
                {compact && !logo && (
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-black text-sm">{(storeName || 'E')[0]}</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                    title={compact ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                >
                    {compact ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            {/* Branch Switcher — only in expanded mode */}
            {!compact && <BranchSwitcher />}

            {/* Nav Links */}
            <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overscroll-y-contain relative z-10 pointer-events-auto ${compact ? 'px-2' : 'px-3'}`}>
                {visibleMenus.map((menu, i) => {
                    const active = isActive(menu.href);
                    return (
                        <Link
                            key={i}
                            href={menu.href}
                            onClick={() => setMobileOpen(false)}
                            title={compact ? menu.label : undefined}
                            className={`flex items-center gap-3 rounded-xl transition-all group relative z-20 pointer-events-auto cursor-pointer
                                ${compact ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                                ${active
                                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                                    : 'text-gray-600 hover:bg-slate-100 hover:text-gray-900'
                                }
                            `}
                        >
                            <div className="relative flex-shrink-0 pointer-events-none">
                                <menu.icon className={`w-5 h-5 ${active ? 'text-white' : 'text-primary group-hover:text-primary'}`} />
                                {menu.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                        {menu.badge > 9 ? '9+' : menu.badge}
                                    </span>
                                )}
                            </div>
                            {!compact && (
                                <span className="font-medium text-sm truncate flex-1 pointer-events-none">{menu.label}</span>
                            )}
                            {!compact && menu.badge > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none">
                                    {menu.badge}
                                </span>
                            )}
                            {/* Tooltip when collapsed */}
                            {compact && (
                                <div className="absolute left-full ml-3 whitespace-nowrap bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                                    {menu.label}{menu.badge > 0 ? ` (${menu.badge})` : ''}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className={`border-t bg-slate-50 ${compact ? 'p-2 space-y-2 flex flex-col items-center' : 'p-3 space-y-2'}`}>
                {!compact && (
                    <>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <UserCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate font-medium">{user?.name || 'Pengguna'}</span>
                        </div>
                        <div className={`inline-flex items-center text-xs font-semibold py-1 px-2.5 rounded-full ${currentRoleDisplay.color}`}>
                            {currentRoleDisplay.label}
                        </div>
                    </>
                )}

                <button
                    onClick={() => setShowRoleModal(true)}
                    title={compact ? 'Ganti Role' : undefined}
                    className={`flex items-center justify-center gap-2 border border-slate-300 hover:border-primary hover:bg-primary hover:text-white py-2 rounded-lg text-sm text-gray-600 font-medium transition-colors
                        ${compact ? 'w-10 h-10 px-0' : 'w-full px-3'}
                    `}
                >
                    <LogIn className="w-4 h-4 flex-shrink-0" />
                    {!compact && 'Ganti Role'}
                </button>

                {!compact && (
                    <div className="text-xs text-indigo-500 font-bold text-center bg-indigo-50 py-1 rounded-md">v 2.3.3 (Sync & Branch Fixed)</div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger toggle button */}
            <button
                className="md:hidden fixed top-3 left-3 z-[60] p-2 bg-white shadow-md border rounded-xl text-gray-700 hover:bg-slate-50 transition-colors pointer-events-auto"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay backdrop */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-[55] backdrop-blur-sm pointer-events-auto"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar (slide-in from left) */}
            <div className={`md:hidden fixed top-0 left-0 h-[100dvh] z-[65] transition-transform duration-300 pointer-events-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {renderSidebarContent(false)}
            </div>

            {/* Desktop sidebar (collapsible) */}
            <div className="hidden md:flex flex-col h-full flex-shrink-0 z-50 relative pointer-events-auto shadow-[2px_0_8px_rgba(0,0,0,0.02)]">
                {renderSidebarContent(collapsed)}
            </div>

            {showRoleModal && <RoleSwitchModal onClose={() => setShowRoleModal(false)} />}
        </>
    );
}
