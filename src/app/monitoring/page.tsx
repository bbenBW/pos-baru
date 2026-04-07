'use client';

import { useState } from 'react';
import { ShieldCheck, RefreshCcw, PackageSearch } from 'lucide-react';
import { ShiftHistoryPanel } from '@/components/settings/ShiftHistoryPanel';
import { SyncLogPanel } from '@/components/settings/SyncLogPanel';
import { AuditLogPanel } from '@/components/settings/AuditLogPanel';
import { useAuthStore } from '@/store/authStore';

type TabKey = 'shift' | 'sync' | 'audit';

const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
    { key: 'shift', label: 'Monitor Shift', icon: ShieldCheck },
    { key: 'sync', label: 'Log Sinkronisasi', icon: RefreshCcw },
    { key: 'audit', label: 'Audit Log Stok', icon: PackageSearch },
];

export default function MonitoringPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('shift');
    const user = useAuthStore(state => state.user);

    if (!user?.role || !['owner', 'admin'].includes(user.role)) {
        return (
            <div className="max-w-3xl mx-auto bg-white rounded-xl border shadow-sm p-6">
                <h1 className="text-xl font-bold text-gray-800">Monitoring Owner/Admin</h1>
                <p className="text-sm text-gray-500 mt-2">Halaman ini hanya bisa dipantau oleh role owner atau admin.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Monitoring Owner/Admin</h1>
                <p className="text-sm text-gray-500 mt-1">Pantau shift kasir, riwayat sinkronisasi, dan audit stok dari satu tempat.</p>
            </div>

            <div className="flex gap-2 overflow-x-auto bg-slate-100 p-1 rounded-xl no-scrollbar">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                                isActive ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="space-y-4">
                {activeTab === 'shift' && <ShiftHistoryPanel />}
                {activeTab === 'sync' && <SyncLogPanel />}
                {activeTab === 'audit' && <AuditLogPanel />}
            </div>
        </div>
    );
}
