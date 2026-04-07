import { create } from "zustand";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export type UserRole = "owner" | "admin" | "kasir" | "gudang";

interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole | null;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    hasHydrated: boolean;
    initialized: boolean;
    error: string | null;
    initializeAuth: () => Promise<void>;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
    syncOwnerProfile: (ownerName?: string | null) => void;
    setHasHydrated: (value: boolean) => void;
}

type AppUserRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: UserRole | null;
    is_active: boolean | null;
};

const DEFAULT_OWNER_NAME = "Beni";

const readStoredOwnerName = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem("store-profile");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const ownerName = parsed?.state?.ownerName || parsed?.ownerName;
        const normalized = typeof ownerName === "string" ? ownerName.trim() : "";
        return normalized || null;
    } catch {
        return null;
    }
};

export const getOwnerDisplayName = (ownerName?: string | null) =>
    `${(ownerName && ownerName.trim()) || readStoredOwnerName() || DEFAULT_OWNER_NAME} (Owner)`;

export const getRoleDisplayName = (role: UserRole, ownerName?: string | null) => {
    const roleNames: Record<UserRole, string> = {
        owner: getOwnerDisplayName(ownerName),
        admin: "Admin",
        kasir: "Kasir",
        gudang: "Staff Gudang",
    };
    return roleNames[role];
};

const mapProfileToUser = (profile: AppUserRow, fallbackEmail?: string | null): User => {
    const role = profile.role ?? "kasir";
    return {
        id: profile.id,
        email: profile.email || fallbackEmail || "",
        name: profile.full_name?.trim() || getRoleDisplayName(role),
        role,
    };
};

const loadProfileForCurrentSession = async (): Promise<{ user: User | null; error?: string }> => {
    if (!supabaseConfigured) {
        return { user: null, error: "Supabase belum dikonfigurasi di auth-lab." };
    }

    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
        return { user: null, error: sessionError.message };
    }

    if (!session?.user) {
        return { user: null };
    }

    const { data: profile, error: profileError } = await supabase
        .from("app_users")
        .select("id, email, full_name, role, is_active")
        .eq("id", session.user.id)
        .single();

    if (profileError) {
        return { user: null, error: `Profil user belum siap: ${profileError.message}` };
    }

    if (!profile?.is_active) {
        return { user: null, error: "Akun ini belum aktif. Hubungi owner/admin." };
    }

    return { user: mapProfileToUser(profile as AppUserRow, session.user.email) };
};

let authSubscriptionBound = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
    user: null,
    loading: false,
    hasHydrated: false,
    initialized: false,
    error: null,

    setHasHydrated: (value) => set({ hasHydrated: value }),

    initializeAuth: async () => {
        if (get().initialized) {
            if (!get().hasHydrated) set({ hasHydrated: true });
            return;
        }

        set({ loading: true, error: null });

        const result = await loadProfileForCurrentSession();
        set({
            user: result.user,
            error: result.error || null,
            loading: false,
            hasHydrated: true,
            initialized: true,
        });

        if (!authSubscriptionBound && supabaseConfigured) {
            authSubscriptionBound = true;
            supabase.auth.onAuthStateChange(async (_event, session) => {
                if (!session?.user) {
                    set({ user: null, error: null, loading: false, hasHydrated: true, initialized: true });
                    return;
                }

                const refreshed = await loadProfileForCurrentSession();
                set({
                    user: refreshed.user,
                    error: refreshed.error || null,
                    loading: false,
                    hasHydrated: true,
                    initialized: true,
                });
            });
        }
    },

    login: async (email, password) => {
        if (!supabaseConfigured) {
            return { success: false, error: "Supabase auth-lab belum dikonfigurasi." };
        }

        set({ loading: true, error: null });

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) {
            set({ loading: false, error: error.message });
            return { success: false, error: error.message };
        }

        const refreshed = await loadProfileForCurrentSession();
        set({
            user: refreshed.user,
            error: refreshed.error || null,
            loading: false,
            hasHydrated: true,
            initialized: true,
        });

        if (!refreshed.user) {
            return { success: false, error: refreshed.error || "Profil user tidak ditemukan." };
        }

        return { success: true };
    },

    logout: async () => {
        if (supabaseConfigured) {
            await supabase.auth.signOut();
        }
        set({ user: null, error: null, loading: false });
    },

    refreshUserProfile: async () => {
        set({ loading: true, error: null });
        const refreshed = await loadProfileForCurrentSession();
        set({
            user: refreshed.user,
            error: refreshed.error || null,
            loading: false,
            hasHydrated: true,
            initialized: true,
        });
    },

    syncOwnerProfile: (ownerName) => {
        const { user } = get();
        if (!user || user.role !== "owner") return;
        set({
            user: {
                ...user,
                name: getOwnerDisplayName(ownerName),
            },
        });
    },
}));
