# 🏗️ Blueprint: Proyek Bangunan POS

Dokumen ini adalah "Peta Cetak Biru" utama untuk proyek **bangunan-pos**. Gunakan ini sebagai referensi utama setiap awal sesi untuk memahami struktur dan aturan main proyek ini.

## 📁 Struktur Folder Utama
*   `src/app/`: Routing utama (Next.js App Router). Berisi halaman POS, Stok Opname, Laporan, dll.
*   `src/components/`: Komponen UI yang dapat digunakan kembali.
*   `src/lib/`: Logika inti untuk integrasi database.
    *   `dexie.ts`: Database lokal (IndexedDB) untuk fitur offline.
    *   `supabase.ts`: Konfigurasi backend Supabase.
*   `src/store/`: State management menggunakan Zustand.
*   `android/`: Folder integrasi mobile menggunakan Capacitor.

## 🛠️ Tech Stack
*   **Framework**: Next.js 14, React 18, TypeScript.
*   **Database**: Supabase (Backend) & Dexie.js (Local Offline).
*   **UI/Styling**: Tailwind CSS, Lucide React (Icons), Recharts (Charts).
*   **Hybrid Mobile**: Capacitor.
*   **Reporting**: jsPDF, ExcelJS/XLSX.

## 📜 Protokol Sesi (SOP) - WAJIB DIKUTIP
Demi menjaga keutuhan kode dan menghindari "saran asal-asalan", ikuti aturan ini di setiap sesi:

1.  **Ritual Pembuka**: 
    > “Saya ingin kamu membuka dan menganalisis folder ini (atau advanced-crypto-agent jika relevan). Perhatikan baik-baik file pentingnya terlebih dahulu sebelum merencanakan perubahan.”
2.  **Validasi Kode**: Dilarang memberikan jawaban teoritis atau cuplikan kode terpotong tanpa context. Selalu cek file aslinya terlebih dahulu.
3.  **Instruksi Perubahan (Hard Rule)**:
    > “Jangan hapus kodenya, perbarui yang ada. Ingat efek dominonya, cek fungsi pembuka posisi/transaksi. Perbarui di layar saya!”

## 🔗 File Penting untuk Dipantau
- `src/lib/dexie.ts`: Skema database lokal.
- `.env.local`: Konfigurasi environment (Supabase URL/Key).
- `src/app/pos/page.tsx`: Logika transaksi penjualan.
- `src/store/productStore.ts`: Manajemen state produk.
- `package.json`: Daftar dependencies dan versi.
