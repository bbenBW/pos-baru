'use client';

import { useEffect, useState } from 'react';
import { useSettingStore } from '@/store/settingStore';
import { useStoreProfileStore } from '@/store/storeProfileStore';
import { useBranchStore } from '@/store/branchStore';
import {
    Settings2, Bluetooth, Printer, Sliders, Store,
    Receipt, ShieldCheck, Save, Building2, Phone, Mail, FileText, Image as ImageIcon,
    GitBranch, Plus, Trash2, Edit2, Check, X as XIcon, AlertCircle, CheckCircle2, KeyRound,
    Activity, RefreshCw, Zap, Database, Upload
} from 'lucide-react';
import { useProductStore } from '@/store/productStore';
import { PasswordManagerPanel } from '@/components/settings/PasswordManagerPanel';
import { ReceiptSettingsPanel } from '@/components/settings/ReceiptSettingsPanel';
import { useFontScale } from '@/hooks/useFontScale';
import { diagnoseBluetoothPrinter, getBluetoothPrinterAvailability, isNativeBluetoothPrintingSupported, listPairedBluetoothPrinters, PairedBluetoothPrinter, printTextToBluetoothPrinter, PrinterDiagnosticResult } from '@/lib/bluetoothPrinter';

type Tab = 'toko' | 'cabang' | 'tampilan' | 'printer' | 'struk' | 'password' | 'backup' | 'troubleshoot';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'toko', label: 'Detail Toko', icon: Store },
    { key: 'cabang', label: 'Cabang', icon: GitBranch },
    { key: 'tampilan', label: 'Tampilan & UI', icon: Sliders },
    { key: 'printer', label: 'Printer', icon: Printer },
    { key: 'struk', label: 'Format Struk', icon: Receipt },
    { key: 'password', label: 'Password Role', icon: ShieldCheck },
    { key: 'backup', label: 'Backup Data', icon: FileText },
    { key: 'troubleshoot', label: 'Pusat Bantuan', icon: Activity },
];

export default function SettingsPage() {
    const { settings, loadSettings, updateSettings, loading } = useSettingStore();
    const profile = useStoreProfileStore();
    const { branches, loadBranches, addBranch, deleteBranch, updateBranch } = useBranchStore();
    const [activeTab, setActiveTab] = useState<Tab>('toko');
    const [statusMessage, setStatusMessage] = useState('');
    const [saved, setSaved] = useState(false);
    const [printerDiagnostic, setPrinterDiagnostic] = useState<PrinterDiagnosticResult | null>(null);
    const [pairedPrinters, setPairedPrinters] = useState<PairedBluetoothPrinter[]>([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const nativeBluetoothSupported = isNativeBluetoothPrintingSupported();
    const { scale, increase, decrease, reset, applyScale, min, max } = useFontScale();
    const { syncProgress, loading: productLoading, lastSyncError: productSyncError } = useProductStore();

    // Branch form state
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [newBranchPhone, setNewBranchPhone] = useState('');
    const [addingBranch, setAddingBranch] = useState(false);
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editPhone, setEditPhone] = useState('');

    useEffect(() => {
        loadSettings();
        loadBranches();
        profile.loadFromCloud();
    }, [loadSettings, loadBranches]);

    const handleAddBranch = async () => {
        if (!newBranchName.trim()) return;
        await addBranch(newBranchName.trim(), newBranchAddress.trim(), newBranchPhone.trim());
        setNewBranchName(''); setNewBranchAddress(''); setNewBranchPhone(''); setAddingBranch(false);
    };

    const startEdit = (b: typeof branches[0]) => {
        setEditingBranchId(b.id); setEditName(b.name); setEditAddress(b.address || ''); setEditPhone(b.phone || '');
    };

    const saveEdit = async () => {
        if (!editingBranchId || !editName.trim()) return;
        await updateBranch(editingBranchId, editName.trim(), editAddress.trim(), editPhone.trim());
        setEditingBranchId(null);
    };

    const handleToggle = (key: keyof typeof settings) => updateSettings({ [key]: !settings[key] });
    const handleSelect = (key: keyof typeof settings, value: string) => updateSettings({ [key]: value });

    const pairBluetoothPrinter = async () => {
        if (nativeBluetoothSupported) {
            setLoadingPrinters(true);
            setStatusMessage('Memuat printer Bluetooth yang sudah di-pair di Android...');
            try {
                const availability = await getBluetoothPrinterAvailability();
                if (!availability.available) {
                    setStatusMessage('Perangkat ini tidak mendukung Bluetooth printer.');
                    return;
                }
                if (!availability.enabled) {
                    setStatusMessage('Bluetooth tablet belum aktif. Nyalakan Bluetooth lalu coba lagi.');
                    return;
                }
                const devices = await listPairedBluetoothPrinters();
                setPairedPrinters(devices);
                setStatusMessage(devices.length > 0 ? 'Pilih printer thermal 58mm dari daftar di bawah.' : 'Belum ada printer yang ter-pair. Pair printer dari pengaturan Bluetooth Android terlebih dahulu.');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Gagal memuat printer Bluetooth.';
                setStatusMessage(message);
            } finally {
                setLoadingPrinters(false);
            }
            return;
        }

        // @ts-ignore
        if (!navigator.bluetooth) {
            alert('Browser tidak mendukung Web Bluetooth API. Gunakan aplikasi Android POS untuk direct print Bluetooth.');
            return;
        }
        setStatusMessage('Mencari perangkat kasir Bluetooth...');
        try {
            // @ts-ignore
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });
            if (device?.name) {
                setStatusMessage(`Browser berhasil mengenali: ${device.name}`);
                await updateSettings({ bluetoothMacAddress: device.id || null, bluetoothPrinterName: device.name, printMode: 'bluetooth' });
            }
        } catch {
            setStatusMessage('Pencarian Bluetooth dibatalkan / Gagal.');
        }
    };

    const connectNativePrinter = async (device: PairedBluetoothPrinter) => {
        await updateSettings({
            bluetoothMacAddress: device.address,
            bluetoothPrinterName: device.name,
            printMode: 'bluetooth'
        });
        setPrinterDiagnostic(null);
        setStatusMessage(`Printer tersambung: ${device.name} (${device.address})`);
    };

    const runPrinterDiagnostic = async () => {
        if (!settings.bluetoothMacAddress) {
            alert('Pilih printer Bluetooth terlebih dahulu.');
            return;
        }
        setStatusMessage('Menjalankan diagnosis koneksi printer...');
        try {
            const result = await diagnoseBluetoothPrinter(settings.bluetoothMacAddress);
            setPrinterDiagnostic(result);
            setStatusMessage(result.message);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Diagnosa printer gagal.';
            setPrinterDiagnostic({ success: false, message, available: true, enabled: true, address: settings.bluetoothMacAddress, canConnect: false });
            setStatusMessage(message);
            alert(message);
        }
    };

    const testPrintBluetooth = async () => {
        if (!settings.bluetoothMacAddress) {
            alert('Pilih printer Bluetooth terlebih dahulu.');
            return;
        }
        try {
            const testText = [
                'TES PRINTER 58MM',
                'POS Bangunan',
                new Date().toLocaleString('id-ID'),
                'Jika teks ini keluar rapi, printer siap dipakai.',
                '',
                'Terima kasih',
                ''
            ].join('\n');
            await printTextToBluetoothPrinter(settings.bluetoothMacAddress, testText);
            setStatusMessage('Test print berhasil.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Test print gagal.';
            setStatusMessage(message);
            alert(message);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => profile.update({ logo: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        await profile.update({}, true); // Trigger push of current state to cloud
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat konfigurasi...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-primary" /> Pengaturan Sistem
                </h1>
                <p className="text-gray-500 text-sm mt-1">Konfigurasi toko, tampilan, printer, dan akses pengguna.</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl mb-6 no-scrollbar">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0
                                ${isActive ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-800'}
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl border shadow-sm p-6">

                {/* ── TAB: DETAIL TOKO ── */}
                {activeTab === 'toko' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-emerald-600" /> Profil Toko
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">Informasi ini ditampilkan di header aplikasi dan struk transaksi.</p>
                        </div>

                        {/* Logo upload */}
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-slate-50 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-slate-100 flex-shrink-0">
                                {profile.logo ? (
                                    <img src={profile.logo} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <ImageIcon className="w-7 h-7 mx-auto mb-1" />
                                        <span className="text-xs">Logo</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Nama Toko *</label>
                                <input
                                    value={profile.storeName}
                                    onChange={e => profile.update({ storeName: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-lg font-bold"
                                    placeholder="Toko Bangunan Saya"
                                />
                                <input
                                    value={profile.tagline}
                                    onChange={e => profile.update({ tagline: e.target.value })}
                                    className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm mt-2 text-gray-500"
                                    placeholder="Tagline / Slogan Toko (opsional)"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Alamat Lengkap</label>
                                <textarea
                                    value={profile.address}
                                    onChange={e => profile.update({ address: e.target.value })}
                                    rows={2}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                                    placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan, Kota"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> No. HP / Telepon
                                </label>
                                <input
                                    value={profile.phone}
                                    onChange={e => profile.update({ phone: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                                    placeholder="08xxxxxxxx"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    onChange={e => profile.update({ email: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                                    placeholder="email@toko.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> NPWP / Tax ID (opsional)
                                </label>
                                <input
                                    value={profile.taxId}
                                    onChange={e => profile.update({ taxId: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                                    placeholder="00.000.000.0-000.000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Nama Pemilik</label>
                                <input
                                    value={profile.ownerName}
                                    onChange={e => profile.update({ ownerName: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                                    placeholder="Beni"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveProfile}
                            className={`w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-primary hover:bg-emerald-700 text-white shadow-sm'}`}
                        >
                            <Save className="w-4 h-4" />
                            {saved ? '✅ Profil toko tersimpan!' : 'Simpan Profil Toko'}
                        </button>
                    </div>
                )}

                {/* ── TAB: TAMPILAN & UI ── */}
                {activeTab === 'tampilan' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Sliders className="w-5 h-5 text-blue-500" /> Tampilan &amp; Validasi
                        </h2>

                        <div className="bg-white rounded-xl border p-5 space-y-3">
                            <div>
                                <h3 className="font-bold text-gray-800">Identitas Perangkat</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Nama ini dipakai owner/admin untuk melihat tablet atau HP mana yang membuka dan menutup shift.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Nama Perangkat</label>
                                    <input
                                        value={settings.deviceName}
                                        onChange={e => void updateSettings({ deviceName: e.target.value })}
                                        className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                                        placeholder="Contoh: Kasir Depan / Tablet Gudang"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">ID Perangkat</label>
                                    <input
                                        value={settings.deviceId}
                                        readOnly
                                        className="w-full p-2.5 border rounded-lg bg-slate-50 text-xs font-mono text-gray-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Font Size Control */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                            <div>
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <span className="text-lg">Aa</span> Ukuran Huruf &amp; Angka
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Menyesuaikan ukuran teks seluruh aplikasi. Default: 100%.</p>
                            </div>

                            {/* Big percentage display */}
                            <div className="flex items-center justify-center">
                                <span className="text-5xl font-black text-blue-600 tabular-nums">{scale}%</span>
                            </div>

                            {/* Slider */}
                            <input
                                type="range"
                                min={min}
                                max={max}
                                step={5}
                                value={scale}
                                onChange={e => applyScale(Number(e.target.value))}
                                className="w-full h-2 rounded-full accent-blue-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>{min}%</span>
                                <span>100%</span>
                                <span>{max}%</span>
                            </div>

                            {/* +/- buttons */}
                            <div className="flex gap-3 items-center">
                                <button
                                    onClick={decrease}
                                    disabled={scale <= min}
                                    className="flex-1 py-2.5 bg-white border-2 border-blue-300 rounded-xl text-blue-600 font-bold text-xl hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    −
                                </button>
                                <button
                                    onClick={reset}
                                    className="flex-none px-4 py-2.5 bg-white border rounded-xl text-gray-500 text-xs font-semibold hover:bg-slate-50 transition-colors"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={increase}
                                    disabled={scale >= max}
                                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-bold text-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Toggle switches */}
                        <div className="space-y-4 divide-y">
                            {[
                                { key: 'hideDashboard' as const, label: 'Sembunyikan Dashboard', desc: 'Halaman utama langsung ke menu POS' },
                                { key: 'requireCustomer' as const, label: 'Wajib Pilih Pelanggan', desc: 'Kasir tidak bisa checkout tanpa memilih member' },
                                { key: 'requireProductBarcode' as const, label: 'Wajib Isi Barcode', desc: 'Form tambah produk wajib mengisi barcode' },
                                { key: 'posShowProductImages' as const, label: 'Tampilan Produk Bergambar', desc: 'Jika dimatikan, halaman kasir menampilkan list detail tanpa gambar' },
                            ].map(({ key, label, desc }) => (
                                <label key={key} className="flex items-center justify-between cursor-pointer pt-4 first:pt-0">
                                    <div>
                                        <h3 className="font-semibold text-gray-800">{label}</h3>
                                        <p className="text-xs text-gray-500">{desc}</p>
                                    </div>
                                    <div
                                        className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${settings[key] ? 'bg-primary' : 'bg-gray-200'}`}
                                        onClick={() => handleToggle(key)}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow ${settings[key] ? 'left-7' : 'left-1'}`} />
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TAB: PRINTER ── */}
                {activeTab === 'printer' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-emerald-500" /> Konfigurasi Printer
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Cetak Struk</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="p-mode" checked={settings.printMode === 'browser'} onChange={() => handleSelect('printMode', 'browser')} className="text-primary focus:ring-primary" />
                                        <span className="text-sm">Jendela Print (Browser)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="p-mode" checked={settings.printMode === 'bluetooth'} onChange={() => handleSelect('printMode', 'bluetooth')} className="text-primary focus:ring-primary" />
                                        <span className="text-sm">Direct Bluetooth Thermal</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Ukuran Kertas Thermal</label>
                                <select value={settings.paperSize} onChange={e => handleSelect('paperSize', e.target.value)} className="w-full text-sm p-2.5 rounded-lg border focus:ring-2 focus:ring-primary outline-none">
                                    <option value="58mm">Kecil - 58mm</option>
                                    <option value="80mm">Sedang - 80mm</option>
                                </select>
                            </div>
                            {settings.printMode === 'bluetooth' && (
                                <div className="bg-slate-50 p-4 rounded-xl border space-y-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 mb-1">Perangkat Printer Bluetooth</p>
                                        <p className="text-xs text-gray-500">Untuk direct print, pair dulu printer thermal 58mm dari pengaturan Bluetooth Android, lalu pilih dari daftar ini.</p>
                                    </div>

                                    {settings.bluetoothMacAddress ? (
                                        <div className="flex items-center justify-between gap-3 bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200 text-sm">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <Bluetooth className="w-4 h-4 flex-shrink-0" />
                                                <span className="truncate">{settings.bluetoothPrinterName || 'Printer Bluetooth'} ({settings.bluetoothMacAddress})</span>
                                            </span>
                                            <button onClick={() => updateSettings({ bluetoothMacAddress: null, bluetoothPrinterName: null })} className="text-xs text-red-500 font-bold hover:underline flex-shrink-0">Lepas</button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">Belum ada printer yang tersambung.</p>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <button onClick={pairBluetoothPrinter} className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm flex justify-center items-center gap-2 transition-colors">
                                            <Bluetooth className="w-4 h-4" /> {loadingPrinters ? 'Memuat Printer...' : nativeBluetoothSupported ? 'Muat Printer Paired' : 'Cari & Pairing Printer'}
                                        </button>
                                        {nativeBluetoothSupported && (
                                            <>
                                                <button onClick={runPrinterDiagnostic} className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm flex justify-center items-center gap-2 transition-colors">
                                                    <AlertCircle className="w-4 h-4" /> Diagnosa Koneksi
                                                </button>
                                                <button onClick={testPrintBluetooth} className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm flex justify-center items-center gap-2 transition-colors">
                                                    <Printer className="w-4 h-4" /> Test Print
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {nativeBluetoothSupported && pairedPrinters.length > 0 && (
                                        <div className="space-y-2">
                                            {pairedPrinters.map(device => (
                                                <button
                                                    key={device.address}
                                                    type="button"
                                                    onClick={() => void connectNativePrinter(device)}
                                                    className={`w-full text-left border rounded-xl px-3 py-2.5 transition-colors ${settings.bluetoothMacAddress === device.address ? 'border-primary bg-emerald-50' : 'border-slate-200 hover:border-primary hover:bg-white'}`}
                                                >
                                                    <div className="font-semibold text-sm text-gray-800">{device.name}</div>
                                                    <div className="text-[11px] text-gray-500 font-mono">{device.address}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {nativeBluetoothSupported && printerDiagnostic && (
                                        <div className={`rounded-xl border p-4 text-sm ${printerDiagnostic.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                            <div className="flex items-start gap-2 font-semibold">
                                                {printerDiagnostic.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                                                <div>
                                                    <div>Hasil Diagnosa Printer</div>
                                                    <div className="font-normal mt-1">{printerDiagnostic.message}</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                                                <div className="bg-white/70 rounded-lg px-3 py-2 border border-current/10">Bluetooth tersedia: <span className="font-bold">{printerDiagnostic.available ? 'Ya' : 'Tidak'}</span></div>
                                                <div className="bg-white/70 rounded-lg px-3 py-2 border border-current/10">Bluetooth aktif: <span className="font-bold">{printerDiagnostic.enabled ? 'Ya' : 'Tidak'}</span></div>
                                                <div className="bg-white/70 rounded-lg px-3 py-2 border border-current/10">Printer dipilih: <span className="font-bold">{printerDiagnostic.deviceName || settings.bluetoothPrinterName || '-'}</span></div>
                                                <div className="bg-white/70 rounded-lg px-3 py-2 border border-current/10">Bisa terhubung: <span className="font-bold">{printerDiagnostic.canConnect ? 'Ya' : 'Belum'}</span></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
                                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                                            <KeyRound className="w-4 h-4" /> Bantuan Koneksi Printer
                                        </div>
                                        <ol className="list-decimal list-inside space-y-1">
                                            <li>Pair printer thermal 58mm dulu dari pengaturan Bluetooth Android.</li>
                                            <li>Pilih mode <span className="font-semibold">Direct Bluetooth Thermal</span>.</li>
                                            <li>Tekan <span className="font-semibold">Muat Printer Paired</span> lalu pilih nama printer.</li>
                                            <li>Jalankan <span className="font-semibold">Diagnosa Koneksi</span> sebelum <span className="font-semibold">Test Print</span>.</li>
                                            <li>Jika masih gagal, matikan lalu hidupkan Bluetooth printer dan tablet, lalu coba lagi.</li>
                                        </ol>
                                    </div>

                                    {statusMessage && <p className="text-xs text-blue-600 text-center">{statusMessage}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── TAB: FORMAT STRUK ── */}
                {activeTab === 'struk' && <ReceiptSettingsPanel />}

                {/* ── TAB: CABANG ── */}
                {activeTab === 'cabang' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <GitBranch className="w-5 h-5 text-emerald-600" /> Manajemen Cabang
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">Tambah, edit, atau hapus cabang toko. Minimal 1 cabang harus ada.</p>
                        </div>

                        {/* List branches */}
                        <div className="space-y-3">
                            {branches.map(b => (
                                <div key={b.id} className="border rounded-xl overflow-hidden">
                                    {editingBranchId === b.id ? (
                                        <div className="p-4 space-y-3 bg-emerald-50">
                                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nama Cabang" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary font-semibold" />
                                            <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Alamat (opsional)" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm" />
                                            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="No. HP (opsional)" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm" />
                                            <div className="flex gap-2">
                                                <button onClick={saveEdit} className="flex-1 py-2 bg-primary text-white font-bold rounded-lg flex items-center justify-center gap-1 text-sm"><Check className="w-4 h-4" /> Simpan</button>
                                                <button onClick={() => setEditingBranchId(null)} className="py-2 px-4 bg-white border rounded-lg text-sm font-semibold text-gray-600"><XIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 flex justify-between items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800">{b.name}</p>
                                                {b.address && <p className="text-xs text-gray-500 mt-0.5">{b.address}</p>}
                                                {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button onClick={() => startEdit(b)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button
                                                    onClick={() => branches.length > 1 && confirm(`Hapus cabang "${b.name}"?`) && deleteBranch(b.id)}
                                                    disabled={branches.length <= 1}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                ><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add new branch */}
                        {addingBranch ? (
                            <div className="border-2 border-dashed border-emerald-300 rounded-xl p-4 space-y-3 bg-emerald-50">
                                <p className="text-sm font-semibold text-emerald-700">Cabang Baru</p>
                                <input value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Nama Cabang *" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary font-semibold" />
                                <input value={newBranchAddress} onChange={e => setNewBranchAddress(e.target.value)} placeholder="Alamat (opsional)" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm" />
                                <input value={newBranchPhone} onChange={e => setNewBranchPhone(e.target.value)} placeholder="No. HP (opsional)" className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm" />
                                <div className="flex gap-2">
                                    <button onClick={handleAddBranch} disabled={!newBranchName.trim()} className="flex-1 py-2 bg-primary text-white font-bold rounded-lg flex items-center justify-center gap-1 text-sm disabled:opacity-50"><Check className="w-4 h-4" /> Tambah Cabang</button>
                                    <button onClick={() => setAddingBranch(false)} className="py-2 px-4 bg-white border rounded-lg text-sm font-semibold text-gray-600"><XIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setAddingBranch(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-emerald-400 hover:text-emerald-600 font-semibold flex items-center justify-center gap-2 transition-colors">
                                <Plus className="w-4 h-4" /> Tambah Cabang Baru
                            </button>
                        )}
                    </div>
                )}

                {/* ── TAB: PASSWORD ROLE ── */}
                {activeTab === 'password' && <PasswordManagerPanel />}

                {/* ── TAB: BACKUP DATA ── */}
                {activeTab === 'backup' && (
                    <div className="space-y-4 max-w-xl">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                            💾 Data tersimpan di IndexedDB browser Anda. Export JSON untuk backup, dan restore untuk memulihkan data.
                        </div>
                        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
                            <h3 className="font-bold text-gray-800">Export Backup</h3>
                            <p className="text-sm text-gray-500">Unduh semua data (produk, transaksi, pengeluaran, pelanggan, supplier) sebagai satu file JSON.</p>
                            <button
                                onClick={async () => {
                                    const { db } = await import('@/lib/dexie');
                                    const backup = {
                                        exported_at: new Date().toISOString(),
                                        products: await db.products.toArray(),
                                        unit_conversions: await db.unit_conversions.toArray(),
                                        sale_queue: await db.sale_queue.toArray(),
                                        receivables_payments: await db.receivables_payments.toArray(),
                                        expenses: await db.expenses.toArray(),
                                        customers: await db.customers.toArray(),
                                        suppliers: await db.suppliers.toArray(),
                                        branches: await db.branches.toArray(),
                                    };
                                    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `backup-pos-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                ⬇️ Export JSON Sekarang
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
                            <h3 className="font-bold text-gray-800">Restore dari Backup</h3>
                            <p className="text-sm text-gray-500">Upload file JSON backup untuk memulihkan data. Data yang ada akan digabung (tidak dihapus).</p>
                            <input
                                type="file"
                                accept=".json"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        const text = await file.text();
                                        const data = JSON.parse(text);
                                        const { db } = await import('@/lib/dexie');
                                        if (data.products) await db.products.bulkPut(data.products);
                                        if (data.unit_conversions) await db.unit_conversions.bulkPut(data.unit_conversions);
                                        if (data.sale_queue) await db.sale_queue.bulkPut(data.sale_queue);
                                        if (data.receivables_payments) await db.receivables_payments.bulkPut(data.receivables_payments);
                                        if (data.expenses) await db.expenses.bulkPut(data.expenses);
                                        if (data.customers) await db.customers.bulkPut(data.customers);
                                        if (data.suppliers) await db.suppliers.bulkPut(data.suppliers);
                                        if (data.branches) await db.branches.bulkPut(data.branches);
                                        alert('✅ Restore berhasil! Halaman akan dimuat ulang.');
                                        window.location.reload();
                                    } catch {
                                        alert('❌ Gagal restore: file tidak valid atau corrupt.');
                                    }
                                }}
                                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                            />
                        </div>
                    </div>
                )}

                {/* ── TAB: TROUBLESHOOTING ── */}
                {activeTab === 'troubleshoot' && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                            <h3 className="font-bold text-amber-800 flex items-center gap-2 flex">
                                <AlertCircle className="w-5 h-5" /> Pusat Pemulihan Sistem
                            </h3>
                            <p className="text-sm text-amber-700 mt-1">Gunakan fitur ini jika aplikasi terasa berat, data tidak muncul, atau stok tidak sinkron.</p>
                        </div>

                        {/* Status Koneksi Database */}
                        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
                            <h4 className="font-bold text-gray-800 flex items-center gap-2 flex">
                                <Activity className="w-4 h-4 text-emerald-500" /> Status Koneksi Database
                            </h4>
                            {productSyncError ? (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                    Error Terakhir: {productSyncError}
                                </div>
                            ) : (productLoading || syncProgress) ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold text-emerald-700">
                                        <span>{syncProgress ? "Memuat Data Produk..." : "Mengecek Koneksi & Data..."}</span>
                                        {syncProgress && (
                                            <span>{syncProgress.current} / {syncProgress.total}</span>
                                        )}
                                    </div>
                                    <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-full transition-all duration-300"
                                            style={{
                                                width: syncProgress ? `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` : '0%'
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg text-sm">
                                    ✅ Koneksi database terlihat normal.
                                </div>
                            )}
                            <button
                                onClick={async () => {
                                    setStatusMessage("Sedang mengetes koneksi ke Supabase...");
                                    try {
                                        await useProductStore.getState().loadProducts({ silent: false });
                                        const storeState = useProductStore.getState();
                                        const productCount = storeState.products.length;
                                        const syncError = storeState.lastSyncError;

                                        if (syncError) {
                                            alert("❌ Gagal Sinkronisasi:\n\n" + syncError);
                                        } else if (productCount === 0) {
                                            alert("⚠️ Sinkronisasi selesai tapi tidak ada produk yang berhasil ditarik.\n\nKemungkinan:\n1. Database cloud memang kosong (belum ada produk)\n2. Ada masalah izin akses (RLS) di Supabase\n\nSilakan cek Console browser (F12) untuk detail error.");
                                        } else {
                                            alert(`✅ Berhasil! ${productCount} produk berhasil dimuat.`);
                                        }
                                    } catch (err) {
                                        alert("❌ Koneksi Error: " + String(err));
                                    } finally {
                                        setStatusMessage("");
                                    }
                                }}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                                <RefreshCw className="w-4 h-4" /> Tes Ulang Koneksi & Tarik Produk
                            </button>
                        </div>

                        {/* Migrasi Foto */}
                        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4 border-emerald-100">
                            <h4 className="font-bold text-emerald-600 flex items-center gap-2">
                                <Database className="w-4 h-4" /> Migrasi Foto Lama ke Cloud
                            </h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Fitur ini akan mengunggah foto yang tersimpan memori sistem lokal ke Supabase Cloud (Storage Bucket).
                                Agar aplikasi menjadi lebih ringan dan cepat (tidak timeout ditarik). Cukup jalankan dari satu perangkat kasir saja.
                            </p>
                            <button
                                onClick={async () => {
                                    if (!confirm("Mulai proses pemindahan foto? Ini butuh waktu beberapa menit dan browser tidak boleh ditutup.")) return;

                                    setStatusMessage("Menganalisa produk yang butuh migrasi...");
                                    try {
                                        const store = useProductStore.getState();
                                        const { db } = await import('@/lib/dexie');
                                        const { supabase } = await import('@/lib/supabase');

                                        const productsToMigrate = await db.products
                                            .filter(p => !!p.base64_offline && p.base64_offline.startsWith('data:image/') && !p.image_url)
                                            .toArray();

                                        if (productsToMigrate.length === 0) {
                                            alert("✅ Semua foto produk sudah memakai sistem Cloud Storage. Tidak ada yang perlu dimigrasi.");
                                            return;
                                        }

                                        let successCount = 0;
                                        let failCount = 0;

                                        for (let i = 0; i < productsToMigrate.length; i++) {
                                            const p = productsToMigrate[i];
                                            setStatusMessage(`Mengunggah foto ${i + 1}/${productsToMigrate.length} (${p.name})...`);

                                            let attempt = 0;
                                            let success = false;
                                            while (attempt < 3 && !success) {
                                                try {
                                                    const res = await fetch(p.base64_offline!);
                                                    const blob = await res.blob();
                                                    const fileExt = blob.type.split('/')[1] || 'jpg';
                                                    const fileName = `migrated_${Date.now()}_${p.id}.${fileExt}`;
                                                    const filePath = `products/${fileName}`;

                                                    const { data, error } = await supabase.storage.from('product-images').upload(filePath, blob, { upsert: true });
                                                    if (error) throw error;

                                                    const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
                                                    const newUrl = publicUrlData.publicUrl;

                                                    await db.products.update(p.id, {
                                                        image_url: newUrl,
                                                        base64_offline: undefined
                                                    });

                                                    await supabase.from('products').update({ image_url: newUrl, base64_offline: null }).eq('id', p.id);

                                                    successCount++;
                                                    success = true;
                                                } catch (err) {
                                                    attempt++;
                                                    console.error(`Gagal migrasi (Attempt ${attempt}):`, p.name, err);
                                                    if (attempt < 3) {
                                                        setStatusMessage(`Gagal. Retrying dalam 3 detik... (${attempt}/3)`);
                                                        await new Promise(r => setTimeout(r, 3000));
                                                    } else {
                                                        failCount++;
                                                    }
                                                }
                                            }
                                            // Delay 500ms between products to prevent Supabase connection exhaustion
                                            await new Promise(r => setTimeout(r, 500));
                                        }

                                        setStatusMessage("Sedang menyinkronkan ulang data dari cloud...");
                                        await store.loadProducts({ silent: false });
                                        alert(`🎉 Selesai!\n✅ Berhasil: ${successCount}\n❌ Gagal: ${failCount}`);

                                    } catch (e) {
                                        alert("❌ Error Server: " + String(e));
                                    } finally {
                                        setStatusMessage("");
                                    }
                                }}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all border border-slate-300"
                            >
                                <Upload className="w-4 h-4" /> Mulai Migrasi Foto Lama
                            </button>
                        </div>

                        {/* Force Reset App */}
                        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4 border-red-100">
                            <h4 className="font-bold text-red-600 flex items-center gap-2 flex">
                                <Zap className="w-4 h-4" /> Tombol Darurat (Reset PWA)
                            </h4>
                            <p className="text-xs text-gray-500">
                                Tombol ini akan menghapus &quot;Cache&quot; aplikasi (bukan data transaksi) dan memaksa browser mendownload versi terbaru dari server. Cocok untuk tablet xiaomi yang &quot;sangkut&quot;.
                            </p>
                            <button
                                onClick={async () => {
                                    if (confirm("Hapus Cache PWA dan Restart Aplikasi?")) {
                                        if ('serviceWorker' in navigator) {
                                            const registrations = await navigator.serviceWorker.getRegistrations();
                                            for (const reg of registrations) {
                                                await reg.unregister();
                                            }
                                        }
                                        const cacheKeys = await caches.keys();
                                        await Promise.all(cacheKeys.map(key => caches.delete(key)));
                                        window.location.reload();
                                    }
                                }}
                                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                                <Trash2 className="w-4 h-4" /> Hapus Cache PWA & Force Restart
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

