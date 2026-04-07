import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "owner" | "admin" | "kasir" | "gudang";

interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole | null;
}

const DEFAULT_OWNER_NAME = "Beni";

const ROLE_USER_IDS: Record<UserRole, string> = {
    owner: "00000000-0000-0000-0000-000000000001",
    admin: "00000000-0000-0000-0000-000000000002",
    kasir: "00000000-0000-0000-0000-000000000003",
    gudang: "00000000-0000-0000-0000-000000000004",
};

const normalizeUser = (user: User | null): User | null => {
    if (!user || !user.role) return user;
    const roleId = ROLE_USER_IDS[user.role];
    if (!roleId) return user;
    return {
        ...user,
        id: roleId,
        name: user.role === "owner" ? getOwnerDisplayName() : getRoleDisplayName(user.role),
        email: user.email || `${user.role}@toko.com`,
    };
};

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

export const getOwnerDisplayName = (ownerName?: string | null) => `${(ownerName && ownerName.trim()) || readStoredOwnerName() || DEFAULT_OWNER_NAME} (Owner)`;

export const getRoleDisplayName = (role: UserRole, ownerName?: string | null) => {
    const roleNames: Record<UserRole, string> = {
        owner: getOwnerDisplayName(ownerName),
        admin: "Admin",
        kasir: "Kasir",
        gudang: "Staff Gudang",
    };
    return roleNames[role];
};

const DEFAULT_PASSWORDS: Record<UserRole, string> = {
    owner: "owner123",
    admin: "admin123",
    kasir: "kasir123",
    gudang: "gudang123",
};

interface AuthState {
    user: User | null;
    rolePasswords: Record<UserRole, string>;
    loading: boolean;
    hasHydrated: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setHasHydrated: (value: boolean) => void;
    logout: () => void;
    verifyRolePassword: (role: UserRole, password: string) => boolean;
    changeRolePassword: (role: UserRole, newPassword: string, ownerPassword: string) => boolean;
    switchRole: (role: UserRole, password: string) => boolean;
    syncOwnerProfile: (ownerName?: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: { id: ROLE_USER_IDS.owner, email: "owner@toko.com", name: getOwnerDisplayName(), role: "owner" as UserRole },
            rolePasswords: { ...DEFAULT_PASSWORDS },
            loading: false,
            hasHydrated: false,

            setUser: (user) => set({ user }),
            setLoading: (loading) => set({ loading }),
            setHasHydrated: (value) => set({ hasHydrated: value }),
            logout: () => set({ user: null }),

            verifyRolePassword: (role, password) => {
                const { rolePasswords } = get();
                return rolePasswords[role] === password;
            },

            changeRolePassword: (role, newPassword, ownerPassword) => {
                const { rolePasswords } = get();
                if (rolePasswords["owner"] !== ownerPassword) {
                    return false;
                }
                set({ rolePasswords: { ...rolePasswords, [role]: newPassword } });
                return true;
            },

            switchRole: (role, password) => {
                const { rolePasswords } = get();
                if (rolePasswords[role] !== password) {
                    return false;
                }

                set({
                    user: {
                        id: ROLE_USER_IDS[role],
                        email: `${role}@toko.com`,
                        name: getRoleDisplayName(role),
                        role,
                    }
                });
                return true;
            },

            syncOwnerProfile: (ownerName) => {
                const { user } = get();
                if (!user || user.role !== "owner") return;
                set({
                    user: {
                        ...user,
                        name: getOwnerDisplayName(ownerName),
                    }
                });
            },
        }),
        {
            name: "auth-store",
            partialize: (state: AuthState) => ({ user: state.user, rolePasswords: state.rolePasswords }),
            onRehydrateStorage: () => (state) => {
                if (state?.user) {
                    state.setUser(normalizeUser(state.user));
                }
                state?.setHasHydrated(true);
            },
        }
    )
);
