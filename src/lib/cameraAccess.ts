'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

type CameraAccessPlugin = {
    getStatus: () => Promise<{ granted: boolean }>;
    requestCameraPermission: () => Promise<{ granted: boolean }>;
};

const CameraAccess = registerPlugin<CameraAccessPlugin>('CameraAccess');

export const isNativeAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const requestNativeCameraPermission = async (): Promise<boolean> => {
    if (!isNativeAndroidApp()) return true;

    try {
        const status = await CameraAccess.getStatus();
        if (status.granted) return true;
        const result = await CameraAccess.requestCameraPermission();
        return !!result.granted;
    } catch {
        return false;
    }
};
