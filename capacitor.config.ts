import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.tokobangunan.pos',
    appName: 'POS Bangunan',
    webDir: 'out',
    server: {
        // Ganti URL ini dengan URL Vercel Bapak yang sebenarnya
        // Contoh: https://bangunan-pos-xxx.vercel.app
        url: 'https://bangunan-pos.vercel.app',
        cleartext: false,
        androidScheme: 'https',
    },
    android: {
        allowMixedContent: false,
        backgroundColor: '#ffffff',
        useLegacyBridge: false,
    },
};

export default config;
