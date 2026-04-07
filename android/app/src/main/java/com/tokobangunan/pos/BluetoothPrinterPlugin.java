package com.tokobangunan.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(alias = "bluetoothScan", strings = { Manifest.permission.BLUETOOTH_SCAN })
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        result.put("platform", "android");
        call.resolve(result);
    }

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (needsBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "listPairedPrintersPermissionCallback");
            return;
        }
        performListPairedPrinters(call);
    }

    @PermissionCallback
    private void listPairedPrintersPermissionCallback(PluginCall call) {
        if (needsBluetoothConnectPermission()) {
            call.reject("Izin Bluetooth belum diberikan.");
            return;
        }
        performListPairedPrinters(call);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (needsBluetoothConnectPermission() || needsBluetoothScanPermission()) {
            requestPermissionForAliases(new String[] { "bluetoothConnect", "bluetoothScan" }, call, "printTextPermissionCallback");
            return;
        }
        performPrintText(call);
    }

    @PermissionCallback
    private void printTextPermissionCallback(PluginCall call) {
        if (needsBluetoothConnectPermission() || needsBluetoothScanPermission()) {
            call.reject("Izin Bluetooth belum diberikan.");
            return;
        }
        performPrintText(call);
    }

    @PluginMethod
    public void diagnosePrinter(PluginCall call) {
        if (needsBluetoothConnectPermission() || needsBluetoothScanPermission()) {
            requestPermissionForAliases(new String[] { "bluetoothConnect", "bluetoothScan" }, call, "diagnosePrinterPermissionCallback");
            return;
        }
        performDiagnosePrinter(call);
    }

    @PermissionCallback
    private void diagnosePrinterPermissionCallback(PluginCall call) {
        if (needsBluetoothConnectPermission() || needsBluetoothScanPermission()) {
            call.reject("Izin Bluetooth belum diberikan.");
            return;
        }
        performDiagnosePrinter(call);
    }

    private boolean needsBluetoothConnectPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetoothConnect") != PermissionState.GRANTED;
    }

    private boolean needsBluetoothScanPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetoothScan") != PermissionState.GRANTED;
    }

    private void performListPairedPrinters(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak mendukung Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth belum aktif. Nyalakan Bluetooth tablet terlebih dahulu.");
            return;
        }

        Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
        List<BluetoothDevice> devices = new ArrayList<>(bondedDevices);
        devices.sort(Comparator.comparing(device -> safeName(device).toLowerCase()));

        JSArray printerList = new JSArray();
        for (BluetoothDevice device : devices) {
            JSObject item = new JSObject();
            item.put("name", safeName(device));
            item.put("address", device.getAddress());
            item.put("bondState", device.getBondState());
            printerList.put(item);
        }

        JSObject result = new JSObject();
        result.put("devices", printerList);
        call.resolve(result);
    }

    private void performPrintText(PluginCall call) {
        String address = call.getString("address");
        String text = call.getString("text");

        if (address == null || address.trim().isEmpty()) {
            call.reject("Alamat printer belum dipilih.");
            return;
        }
        if (text == null || text.trim().isEmpty()) {
            call.reject("Data struk kosong.");
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Perangkat ini tidak mendukung Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth belum aktif. Nyalakan Bluetooth tablet terlebih dahulu.");
            return;
        }

        BluetoothSocket socket = null;
        OutputStream outputStream = null;
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            cancelDiscoveryIfAllowed(adapter);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();

            outputStream = socket.getOutputStream();
            String normalizedText = text.replace("\r\n", "\n");
            byte[] payload = normalizedText.getBytes(StandardCharsets.US_ASCII);
            outputStream.write(new byte[] { 0x1B, 0x40 });
            outputStream.write(payload);
            outputStream.write(new byte[] { 0x1B, 0x64, 0x01 });
            outputStream.write(new byte[] { 0x0A, 0x0A });
            outputStream.flush();
            waitForPrinterDrain(payload.length);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("address", address);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Gagal mencetak ke printer Bluetooth: " + ex.getMessage());
        } finally {
            closeQuietly(outputStream);
            closeQuietly(socket);
        }
    }

    private void performDiagnosePrinter(PluginCall call) {
        String address = call.getString("address");
        JSObject result = new JSObject();
        result.put("address", address == null ? "" : address);

        if (address == null || address.trim().isEmpty()) {
            result.put("success", false);
            result.put("available", true);
            result.put("enabled", true);
            result.put("canConnect", false);
            result.put("message", "Alamat printer belum dipilih.");
            call.resolve(result);
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());

        if (adapter == null) {
            result.put("success", false);
            result.put("canConnect", false);
            result.put("message", "Perangkat ini tidak mendukung Bluetooth.");
            call.resolve(result);
            return;
        }
        if (!adapter.isEnabled()) {
            result.put("success", false);
            result.put("canConnect", false);
            result.put("message", "Bluetooth belum aktif. Nyalakan Bluetooth tablet terlebih dahulu.");
            call.resolve(result);
            return;
        }

        BluetoothSocket socket = null;
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            result.put("deviceName", safeName(device));
            result.put("bondState", device.getBondState());
            cancelDiscoveryIfAllowed(adapter);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            result.put("success", true);
            result.put("canConnect", true);
            result.put("message", "Koneksi ke printer berhasil. Printer siap dipakai.");
        } catch (Exception ex) {
            result.put("success", false);
            result.put("canConnect", false);
            result.put("message", "Tidak bisa terhubung ke printer: " + ex.getMessage());
        } finally {
            closeQuietly(socket);
        }

        call.resolve(result);
    }

    @NonNull
    private String safeName(BluetoothDevice device) {
        String name = device.getName();
        return (name == null || name.trim().isEmpty()) ? "Printer Tanpa Nama" : name;
    }

    private void closeQuietly(OutputStream outputStream) {
        if (outputStream == null) return;
        try {
            outputStream.close();
        } catch (IOException ignored) {
        }
    }

    private void waitForPrinterDrain(int payloadLength) {
        long estimatedMs = Math.max(120L, payloadLength * 2L);
        long boundedMs = Math.min(estimatedMs, 900L);
        try {
            Thread.sleep(boundedMs);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private void cancelDiscoveryIfAllowed(BluetoothAdapter adapter) {
        if (adapter == null) return;
        if (needsBluetoothScanPermission()) {
            return;
        }
        try {
            adapter.cancelDiscovery();
        } catch (SecurityException ignored) {
        }
    }

    private void closeQuietly(BluetoothSocket socket) {
        if (socket == null) return;
        try {
            socket.close();
        } catch (IOException ignored) {
        }
    }
}
