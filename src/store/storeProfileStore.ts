import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

interface StoreProfile {
    storeName: string;
    ownerName: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    logo: string | null;
    tagline: string;
}

interface StoreProfileState extends StoreProfile {
    update: (data: Partial<StoreProfile>, push?: boolean) => Promise<void>;
    loadFromCloud: () => Promise<void>;
}

const syncOwnerDisplayName = (ownerName?: string) => {
    useAuthStore.getState().syncOwnerProfile(ownerName);
};

export const useStoreProfileStore = create<StoreProfileState>()(
    persist(
        (set, get) => ({
            storeName: "Toko Bangunan Saya",
            ownerName: "Beni",
            address: "",
            phone: "",
            email: "",
            taxId: "",
            logo: null,
            tagline: "Terlengkap, Terpercaya, Terjangkau",

            update: async (data, push = false) => {
                set(state => ({ ...state, ...data }));
                syncOwnerDisplayName(data.ownerName ?? get().ownerName);

                if (push && navigator.onLine) {
                    const current = get();
                    const profileData = { ...current };
                    // @ts-ignore
                    delete profileData.update;
                    // @ts-ignore
                    delete profileData.loadFromCloud;

                    await supabase.from("store_settings").upsert({
                        id: "global_profile",
                        preferences: profileData,
                        updated_at: new Date().toISOString()
                    });
                }
            },

            loadFromCloud: async () => {
                if (!navigator.onLine) return;
                try {
                    const { data, error } = await supabase
                        .from("store_settings")
                        .select("preferences")
                        .eq("id", "global_profile")
                        .single();

                    if (!error && data?.preferences) {
                        set(state => ({ ...state, ...data.preferences }));
                        syncOwnerDisplayName(data.preferences.ownerName);
                    }
                } catch (err) {
                    console.error("Failed to load profile from cloud", err);
                }
            }
        }),
        { name: "store-profile" }
    )
);
