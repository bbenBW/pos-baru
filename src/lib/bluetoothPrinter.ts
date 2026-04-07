import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PairedBluetoothPrinter {
    name: string;
    address: string;
    bondState?: number;
}

export interface PrinterDiagnosticResult {
    success: boolean;
    message: string;
    available: boolean;
    enabled: boolean;
    address: string;
    deviceName?: string;
    canConnect?: boolean;
    bondState?: number;
}

interface BluetoothPrinterPlugin {
    isAvailable(): Promise<{ available: boolean; enabled: boolean; platform: string }>;
    listPairedPrinters(): Promise<{ devices: PairedBluetoothPrinter[] }>;
    printText(options: { address: string; text: string }): Promise<{ success: boolean; address: string }>;
    diagnosePrinter(options: { address: string }): Promise<PrinterDiagnosticResult>;
}

const NativeBluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>("BluetoothPrinter");

export const isNativeBluetoothPrintingSupported = () => Capacitor.getPlatform() === "android";

export const getBluetoothPrinterAvailability = async () => {
    if (!isNativeBluetoothPrintingSupported()) {
        return { available: false, enabled: false, platform: Capacitor.getPlatform() };
    }
    return NativeBluetoothPrinter.isAvailable();
};

export const listPairedBluetoothPrinters = async (): Promise<PairedBluetoothPrinter[]> => {
    if (!isNativeBluetoothPrintingSupported()) return [];
    const result = await NativeBluetoothPrinter.listPairedPrinters();
    return result.devices || [];
};

export const printTextToBluetoothPrinter = async (address: string, text: string) => {
    if (!isNativeBluetoothPrintingSupported()) {
        throw new Error("Direct Bluetooth print hanya tersedia di aplikasi Android.");
    }
    return NativeBluetoothPrinter.printText({ address, text });
};

export const diagnoseBluetoothPrinter = async (address: string): Promise<PrinterDiagnosticResult> => {
    if (!isNativeBluetoothPrintingSupported()) {
        return {
            success: false,
            message: "Diagnosa printer hanya tersedia di aplikasi Android.",
            available: false,
            enabled: false,
            address,
            canConnect: false,
        };
    }
    return NativeBluetoothPrinter.diagnosePrinter({ address });
};
