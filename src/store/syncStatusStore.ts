'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SyncLogEntry {
    id: string;
    type: 'success' | 'error';
    message: string;
    at: string;
}

interface SyncStatusState {
    isSyncing: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
    history: SyncLogEntry[];
    setSyncing: (isSyncing: boolean) => void;
    markSuccess: (message?: string) => void;
    setError: (message: string) => void;
    clearError: () => void;
    clearHistory: () => void;
}

const MAX_HISTORY = 50;

export const useSyncStatusStore = create<SyncStatusState>()(
    persist(
        (set, get) => ({
            isSyncing: false,
            lastSyncAt: null,
            lastError: null,
            lastErrorAt: null,
            history: [],
            setSyncing: (isSyncing) => set({ isSyncing }),
            markSuccess: (message = 'Sinkronisasi berhasil') => {
                const entry: SyncLogEntry = {
                    id: crypto.randomUUID(),
                    type: 'success',
                    message,
                    at: new Date().toISOString()
                };
                const next = [entry, ...get().history].slice(0, MAX_HISTORY);
                set({
                    lastSyncAt: entry.at,
                    lastError: null,
                    lastErrorAt: null,
                    history: next
                });
            },
            setError: (message) => {
                const entry: SyncLogEntry = {
                    id: crypto.randomUUID(),
                    type: 'error',
                    message,
                    at: new Date().toISOString()
                };
                const next = [entry, ...get().history].slice(0, MAX_HISTORY);
                set({
                    lastError: message,
                    lastErrorAt: entry.at,
                    history: next
                });
            },
            clearError: () => set({ lastError: null, lastErrorAt: null }),
            clearHistory: () => set({ history: [] })
        }),
        {
            name: 'sync-status',
            partialize: (state) => ({
                lastSyncAt: state.lastSyncAt,
                lastError: state.lastError,
                lastErrorAt: state.lastErrorAt,
                history: state.history
            })
        }
    )
);
