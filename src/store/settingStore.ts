import { create } from 'zustand';
import { db } from '@/lib/dexie';

interface Settings {
    hideDashboard: boolean;
    requireCustomer: boolean;
    requireProductBarcode: boolean;
    posShowProductImages: boolean;
    deviceId: string;
    deviceName: string;
    printMode: 'browser' | 'bluetooth';
    bluetoothMacAddress: string | null;
    bluetoothPrinterName: string | null;
    paperSize: '58mm' | '80mm';
}

interface SettingState {
    settings: Settings;
    loading: boolean;
    loadSettings: () => Promise<void>;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

const defaultSettings: Settings = {
    hideDashboard: false,
    requireCustomer: false,
    requireProductBarcode: false,
    posShowProductImages: true,
    deviceId: '',
    deviceName: 'Perangkat Kasir',
    printMode: 'browser',
    bluetoothMacAddress: null,
    bluetoothPrinterName: null,
    paperSize: '58mm'
};

const guessDeviceName = () => {
    if (typeof window === 'undefined') return 'Perangkat Kasir';
    const ua = navigator.userAgent || '';

    if (/iPad/i.test(ua)) return 'iPad';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/SM-|Samsung/i.test(ua)) return /Mobile/i.test(ua) ? 'Samsung Phone' : 'Samsung Tablet';
    if (/Redmi/i.test(ua)) return /Mobile/i.test(ua) ? 'Redmi Phone' : 'Redmi Tablet';
    if (/Mi /i.test(ua) || /Xiaomi/i.test(ua)) return /Mobile/i.test(ua) ? 'Xiaomi Phone' : 'Xiaomi Tablet';
    if (/POCO/i.test(ua)) return 'POCO Phone';
    if (/OPPO/i.test(ua)) return 'OPPO Phone';
    if (/vivo/i.test(ua)) return 'vivo Phone';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';

    return 'Perangkat Kasir';
};

const ensureDeviceIdentity = (settings: Settings): Settings => {
    const next = { ...settings };
    if (!next.deviceId) next.deviceId = crypto.randomUUID();
    if (!next.deviceName?.trim() || next.deviceName === 'Perangkat Kasir') next.deviceName = guessDeviceName();
    return next;
};

export const useSettingStore = create<SettingState>((set, get) => ({
    settings: defaultSettings,
    loading: true,

    loadSettings: async () => {
        set({ loading: true });
        try {
            const allSettings = await db.store_settings.toArray();
            if (allSettings.length > 0) {
                const prefs = allSettings[0].preferences as Settings;
                const merged = ensureDeviceIdentity({ ...defaultSettings, ...prefs });
                if (merged.deviceId !== prefs.deviceId || merged.deviceName !== prefs.deviceName) {
                    await db.store_settings.update(allSettings[0].id, {
                        preferences: merged,
                        updated_at: new Date().toISOString()
                    });
                }
                set({ settings: merged });
            } else {
                const initial = ensureDeviceIdentity({ ...defaultSettings });
                await db.store_settings.add({
                    id: crypto.randomUUID(),
                    preferences: initial,
                    updated_at: new Date().toISOString()
                });
                set({ settings: initial });
            }
        } catch (error) {
            console.error('Error loading settings', error);
        } finally {
            set({ loading: false });
        }
    },

    updateSettings: async (newSettingsObj) => {
        try {
            const current = get().settings;
            const updated = ensureDeviceIdentity({ ...current, ...newSettingsObj });

            const allSettings = await db.store_settings.toArray();
            if (allSettings.length > 0) {
                await db.store_settings.update(allSettings[0].id, {
                    preferences: updated,
                    updated_at: new Date().toISOString()
                });
            } else {
                await db.store_settings.add({
                    id: crypto.randomUUID(),
                    preferences: updated
                });
            }

            set({ settings: updated });
        } catch (error) {
            console.error('Failed saving settings', error);
        }
    }
}));
