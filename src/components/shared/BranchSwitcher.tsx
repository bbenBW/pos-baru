'use client';

import { useEffect } from 'react';
import { useBranchStore } from '@/store/branchStore';
import { Store } from 'lucide-react';

export function BranchSwitcher() {
    const { branches, activeBranch, loadBranches, setActiveBranch } = useBranchStore();

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    if (!activeBranch || branches.length <= 1) return null;

    return (
        <div className="p-4 border-b bg-emerald-50/50 relative z-50">
            <label className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5 mb-2 relative z-50 pointer-events-none">
                <Store className="w-3.5 h-3.5" /> Cabang Aktif
            </label>
            <select
                value={activeBranch.id}
                onChange={(e) => setActiveBranch(e.target.value)}
                className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-sm text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm relative z-50 cursor-pointer pointer-events-auto"
                style={{ touchAction: 'manipulation' }}
            >
                {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </div>
    );
}
