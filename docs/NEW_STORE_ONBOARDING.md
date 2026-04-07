# Onboarding Toko Baru

Panduan singkat supaya toko baru memakai instance sendiri tanpa mengganggu data toko lain.

## 1. Buat project terpisah

- Buat `Supabase` baru
- Buat `Vercel` project baru
- Jangan pakai project Supabase toko lama

## 2. Jalankan bootstrap SQL

- Buka `Supabase SQL Editor`
- Jalankan file `sql/supabase-bootstrap.sql`

File ini membuat tabel utama POS:

- `branches`
- `products`
- `unit_conversions`
- `customers`
- `suppliers`
- `expenses`
- `inventory_movements`
- `sales`
- `sale_details`
- `receivables_payments`
- `cash_shifts`
- `store_settings`

## 3. Isi environment Vercel

Minimal isi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Deploy aplikasi

- Hubungkan repo ke project Vercel
- Deploy ke domain/subdomain toko baru

## 5. Isi data awal toko

Di aplikasi:

- Isi profil toko
- Isi owner
- Buat user `owner/admin/kasir`
- Tambahkan cabang jika perlu
- Tambahkan produk dan stok awal

## 6. Siapkan perangkat

Di setiap perangkat:

- atur nama perangkat
- pair printer
- tes print struk
- tes scanner barcode

## 7. Tes operasional wajib

Sebelum toko live, tes:

- transaksi tunai
- transaksi tempo sebagian bayar
- pembayaran kasbon
- void transaksi
- void item
- buka shift
- tutup shift
- monitoring shift
- print struk
- print ulang riwayat transaksi
- scanner barcode
- print barcode

## 8. Backup awal

Simpan catatan:

- URL Vercel toko
- URL project Supabase
- akun owner
- nama perangkat utama
- printer yang dipakai
- scanner yang dipakai
