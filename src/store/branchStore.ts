import { create } from 'zustand';
import { db, OfflineBranch } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

interface BranchState {
    branches: OfflineBranch[];
    activeBranch: OfflineBranch | null;
    loading: boolean;
    loadBranches: () => Promise<void>;
    setActiveBranch: (branchId: string) => void;
    addBranch: (name: string, address: string, phone: string) => Promise<void>;
    deleteBranch: (branchId: string) => Promise<void>;
    updateBranch: (branchId: string, name: string, address: string, phone: string) => Promise<void>;
}

export const useBranchStore = create<BranchState>((set, get) => ({
    branches: [],
    activeBranch: null,
    loading: true,

    loadBranches: async () => {
        set({ loading: true });
        try {
            let localBranches = await db.branches.toArray();

            // Always sync from Supabase when online (source of truth)
            if (navigator.onLine) {
                const { data: remoteBranches, error } = await supabase.from('branches').select('*').order('created_at', { ascending: true });
                if (!error && remoteBranches && remoteBranches.length > 0) {
                    // Replace local with remote (handles deletes from other devices)
                    await db.branches.clear();
                    await db.branches.bulkPut(remoteBranches);
                    localBranches = remoteBranches;
                }
            } else {
                // If offline, still sort local branches for UI consistency
                localBranches.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
            }

            // Deduplicate by ID (safety net for offline edge cases)
            const seen = new Set<string>();
            const uniqueBranches: OfflineBranch[] = [];
            for (const b of localBranches) {
                if (!seen.has(b.id)) {
                    seen.add(b.id);
                    uniqueBranches.push(b);
                }
            }

            // Create default branch if absolutely empty
            if (uniqueBranches.length === 0) {
                const defaultBranch: OfflineBranch = {
                    id: '00000000-0000-0000-0000-000000000000', // Valid UUID format for default branch to prevent Supabase rejection
                    name: 'Toko Pusat (Utama)',
                    address: '',
                    phone: '',
                    created_at: new Date().toISOString()
                };
                await db.branches.add(defaultBranch);
                uniqueBranches.push(defaultBranch);
                if (navigator.onLine) {
                    await supabase.from('branches').upsert([defaultBranch]);
                }
            }

            const currentActive = get().activeBranch;
            const newActive = currentActive
                ? uniqueBranches.find(b => b.id === currentActive.id) || uniqueBranches[0]
                : uniqueBranches[0];

            set({ branches: uniqueBranches, activeBranch: newActive });
        } catch (error) {
            console.error('Failed to load branches', error);
        } finally {
            set({ loading: false });
        }
    },

    setActiveBranch: (branchId) => {
        const branch = get().branches.find(b => b.id === branchId) || null;
        set({ activeBranch: branch });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId } }));
        }
    },

    addBranch: async (name, address, phone) => {
        const newBranch: OfflineBranch = {
            id: crypto.randomUUID(),
            name,
            address,
            phone,
            created_at: new Date().toISOString()
        };
        await db.branches.add(newBranch);
        set(state => ({ branches: [...state.branches, newBranch] }));
        if (navigator.onLine) {
            await supabase.from('branches').insert([newBranch]);
        }
    },

    deleteBranch: async (branchId) => {
        const { branches, activeBranch } = get();
        if (branches.length <= 1) return; // never delete the last branch
        await db.branches.delete(branchId);
        const remaining = branches.filter(b => b.id !== branchId);
        const newActive = activeBranch?.id === branchId ? remaining[0] : activeBranch;
        set({ branches: remaining, activeBranch: newActive });
        if (navigator.onLine) {
            await supabase.from('branches').delete().eq('id', branchId);
        }
    },

    updateBranch: async (branchId, name, address, phone) => {
        await db.branches.update(branchId, { name, address, phone });
        set(state => ({
            branches: state.branches.map(b => b.id === branchId ? { ...b, name, address, phone } : b),
            activeBranch: state.activeBranch?.id === branchId
                ? { ...state.activeBranch, name, address, phone }
                : state.activeBranch
        }));
        if (navigator.onLine) {
            await supabase.from('branches').update({ name, address, phone }).eq('id', branchId);
        }
    }
}));
